// ── Shared state ──────────────────────────────────────────────────────────────
const STATE = {
  allResults:      null,
  liveResults:     null,   // always holds the latest live scrape
  activeTab:       'S03',
  currentElection: null,   // null = viewing live (may2026)
  viewingRunId:    null,   // null = live view
  filtered:        [],
  page:            1,
  PAGE_SIZE:       50,
  search:          '',
  filterMode:      'all',
  activeInsight:   null,
  sortCol:         'constNo',
  sortAsc:         true,
  selectedParty:   null,
};


// ── SSE connection ────────────────────────────────────────────────────────────
const es = new EventSource('/events');

es.onmessage = e => {
  const msg = JSON.parse(e.data);

  // Live data events — only update UI if not viewing a historical run
  if (msg.type === 'loading') {
    if (!STATE.viewingRunId) {
      setStatus('loading', 'Fetching…');
      document.getElementById('loading-bar').style.display = 'block';
      if (STATE.allResults) renderState();
    }
  } else if (msg.type === 'error') {
    if (!STATE.viewingRunId) {
      setStatus('err', 'Error');
      document.getElementById('loading-bar').style.display = 'none';
      document.getElementById('error-box').style.display = 'block';
      document.getElementById('error-box').textContent = '⚠️ ' + msg.error;
      setTime(msg.lastUpdated);
    }
  } else if (msg.type === 'update') {
    setStatus('live', 'Live');
    document.getElementById('loading-bar').style.display = 'none';
    document.getElementById('error-box').style.display = 'none';
    setTime(msg.lastUpdated);
    STATE.liveResults = msg.payload;
    if (!STATE.viewingRunId) {
      STATE.allResults = msg.payload;
      updateTabBadges();
      renderState();
    }
  }
};

es.onerror = () => setStatus('err', 'Disconnected');

function setStatus(cls, lbl) {
  document.getElementById('dot').className = 'dot ' + cls;
  document.getElementById('status-lbl').textContent = lbl;
}

function setTime(ts) {
  if (!ts) return;
  document.getElementById('upd-time').textContent = new Date(ts).toLocaleTimeString('en-IN');
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(code) {
  STATE.activeTab     = code;
  STATE.filterMode    = 'all';
  STATE.activeInsight = null;
  STATE.selectedParty = null;
  STATE.search        = '';
  STATE.sortCol       = 'constNo';
  STATE.sortAsc       = true;
  STATE.page          = 1;
  document.getElementById('search-input').value = '';
  document.querySelectorAll('.filter-chip').forEach((c, i) => c.classList.toggle('on', i === 0));
  document.querySelectorAll('.state-tab').forEach(t => t.classList.toggle('active', t.dataset.code === code));
  renderState();
}

function updateTabBadges() {
  if (!STATE.allResults) return;
  const isGE = STATE.currentElection?.source === 'lokdhaba_ge';
  document.querySelectorAll('.state-tab').forEach(tab => {
    const code = tab.dataset.code;
    let d;
    if (code === 'IN' && isGE) {
      d = getAggregatedGEData();
    } else {
      d = STATE.allResults[code];
    }
    if (!d?.parties?.length) return;
    const leader = [...d.parties].sort((a, b) => b.total - a.total)[0];
    if (!leader) return;
    const abbr = partyAbbr(leader.party);
    const col  = partyColor(leader.party);
    let badge = tab.querySelector('.tab-leader');
    if (!badge) { badge = document.createElement('span'); badge.className = 'tab-leader'; tab.appendChild(badge); }
    badge.textContent      = `${abbr} ${leader.total}`;
    badge.style.background = col + '22';
    badge.style.color      = col;
    badge.style.border     = `1px solid ${col}44`;
    badge.style.display    = 'inline-block';
  });
}

// ── All-India GE aggregation ──────────────────────────────────────────────────
function getAggregatedGEData() {
  const all = STATE.allResults;
  if (!all) return null;
  const partyCounts    = {};
  const constituencies = [];
  for (const [stateCode, sd] of Object.entries(all)) {
    if (!sd) continue;
    for (const p of sd.parties || []) {
      if (!partyCounts[p.party]) partyCounts[p.party] = { party: p.party, won: 0, leading: 0, total: 0 };
      partyCounts[p.party].won     += p.won;
      partyCounts[p.party].leading += p.leading;
      partyCounts[p.party].total   += p.total;
    }
    for (const c of sd.constituencies || []) {
      constituencies.push({ ...c, _stateName: sd.name, _stateCode: stateCode });
    }
  }
  const election = STATE.currentElection;
  return {
    code:         'IN',
    name:         'All India',
    totalSeats:   election?.seats || constituencies.length,
    parties:      Object.values(partyCounts).sort((a, b) => b.total - a.total),
    constituencies,
    statusLine:   `Results declared — ${constituencies.length} of ${election?.seats || '?'} seats`,
  };
}

// ── Render orchestration ──────────────────────────────────────────────────────
function renderState() {
  const isGEAllIndia = STATE.activeTab === 'IN' && STATE.currentElection?.source === 'lokdhaba_ge';
  const d    = isGEAllIndia ? getAggregatedGEData() : STATE.allResults?.[STATE.activeTab];
  const meta = getStateMeta(STATE.activeTab);

  if (!d) {
    document.getElementById('status-banner').style.display      = 'none';
    document.getElementById('scoreboard-section').style.display = 'none';
    document.getElementById('insights').style.display           = 'none';
    document.getElementById('empty-state').style.display        = 'block';
    document.getElementById('empty-state').innerHTML            = `<div class="empty-icon">⏳</div><div>Fetching ${meta.name} results…</div>`;
    document.getElementById('tbody').innerHTML                  = '';
    document.getElementById('pagination').style.display         = 'none';
    return;
  }

  renderBanner(d, meta);
  renderScoreboard(d, meta);
  renderInsights(d, meta);
  applyAndRender(d);
}

// Helper exposed to table.js
function isGEAllIndiaView() {
  return STATE.activeTab === 'IN' && STATE.currentElection?.source === 'lokdhaba_ge';
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLeftPane();
});

