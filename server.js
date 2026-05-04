const express = require('express');
const path = require('path');
const { scrapeAllStates } = require('./scraper');
const db = require('./db');
const { ELECTIONS } = require('./elections');

const app = express();
const PORT = 3000;
const POLL_INTERVAL_MS = 5 * 60 * 1000;

const DEFAULT_ELECTION = ELECTIONS[0]; // may2026

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory live cache (only for the default/live election)
let cache = { data: null, error: null, lastUpdated: null, isLoading: false };
const clients = new Set();

// Track in-progress historical scrapes so we don't double-run
const scraping = new Set();

// Pre-populate cache from DB on startup
(function loadFromDb() {
  const run = db.getLatestRun(DEFAULT_ELECTION.code);
  if (run) {
    cache.data = db.getRunData(run.id);
    cache.lastUpdated = run.scraped_at;
    console.log(`[startup] Loaded run #${run.id} (${run.scraped_at}) from DB`);
  }
})();

// ── SSE ───────────────────────────────────────────────────────────────────────
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Send current state immediately
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

// ── Live polling (default election) ───────────────────────────────────────────
async function fetchAndBroadcast() {
  if (cache.isLoading) return;
  cache.isLoading = true;
  broadcast({ type: 'loading', isLoading: true, lastUpdated: cache.lastUpdated });

  try {
    console.log(`[${new Date().toISOString()}] Live scrape: ${DEFAULT_ELECTION.name}`);
    const data = await scrapeAllStates(DEFAULT_ELECTION);
    const scrapedAt = new Date().toISOString();

    db.saveRun(DEFAULT_ELECTION.code, scrapedAt, data);

    cache = { data, error: null, lastUpdated: scrapedAt, isLoading: false };
    console.log(`[${scrapedAt}] Live scrape done`);
    broadcast({ type: 'update', payload: data, lastUpdated: scrapedAt, isLoading: false });
  } catch (err) {
    cache.error = err.message;
    cache.isLoading = false;
    cache.lastUpdated = new Date().toISOString();
    broadcast({ type: 'error', error: err.message, lastUpdated: cache.lastUpdated, isLoading: false });
    console.error('Live scrape error:', err.message);
  }
}

fetchAndBroadcast();
setInterval(fetchAndBroadcast, POLL_INTERVAL_MS);

// ── REST API ──────────────────────────────────────────────────────────────────
app.get('/api/elections', (req, res) => {
  const history = db.getHistory(50);
  // Attach last scrape info to each election
  const result = ELECTIONS.map(e => {
    const lastRun = history.find(h => h.election_code === e.code);
    return {
      code:      e.code,
      label:     e.label,
      name:      e.name,
      states:    e.states.map(s => ({ code: s.code, name: s.name, seats: s.seats, flag: s.flag })),
      lastRun:   lastRun ? { id: lastRun.id, scrapedAt: lastRun.scraped_at } : null,
      scraping:  scraping.has(e.code),
    };
  });
  res.json(result);
});

app.get('/api/history', (_req, res) => {
  res.json(db.getHistory(30));
});

app.get('/api/results', (_req, res) => {
  res.json({ data: cache.data, error: cache.error, lastUpdated: cache.lastUpdated, isLoading: cache.isLoading });
});

app.get('/api/results/:runId', (req, res) => {
  const data = db.getRunData(parseInt(req.params.runId));
  if (!data || !Object.keys(data).length) return res.status(404).json({ error: 'Run not found' });
  res.json(data);
});

// Trigger live refresh
app.post('/api/refresh', async (_req, res) => {
  res.json({ message: 'Refresh triggered' });
  fetchAndBroadcast();
});

// Trigger scrape for any election
app.post('/api/scrape', async (req, res) => {
  const { electionCode } = req.body;
  const election = ELECTIONS.find(e => e.code === electionCode);
  if (!election) return res.status(400).json({ error: 'Unknown election code' });
  if (scraping.has(electionCode)) return res.status(409).json({ error: 'Already scraping this election' });

  res.json({ message: `Scraping ${election.name}` });

  scraping.add(electionCode);
  broadcast({ type: 'scrape-started', electionCode, electionName: election.name });

  try {
    console.log(`[${new Date().toISOString()}] Historical scrape: ${election.name}`);
    const data = await scrapeAllStates(election);
    const scrapedAt = new Date().toISOString();
    const runId = db.saveRun(electionCode, scrapedAt, data);
    console.log(`[${scrapedAt}] Historical scrape done — run #${runId}`);
    broadcast({ type: 'scrape-done', electionCode, electionName: election.name, runId, scrapedAt });
  } catch (err) {
    console.error(`Historical scrape error (${electionCode}):`, err.message);
    broadcast({ type: 'scrape-error', electionCode, error: err.message });
  } finally {
    scraping.delete(electionCode);
  }
});

app.listen(PORT, () => {
  console.log(`ECI Results Tracker → http://localhost:${PORT}`);
  console.log(`Polling every ${POLL_INTERVAL_MS / 60000} minutes`);
});
