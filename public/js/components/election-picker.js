// ── Election Picker (side drawer) ─────────────────────────────────────────────

let _elections = [];  // populated from /api/elections

function toggleElectionDrawer() {
  const drawer = document.getElementById('election-drawer');
  const isOpen = drawer.classList.toggle('open');
  document.getElementById('drawer-backdrop').style.display = isOpen ? 'block' : 'none';
  if (isOpen) loadElectionList();
}

function closeElectionDrawer() {
  document.getElementById('election-drawer').classList.remove('open');
  document.getElementById('drawer-backdrop').style.display = 'none';
}

async function loadElectionList() {
  const container = document.getElementById('election-list');
  container.innerHTML = '<div class="ep-loading">Loading…</div>';
  try {
    const res = await fetch('/api/elections');
    _elections = await res.json();
    renderElectionList();
  } catch (e) {
    container.innerHTML = '<div class="ep-loading" style="color:var(--red)">Failed to load</div>';
  }
}

function renderElectionList() {
  const container = document.getElementById('election-list');
  container.innerHTML = _elections.map(e => {
    const isCurrent = STATE.currentElection?.code === e.code && !STATE.viewingRunId;
    const isLive    = e.code === 'may2026' && !STATE.viewingRunId && !STATE.currentElection;
    const active    = isCurrent || isLive;
    const scraping  = e.scraping;

    const lastRunHtml = e.lastRun
      ? `<div class="ep-last">Last scraped ${fmtDate(e.lastRun.scrapedAt)}</div>`
      : `<div class="ep-last" style="color:var(--dim)">Not scraped yet</div>`;

    const scrapeBtn = scraping
      ? `<button class="ep-btn ep-btn-scraping" disabled>⏳ Scraping…</button>`
      : `<button class="ep-btn ep-btn-scrape" onclick="triggerScrape('${e.code}')">↻ Scrape</button>`;

    const viewBtn = e.lastRun
      ? `<button class="ep-btn ep-btn-view${active ? ' active' : ''}" onclick="loadElectionRun(${e.lastRun.id}, '${e.code}')">${active ? '✓ Viewing' : 'View'}</button>`
      : '';

    const stateChips = e.states.map(s => `<span class="ep-chip">${s.flag} ${s.name}</span>`).join('');

    return `<div class="ep-card${active ? ' ep-card-active' : ''}">
      <div class="ep-card-header">
        <div>
          <div class="ep-label">${e.label}</div>
          <div class="ep-name">${e.name}</div>
        </div>
        <div class="ep-actions">${viewBtn}${scrapeBtn}</div>
      </div>
      <div class="ep-chips">${stateChips}</div>
      ${lastRunHtml}
    </div>`;
  }).join('');
}

async function triggerScrape(electionCode) {
  const election = _elections.find(e => e.code === electionCode);
  if (!election) return;

  // Optimistically update UI
  election.scraping = true;
  renderElectionList();

  try {
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ electionCode }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed to start scrape');
      election.scraping = false;
      renderElectionList();
    }
    // SSE will send scrape-done / scrape-error events
  } catch (e) {
    election.scraping = false;
    renderElectionList();
  }
}

async function loadElectionRun(runId, electionCode) {
  const election = _elections.find(e => e.code === electionCode);
  if (!election) return;

  STATE.viewingRunId    = runId;
  STATE.currentElection = election;
  STATE.activeTab       = election.states[0].code;
  STATE.filterMode      = 'all';
  STATE.activeInsight   = null;
  STATE.selectedParty   = null;
  STATE.search          = '';
  STATE.page            = 1;

  // Update header to show which election we're viewing
  document.getElementById('election-label').textContent = election.name;
  document.getElementById('election-label').style.display = 'inline';
  document.getElementById('live-back-btn').style.display = 'inline-flex';

  renderStateTabs(election.states);
  renderElectionList();
  closeElectionDrawer();

  // Fetch data for this run
  document.getElementById('empty-state').style.display = 'block';
  document.getElementById('empty-state').innerHTML = '<div class="empty-icon">⏳</div><div>Loading results…</div>';
  document.getElementById('scoreboard-section').style.display = 'none';
  document.getElementById('insights').style.display = 'none';
  document.getElementById('status-banner').style.display = 'none';

  try {
    const res  = await fetch(`/api/results/${runId}`);
    const data = await res.json();
    STATE.allResults = data;
    renderState();
  } catch (e) {
    document.getElementById('empty-state').innerHTML =
      `<div class="empty-icon">❌</div><div>Failed to load results</div>`;
  }
}

function switchToLive() {
  STATE.viewingRunId    = null;
  STATE.currentElection = null;
  STATE.activeTab       = 'S03';
  STATE.filterMode      = 'all';
  STATE.activeInsight   = null;
  STATE.selectedParty   = null;
  STATE.search          = '';
  STATE.page            = 1;

  document.getElementById('election-label').style.display = 'none';
  document.getElementById('live-back-btn').style.display  = 'none';

  // Restore default May 2026 tabs
  renderStateTabs([
    { code: 'S03', name: 'Assam',       seats: 126, flag: '🏔️' },
    { code: 'S11', name: 'Kerala',      seats: 140, flag: '🌴' },
    { code: 'U07', name: 'Puducherry',  seats: 30,  flag: '🏖️' },
    { code: 'S22', name: 'Tamil Nadu',  seats: 234, flag: '🎭' },
    { code: 'S25', name: 'West Bengal', seats: 294, flag: '🐯' },
  ]);

  // Show live cache data
  if (STATE.liveResults) {
    STATE.allResults = STATE.liveResults;
    renderState();
  }
  renderElectionList();
}

// Handle SSE events for scrape status
function handleScrapeSSE(msg) {
  if (msg.type === 'scrape-started') {
    const e = _elections.find(el => el.code === msg.electionCode);
    if (e) { e.scraping = true; renderElectionList(); }
  } else if (msg.type === 'scrape-done') {
    const e = _elections.find(el => el.code === msg.electionCode);
    if (e) {
      e.scraping = false;
      e.lastRun  = { id: msg.runId, scrapedAt: msg.scrapedAt };
      renderElectionList();
    }
  } else if (msg.type === 'scrape-error') {
    const e = _elections.find(el => el.code === msg.electionCode);
    if (e) { e.scraping = false; renderElectionList(); }
    alert(`Scrape failed for ${msg.electionCode}: ${msg.error}`);
  }
}
