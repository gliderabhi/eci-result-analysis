const express = require('express');
const path = require('path');
const { scrapeAllStates } = require('./scraper');
const db = require('./db');
const { ELECTIONS } = require('./elections');

// Flag lookup for GE state codes (2-letter codes used by import-lokdhaba-ge.js)
const GE_STATE_FLAGS = {
  AP:'🌶️', AR:'🏔️', AS:'🍵', BR:'🌾', CG:'🌲', GA:'🏖️', GJ:'🦁',
  HR:'🌾', HP:'❄️', JK:'🏔️', JH:'🌿', KA:'🐘', KL:'🌴', MP:'🐆',
  MH:'🏙️', MN:'🎭', ML:'☁️', MZ:'⛰️', NL:'🗡️', OD:'🛕', PB:'🌾',
  RJ:'🏜️', SK:'🏔️', TN:'🎭', TS:'🌶️', TR:'🏕️', UP:'🕌', UK:'🏔️',
  WB:'🐯', DL:'🏛️', PY:'🏖️', CH:'🏙️', LD:'🏝️', AN:'🏝️', DN:'🌊',
};

const app = express();
const PORT = 3000;

const DEFAULT_ELECTION = ELECTIONS[0]; // may2026

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory cache for the live/current election
let cache = { data: null, error: null, lastUpdated: null, isLoading: false };
const clients = new Set();

// Load from DB on startup; scrape once only if no data exists
(async function init() {
  const run = db.getLatestRun(DEFAULT_ELECTION.code);
  if (run) {
    cache.data = db.getRunData(run.id);
    cache.lastUpdated = run.scraped_at;
    console.log(`[startup] Loaded run #${run.id} (${run.scraped_at}) from DB`);
  } else {
    console.log('[startup] No data in DB — running initial scrape…');
    await scrapeAndCache();
  }
})();

// ── SSE ───────────────────────────────────────────────────────────────────────
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  if (cache.data || cache.error) {
    send({ type: cache.error ? 'error' : 'update', payload: cache.data, error: cache.error, lastUpdated: cache.lastUpdated, isLoading: cache.isLoading });
  } else {
    send({ type: 'loading', isLoading: true });
  }

  clients.add(send);
  req.on('close', () => clients.delete(send));
});

function broadcast(payload) {
  clients.forEach(send => send(payload));
}

async function scrapeAndCache() {
  if (cache.isLoading) return;
  cache.isLoading = true;

  try {
    console.log(`[${new Date().toISOString()}] Scraping: ${DEFAULT_ELECTION.name}`);
    const data = await scrapeAllStates(DEFAULT_ELECTION);
    const scrapedAt = new Date().toISOString();

    const hasData = Object.values(data).some(v => v && v.constituencies?.length > 0);
    if (hasData) {
      db.saveRun(DEFAULT_ELECTION.code, scrapedAt, data);
      cache = { data, error: null, lastUpdated: scrapedAt, isLoading: false };
      console.log(`[${scrapedAt}] Scrape done`);
      broadcast({ type: 'update', payload: data, lastUpdated: scrapedAt, isLoading: false });
    } else {
      cache.isLoading = false;
      console.log(`[${scrapedAt}] Scrape returned no data — keeping existing cache`);
    }
  } catch (err) {
    cache.error = err.message;
    cache.isLoading = false;
    console.error('Scrape error:', err.message);
  }
}

// ── REST API ──────────────────────────────────────────────────────────────────
app.get('/api/elections', (_req, res) => {
  // Always include live ECI election if it has data
  const history = db.getHistory(200);
  const liveRun = history.find(h => h.election_code === DEFAULT_ELECTION.code);
  const live = liveRun ? [{
    code:    DEFAULT_ELECTION.code,
    label:   DEFAULT_ELECTION.label,
    name:    DEFAULT_ELECTION.name,
    states:  DEFAULT_ELECTION.states.map(s => ({ code: s.code, name: s.name, seats: s.seats, flag: s.flag })),
    lastRun: { id: liveRun.id, scrapedAt: liveRun.scraped_at },
    source:  'eci',
  }] : [];

  // Lok Dhaba Assembly Elections
  const ldElections = db.getAllElections().map(e => ({
    code:    e.code,
    label:   e.label,
    name:    e.name,
    states:  [{ code: e.state_code, name: e.state_name, seats: e.seats, flag: e.flag }],
    lastRun: { id: e.run_id, scrapedAt: e.scraped_at },
    source:  'lokdhaba',
  }));

  // Lok Dhaba General Elections (Lok Sabha)
  const geElections = db.getAllGEElections().map(e => ({
    code:    e.code,
    label:   e.label,
    name:    e.name,
    seats:   e.seats,
    majority: e.majority,
    states:  db.getRunStates(e.run_id).map(s => ({
      code:  s.state_code,
      name:  s.state_name,
      seats: s.seats,
      flag:  GE_STATE_FLAGS[s.state_code] || '🗳️',
    })),
    lastRun: { id: e.run_id, scrapedAt: e.scraped_at },
    source:  'lokdhaba_ge',
  }));

  res.json([...live, ...geElections, ...ldElections]);
});

app.get('/api/results', (_req, res) => {
  res.json({ data: cache.data, error: cache.error, lastUpdated: cache.lastUpdated, isLoading: cache.isLoading });
});

app.get('/api/results/:runId', (req, res) => {
  const data = db.getRunData(parseInt(req.params.runId));
  if (!data || !Object.keys(data).length) return res.status(404).json({ error: 'Run not found' });
  res.json(data);
});

// On-demand AE import for a single state
app.post('/api/fetch-ae/:stateKey', async (req, res) => {
  const { stateKey } = req.params;
  const { importState } = require('./import-lokdhaba');
  if (!importState) return res.status(400).json({ error: 'importer unavailable' });
  try {
    console.log(`[on-demand] Importing AE for ${stateKey}…`);
    await importState(stateKey);
    const elections = db.getAllElections().filter(e =>
      e.code.startsWith(stateKey + '_') || e.code === stateKey
    );
    res.json({ success: true, elections });
  } catch (e) {
    console.error('[on-demand AE] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// On-demand GE import for a specific year
app.post('/api/fetch-ge/:year', async (req, res) => {
  const year = parseInt(req.params.year);
  const { importGEYear } = require('./import-lokdhaba-ge');
  if (!importGEYear) return res.status(400).json({ error: 'importer unavailable' });
  try {
    console.log(`[on-demand] Importing GE ${year}…`);
    await importGEYear(year);
    const elections = db.getAllGEElections().filter(e => e.code === `GE_${year}`);
    res.json({ success: true, elections });
  } catch (e) {
    console.error('[on-demand GE] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`ECI Results Tracker → http://localhost:${PORT}`);
});
