const express = require('express');
const path = require('path');
const { scrapeAllStates, STATES } = require('./scraper');

const app = express();
const PORT = 3000;
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (scraping all 5 states takes ~3min)

let cache = { data: null, error: null, lastUpdated: null, isLoading: false };
const clients = new Set();

app.use(express.static(path.join(__dirname, 'public')));

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
    cache = { data, error: null, lastUpdated: new Date().toISOString(), isLoading: false };
    const summary = STATES.map(s => `${s.name}:${data[s.code]?.constituencies?.length ?? 'err'}`).join(', ');
    console.log(`[${cache.lastUpdated}] Done — ${summary}`);
    broadcast({ type: 'update', payload: data, lastUpdated: cache.lastUpdated, isLoading: false });
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
