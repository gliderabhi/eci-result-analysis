// ── Election Picker (side drawer) ─────────────────────────────────────────────

let _elections = [];

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

  // Separate live ECI election from historical
  const liveElections = _elections.filter(e => e.source === 'eci');
  const historical    = _elections.filter(e => e.source === 'lokdhaba');

  // Group historical by state
  const byState = {};
  for (const e of historical) {
    const stateName = e.states[0]?.name || e.code;
    if (!byState[stateName]) byState[stateName] = [];
    byState[stateName].push(e);
  }

  let html = '';

  // Live section
  if (liveElections.length) {
    html += `<div class="ep-section-label">Live / Recent</div>`;
    html += liveElections.map(e => electionCard(e)).join('');
  }

  // Historical grouped by state
  html += `<div class="ep-section-label">Past Elections (Lok Dhaba)</div>`;
  for (const [stateName, elections] of Object.entries(byState).sort()) {
    const flag = elections[0].states[0]?.flag || '🗳️';
    const years = elections
      .sort((a, b) => {
        const ya = parseInt(a.code.split('_').pop());
        const yb = parseInt(b.code.split('_').pop());
        return yb - ya;
      })
      .map(e => {
        const year = e.code.split('_').pop();
        const active = STATE.currentElection?.code === e.code;
        return `<button class="ep-year-btn${active ? ' active' : ''}" onclick="loadElectionRun(${e.lastRun.id}, '${e.code}')">${year}</button>`;
      }).join('');

    html += `<div class="ep-state-row">
      <span class="ep-state-name">${flag} ${stateName}</span>
      <div class="ep-year-btns">${years}</div>
    </div>`;
  }

  container.innerHTML = html;
}

function electionCard(e) {
  const isCurrent = STATE.currentElection?.code === e.code;
  const isLive    = e.code === 'may2026' && !STATE.viewingRunId && !STATE.currentElection;
  const active    = isCurrent || isLive;
  const stateChips = e.states.map(s => `<span class="ep-chip">${s.flag} ${s.name}</span>`).join('');
  const viewBtn = `<button class="ep-btn ep-btn-view${active ? ' active' : ''}" onclick="loadElectionRun(${e.lastRun.id}, '${e.code}')">${active ? '✓ Viewing' : 'View'}</button>`;
  return `<div class="ep-card${active ? ' ep-card-active' : ''}">
    <div class="ep-card-header">
      <div>
        <div class="ep-label">${e.label}</div>
        <div class="ep-name">${e.name}</div>
      </div>
      <div class="ep-actions">${viewBtn}</div>
    </div>
    <div class="ep-chips">${stateChips}</div>
  </div>`;
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

  document.getElementById('election-label').textContent = election.name;
  document.getElementById('election-label').style.display = 'inline';
  document.getElementById('live-back-btn').style.display = 'inline-flex';

  renderStateTabs(election.states);
  renderElectionList();
  closeElectionDrawer();

  document.getElementById('empty-state').style.display = 'block';
  document.getElementById('empty-state').innerHTML = '<div class="empty-icon">⏳</div><div>Loading results…</div>';
  document.getElementById('scoreboard-section').style.display = 'none';
  document.getElementById('insights').style.display = 'none';
  document.getElementById('status-banner').style.display = 'none';

  try {
    const res  = await fetch(`/api/results/${runId}`);
    const data = await res.json();
    STATE.allResults = data;
    updateTabBadges();
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

  renderStateTabs([
    { code: 'S03', name: 'Assam',       seats: 126, flag: '🍵' },
    { code: 'S11', name: 'Kerala',      seats: 140, flag: '🌴' },
    { code: 'U07', name: 'Puducherry',  seats: 30,  flag: '🏖️' },
    { code: 'S22', name: 'Tamil Nadu',  seats: 234, flag: '🎭' },
    { code: 'S25', name: 'West Bengal', seats: 294, flag: '🐯' },
  ]);

  if (STATE.liveResults) {
    STATE.allResults = STATE.liveResults;
    updateTabBadges();
    renderState();
  }
  renderElectionList();
}
