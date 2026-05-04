const express = require('express');
const path = require('path');
const { scrapeAllStates, STATES } = require('./scraper');
const db = require('./db');

const app = express();
const PORT = 3000;
const POLL_INTERVAL_MS = 5 * 60 * 1000;

let cache = { data: null, error: null, lastUpdated: null, isLoading: false };
const clients = new Set();

app.use(express.static(path.join(__dirname, 'public')));

// Pre-populate cache from DB so UI shows data immediately on restart
(function loadFromDb() {
  const run = db.getLatestRun();
  if (run) {
    cache.data = db.getRunData(run.id);
    cache.lastUpdated = run.scraped_at;
    console.log(`[startup] Loaded run #${run.id} from DB (${run.scraped_at})`);
  }
})();

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

app.get('/api/results', (req, res) => {
  res.json({ data: cache.data, error: cache.error, lastUpdated: cache.lastUpdated, isLoading: cache.isLoading });
});

app.get('/api/history', (req, res) => {
  res.json(db.getHistory(20));
});

app.get('/api/results/:runId', (req, res) => {
  const data = db.getRunData(parseInt(req.params.runId));
  if (!data || !Object.keys(data).length) return res.status(404).json({ error: 'Run not found' });
  res.json(data);
});

app.post('/api/refresh', async (req, res) => {
  res.json({ message: 'Refresh triggered' });
  fetchAndBroadcast();
});

function broadcast(payload) {
  clients.forEach(send => send(payload));
}

async function fetchAndBroadcast() {
  if (cache.isLoading) return;
  cache.isLoading = true;
  broadcast({ type: 'loading', isLoading: true, lastUpdated: cache.lastUpdated });

  try {
    console.log(`[${new Date().toISOString()}] Starting scrape of all 5 states…`);
    const data = await scrapeAllStates();
    const scrapedAt = new Date().toISOString();

    db.saveRun(scrapedAt, data);

    cache = { data, error: null, lastUpdated: scrapedAt, isLoading: false };
    const summary = STATES.map(s => `${s.name}:${data[s.code]?.constituencies?.length ?? 'err'}`).join(', ');
    console.log(`[${scrapedAt}] Done — ${summary}`);
    broadcast({ type: 'update', payload: data, lastUpdated: scrapedAt, isLoading: false });
  } catch (err) {
    cache.error = err.message;
    cache.isLoading = false;
    cache.lastUpdated = new Date().toISOString();
    broadcast({ type: 'error', error: err.message, lastUpdated: cache.lastUpdated, isLoading: false });
    console.error('Scrape error:', err.message);
  }
}

fetchAndBroadcast();
setInterval(fetchAndBroadcast, POLL_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`ECI Results Tracker → http://localhost:${PORT}`);
  console.log(`Polling every ${POLL_INTERVAL_MS / 60000} minutes`);
});
