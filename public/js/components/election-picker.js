// ── Left Pane ─────────────────────────────────────────────────────────────────

let _elections   = [];
let _leftTab     = 'live';
let _fetchingSet = new Set(); // stateKeys currently being fetched

// All states that have AE elections on Lok Dhaba
const AE_STATE_LIST = [
  { key: 'Andhra_Pradesh',    name: 'Andhra Pradesh',    flag: '🌶️' },
  { key: 'Arunachal_Pradesh', name: 'Arunachal Pradesh', flag: '🏔️' },
  { key: 'Assam',             name: 'Assam',             flag: '🍵'  },
  { key: 'Bihar',             name: 'Bihar',             flag: '🌾'  },
  { key: 'Chhattisgarh',      name: 'Chhattisgarh',      flag: '🌲'  },
  { key: 'Goa',               name: 'Goa',               flag: '🏖️' },
  { key: 'Gujarat',           name: 'Gujarat',           flag: '🦁'  },
  { key: 'Haryana',           name: 'Haryana',           flag: '🌾'  },
  { key: 'Himachal_Pradesh',  name: 'Himachal Pradesh',  flag: '❄️'  },
  { key: 'Jharkhand',         name: 'Jharkhand',         flag: '🌿'  },
  { key: 'Karnataka',         name: 'Karnataka',         flag: '🐘'  },
  { key: 'Kerala',            name: 'Kerala',            flag: '🌴'  },
  { key: 'Madhya_Pradesh',    name: 'Madhya Pradesh',    flag: '🐆'  },
  { key: 'Maharashtra',       name: 'Maharashtra',       flag: '🏙️' },
  { key: 'Manipur',           name: 'Manipur',           flag: '🎭'  },
  { key: 'Meghalaya',         name: 'Meghalaya',         flag: '☁️'  },
  { key: 'Mizoram',           name: 'Mizoram',           flag: '⛰️'  },
  { key: 'Nagaland',          name: 'Nagaland',          flag: '🗡️'  },
  { key: 'Odisha',            name: 'Odisha',            flag: '🛕'  },
  { key: 'Punjab',            name: 'Punjab',            flag: '🌾'  },
  { key: 'Rajasthan',         name: 'Rajasthan',         flag: '🏜️' },
  { key: 'Sikkim',            name: 'Sikkim',            flag: '🏔️'  },
  { key: 'Tamil_Nadu',        name: 'Tamil Nadu',        flag: '🎭'  },
  { key: 'Telangana',         name: 'Telangana',         flag: '🌶️' },
  { key: 'Tripura',           name: 'Tripura',           flag: '🏕️'  },
  { key: 'Uttar_Pradesh',     name: 'Uttar Pradesh',     flag: '🕌'  },
  { key: 'Uttarakhand',       name: 'Uttarakhand',       flag: '🏔️'  },
  { key: 'West_Bengal',       name: 'West Bengal',       flag: '🐯'  },
  { key: 'Delhi',             name: 'Delhi',             flag: '🏛️' },
  { key: 'Puducherry',        name: 'Puducherry',        flag: '🏖️' },
];

// ── Init & reload ──────────────────────────────────────────────────────────────
async function initLeftPane() {
  try {
    const res = await fetch('/api/elections');
    _elections = await res.json();
  } catch (_) {
    _elections = [];
  }
  renderLeftPane();
}

async function reloadElections() {
  try {
    const res = await fetch('/api/elections');
    _elections = await res.json();
  } catch (_) {}
  renderLeftPaneContent();
}

