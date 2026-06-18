const express = require('express');
const path = require('path');
const { scrapeAllStates } = require('./scraper');
const db = require('./db');
const { ELECTIONS } = require('./elections');

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

  // Lok Dhaba elections from DB
  const ldElections = db.getAllElections().map(e => ({
    code:    e.code,
    label:   e.label,
    name:    e.name,
    states:  [{ code: e.state_code, name: e.state_name, seats: e.seats, flag: e.flag }],
    lastRun: { id: e.run_id, scrapedAt: e.scraped_at },
    source:  'lokdhaba',
  }));

  res.json([...live, ...ldElections]);
});

app.get('/api/results', (_req, res) => {
  res.json({ data: cache.data, error: cache.error, lastUpdated: cache.lastUpdated, isLoading: cache.isLoading });
});

app.get('/api/results/:runId', (req, res) => {
  const data = db.getRunData(parseInt(req.params.runId));
  if (!data || !Object.keys(data).length) return res.status(404).json({ error: 'Run not found' });
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`ECI Results Tracker → http://localhost:${PORT}`);
});