// ── Tab switching ──────────────────────────────────────────────────────────────
function switchLeftTab(tab) {
  _leftTab = tab;
  document.querySelectorAll('.lp-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  renderLeftPaneContent();
}

function renderLeftPane() {
  // Set initial tab active class
  document.querySelectorAll('.lp-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === _leftTab)
  );
  renderLeftPaneContent();
}

function renderLeftPaneContent() {
  const el = document.getElementById('lp-content');
  if (!el) return;
  switch (_leftTab) {
    case 'live':   el.innerHTML = renderLiveTabHTML();   break;
    case 'ge':     el.innerHTML = renderGETabHTML();     break;
    case 'ae':     el.innerHTML = renderAETabHTML();     break;
    case 'bypoll': el.innerHTML = renderByPollTabHTML(); break;
  }
}

// ── Live tab ───────────────────────────────────────────────────────────────────
function renderLiveTabHTML() {
  const liveElections = _elections.filter(e => e.source === 'eci');
  if (!liveElections.length) {
    return `<div class="lp-spinner">No live election data</div>`;
  }
  let html = '';
  for (const e of liveElections) {
    html += `<div class="lp-section">${e.label} — ${e.name}</div>`;
    for (const s of e.states) {
      const active = !STATE.viewingRunId && STATE.activeTab === s.code;
      html += `<div class="lp-live-item${active ? ' active' : ''}" onclick="selectLiveState('${s.code}')">
        <span class="lp-live-flag">${s.flag || '🗳️'}</span>
        <div>
          <div class="lp-live-name">${s.name}</div>
          <div class="lp-live-seats">${s.seats} seats · majority ${s.majority}</div>
        </div>
      </div>`;
    }
  }
  return html;
}

function selectLiveState(code) {
  if (STATE.viewingRunId) switchToLive();
  switchTab(code);
  renderLeftPaneContent();
}

// ── GE tab ─────────────────────────────────────────────────────────────────────
function renderGETabHTML() {
  const ge = _elections.filter(e => e.source === 'lokdhaba_ge');
  if (!ge.length) {
    return `<div class="lp-spinner">No GE data loaded.<br><br>Run:<br><code>node import-lokdhaba-ge.js</code></div>`;
  }
  let html = `<div class="lp-section">Lok Sabha General Elections</div>`;
  for (const e of ge) {
    const year   = e.code.split('_').pop();
    const active = STATE.currentElection?.code === e.code;
    html += `<div class="lp-ge-item${active ? ' active' : ''}" onclick="loadElectionRun(${e.lastRun.id}, '${e.code}')">
      <div>
        <div class="lp-ge-year">🇮🇳 Lok Sabha ${year}</div>
        <div class="lp-ge-meta">${e.seats} seats · ${e.states.length} states/UTs</div>
      </div>
      <span class="lp-ge-badge${active ? '' : ''}">${active ? '✓ Viewing' : year}</span>
    </div>`;
  }

  // offer to fetch a year not yet imported
  const loadedYears = new Set(ge.map(e => e.code.split('_').pop()));
  const knownYears  = ['2024', '2019', '2014', '2009', '2004'];
  const missing     = knownYears.filter(y => !loadedYears.has(y));
  if (missing.length) {
    html += `<div class="lp-section">Not Yet Loaded</div>`;
    for (const y of missing) {
      const fetching = _fetchingSet.has(`GE_${y}`);
      html += `<div class="lp-ge-item">
        <div>
          <div class="lp-ge-year" style="color:var(--muted)">🇮🇳 Lok Sabha ${y}</div>
          <div class="lp-ge-meta">Not in database</div>
        </div>
        <span class="lp-ge-badge fetching" style="cursor:pointer" onclick="fetchGEYear(${y})">${fetching ? '⏳ Loading…' : '⬇ Fetch'}</span>
      </div>`;
    }
  }
  return html;
}

async function fetchGEYear(year) {
  if (_fetchingSet.has(`GE_${year}`)) return;
  _fetchingSet.add(`GE_${year}`);
  renderLeftPaneContent();
  try {
    const res = await fetch(`/api/fetch-ge/${year}`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'fetch failed');
    await reloadElections();
  } catch (e) {
    alert(`Failed to fetch GE ${year}: ${e.message}`);
  } finally {
    _fetchingSet.delete(`GE_${year}`);
    renderLeftPaneContent();
  }
}

// ── AE tab ─────────────────────────────────────────────────────────────────────
function renderAETabHTML() {
  // Build a map: stateKey → [{code, year, runId}]
  const aeElections = _elections.filter(e => e.source === 'lokdhaba');
  const byStateKey  = {};
  for (const e of aeElections) {
    // code like "West_Bengal_2021" → key = "West_Bengal", year = "2021"
    const parts    = e.code.split('_');
    const year     = parts[parts.length - 1];
    const stateKey = parts.slice(0, -1).join('_');
    if (!byStateKey[stateKey]) byStateKey[stateKey] = [];
    byStateKey[stateKey].push({ code: e.code, year, runId: e.lastRun.id });
  }

  const activeCode = STATE.currentElection?.code;

  let html = '';
  for (const s of AE_STATE_LIST) {
    const loaded  = byStateKey[s.key] || [];
    loaded.sort((a, b) => parseInt(b.year) - parseInt(a.year));

    const fetching = _fetchingSet.has(s.key);

    let yearsHTML = '';
    for (const item of loaded) {
      const active = activeCode === item.code;
      yearsHTML += `<button class="lp-year-btn${active ? ' active' : ''}" onclick="loadElectionRun(${item.runId}, '${item.code}')">${item.year}</button>`;
    }
    if (!fetching) {
      yearsHTML += `<button class="lp-fetch-btn" onclick="fetchAEState('${s.key}')" title="Load from Lok Dhaba">${loaded.length ? '↻' : '⬇ Load'}</button>`;
    } else {
      yearsHTML += `<button class="lp-fetch-btn loading" disabled>⏳</button>`;
    }

    html += `<div class="lp-ae-state">
      <div class="lp-ae-state-header">
        <span class="lp-ae-flag">${s.flag}</span>
        <span class="lp-ae-name">${s.name}</span>
      </div>
      <div class="lp-ae-years">${yearsHTML}</div>
    </div>`;
  }
  return html;
}

async function fetchAEState(stateKey) {
  if (_fetchingSet.has(stateKey)) return;
  _fetchingSet.add(stateKey);
  renderLeftPaneContent();
  try {
    const res  = await fetch(`/api/fetch-ae/${stateKey}`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'fetch failed');
    await reloadElections();
  } catch (e) {
    alert(`Failed to fetch ${stateKey}: ${e.message}`);
  } finally {
    _fetchingSet.delete(stateKey);
    renderLeftPaneContent();
  }
}

// ── By Polls tab ───────────────────────────────────────────────────────────────
function renderByPollTabHTML() {
  return `<div class="lp-coming-soon">
    <div class="lp-cs-icon">🗳️</div>
    <div class="lp-cs-title">By-Elections</div>
    <div class="lp-cs-sub">Coming soon — individual constituency<br>by-polls from Lok Dhaba</div>
  </div>`;
}

// ── Election loading ───────────────────────────────────────────────────────────
async function loadElectionRun(runId, electionCode) {
  const election = _elections.find(e => e.code === electionCode);
  if (!election) return;

  const isGE = election.source === 'lokdhaba_ge';

  STATE.viewingRunId    = runId;
  STATE.currentElection = election;
  STATE.activeTab       = isGE ? 'IN' : election.states[0].code;
  STATE.filterMode      = 'all';
  STATE.activeInsight   = null;
  STATE.selectedParty   = null;
  STATE.search          = '';
  STATE.page            = 1;

  document.getElementById('election-label').textContent = isGE
    ? `🇮🇳 ${election.name}`
    : election.name;
  document.getElementById('election-label').style.display = 'inline';
  document.getElementById('live-back-btn').style.display  = 'inline-flex';

  if (isGE) {
    const allIndiaTab = { code: 'IN', name: 'All India', seats: election.seats, flag: '🇮🇳', majority: election.majority };
    renderStateTabs([allIndiaTab, ...election.states]);
  } else {
    renderStateTabs(election.states);
  }
  renderLeftPaneContent(); // refresh highlights

  document.getElementById('empty-state').style.display  = 'block';
  document.getElementById('empty-state').innerHTML      = '<div class="empty-icon">⏳</div><div>Loading results…</div>';
  document.getElementById('scoreboard-section').style.display = 'none';
  document.getElementById('insights').style.display           = 'none';
  document.getElementById('status-banner').style.display      = 'none';

  try {
    const res  = await fetch(`/api/results/${runId}`);
    const data = await res.json();
    STATE.allResults = data;
    updateTabBadges();
    renderState();
  } catch (_) {
    document.getElementById('empty-state').innerHTML =
      `<div class="empty-icon">❌</div><div>Failed to load results</div>`;
  }
}

// ── Back to Live ───────────────────────────────────────────────────────────────
function switchToLive() {
  STATE.viewingRunId    = null;
  STATE.currentElection = null;
  STATE.activeTab       = 'S03';
  STATE.filterMode      = 'all';
  STATE.activeInsight   = null;
  STATE.selectedParty   = null;
  STATE.search          = '';
  STATE.page            = 1;

  document.getElementById('election-label').style.display  = 'none';
  document.getElementById('live-back-btn').style.display   = 'none';

  renderStateTabs([
    { code: 'S03', name: 'Assam',       seats: 126, flag: '🍵',  majority: 64  },
    { code: 'S11', name: 'Kerala',      seats: 140, flag: '🌴',  majority: 71  },
    { code: 'U07', name: 'Puducherry',  seats: 30,  flag: '🏖️', majority: 16  },
    { code: 'S22', name: 'Tamil Nadu',  seats: 234, flag: '🎭',  majority: 118 },
    { code: 'S25', name: 'West Bengal', seats: 294, flag: '🐯',  majority: 148 },
  ]);

  // Sync left pane to Live tab and refresh highlights
  _leftTab = 'live';
  document.querySelectorAll('.lp-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === 'live')
  );
  renderLeftPaneContent();

  if (STATE.liveResults) {
    STATE.allResults = STATE.liveResults;
    updateTabBadges();
    renderState();
  }
}
