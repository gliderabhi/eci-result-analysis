function renderBanner(d, meta) {
  const won  = d.constituencies.filter(c => isDeclared(c)).length;
  const prog = d.constituencies.length - won;
  document.getElementById('status-banner').style.display = 'flex';
  document.getElementById('b-total').textContent     = meta.seats;
  document.getElementById('b-declared').textContent  = won;
  document.getElementById('b-counting').textContent  = prog;
  if (d.statusLine) {
    document.getElementById('b-status-text').textContent = d.statusLine;
    document.getElementById('b-status-wrap').style.display = 'block';
  }
}

function setFilter(mode, btn) {
  STATE.filterMode    = mode;
  STATE.activeInsight = null;
  STATE.selectedParty = null;
  STATE.page          = 1;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('on'));
  if (btn) btn.classList.add('on');
  const d = STATE.allResults?.[STATE.activeTab];
  if (d) applyAndRender(d);
}

function onSearch(v) {
  STATE.search = v;
  STATE.page   = 1;
  const d = STATE.allResults?.[STATE.activeTab];
  if (d) applyAndRender(d);
}

function sort(col) {
  if (STATE.sortCol === col) STATE.sortAsc = !STATE.sortAsc;
  else { STATE.sortCol = col; STATE.sortAsc = true; }
  document.querySelectorAll('thead th').forEach(t => t.classList.remove('sorted'));
  document.getElementById('th-' + col)?.classList.add('sorted');
  const d = STATE.allResults?.[STATE.activeTab];
  if (d) applyAndRender(d);
}

function applyAndRender(d) {
  let rows = [...d.constituencies];
  const fm = STATE.filterMode;

  if      (fm === 'won')       rows = rows.filter(r => isDeclared(r));
  else if (fm === 'progress')  rows = rows.filter(r => !isDeclared(r));
  else if (fm === 'tight')     rows = rows.filter(r => parseInt(r.margin) <= 1000 && parseInt(r.margin) > 0);
  else if (fm === 'close')     rows = rows.filter(r => parseInt(r.margin) > 1000 && parseInt(r.margin) <= 5000);
  else if (fm === 'landslide') rows = rows.filter(r => parseInt(r.margin) > 20000);
  else if (fm.startsWith('demo-')) {
    const dem = fm.replace('demo-', '');
    rows = rows.filter(r => r.demo?.majority === dem);
  }

  if (STATE.activeInsight && window._insightFns?.[STATE.activeInsight])
    rows = rows.filter(window._insightFns[STATE.activeInsight]);

  if (STATE.selectedParty) {
    rows = rows.filter(r =>
      partyAbbr(r.leadParty) === STATE.selectedParty ||
      partyAbbr(r.trailParty) === STATE.selectedParty ||
      r.leadParty.toUpperCase().includes(STATE.selectedParty) ||
      r.trailParty.toUpperCase().includes(STATE.selectedParty)
    );
  }

  if (STATE.search) {
    const t = STATE.search.toLowerCase();
    rows = rows.filter(r =>
      r.constituency.toLowerCase().includes(t) ||
      r.leadCandidate.toLowerCase().includes(t) ||
      r.trailCandidate.toLowerCase().includes(t) ||
      r.leadParty.toLowerCase().includes(t) ||
      r.trailParty.toLowerCase().includes(t)
    );
  }

  rows.sort((a, b) => {
    const sc = STATE.sortCol;
    const av = sc === 'demo' ? (a.demo?.majority || '') : (a[sc] || '');
    const bv = sc === 'demo' ? (b.demo?.majority || '') : (b[sc] || '');
    if (sc === 'constNo' || sc === 'margin') {
      return STATE.sortAsc ? (parseInt(av) || 0) - (parseInt(bv) || 0) : (parseInt(bv) || 0) - (parseInt(av) || 0);
    }
    return STATE.sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  STATE.filtered = rows;
  document.getElementById('result-count').textContent = rows.length + ' results';
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('tbody');
  const empty = document.getElementById('empty-state');
  const pag   = document.getElementById('pagination');

  if (!STATE.filtered.length) {
    tbody.innerHTML   = '';
    empty.style.display = 'block';
    empty.innerHTML   = '<div class="empty-icon">🔍</div><div>No matching constituencies</div>';
    pag.style.display = 'none';
    return;
  }
  empty.style.display = 'none';

  const start = (STATE.page - 1) * STATE.PAGE_SIZE;
  const rows  = STATE.filtered.slice(start, start + STATE.PAGE_SIZE);

  const showState = typeof isGEAllIndiaView === 'function' && isGEAllIndiaView();

  tbody.innerHTML = rows.map(r => {
    const m    = parseInt(r.margin) || 0;
    const mc   = m <= 1000 ? 'tight' : m <= 5000 ? 'close' : 'safe';
    const lc   = partyColor(r.leadParty);
    const tc   = partyColor(r.trailParty);
    const won  = isDeclared(r);
    const badge = won
      ? `<span class="badge badge-won">✓ Declared</span>`
      : `<span class="badge badge-prog">Counting ${r.round || ''}</span>`;
    const demo = r.demo || {};
    const demoBadge = demo.majority
      ? `<span style="font-size:.65rem;padding:2px 7px;border-radius:10px;border:1px solid ${demo.color}44;background:${demo.color}18;color:${demo.color};white-space:nowrap">${demo.emoji} ${demo.majority}</span>`
      : '—';
    const stateCell = showState
      ? `<td style="font-size:.72rem;color:var(--muted);white-space:nowrap">${r._stateName || ''}</td>`
      : '';

    return `<tr>
      <td class="const-num">${r.constNo}</td>
      <td>
        <div class="const-name">${r.constituency}</div>
        ${showState ? `<div style="font-size:.63rem;color:var(--dim)">${r._stateName || ''}</div>` : ''}
      </td>
      <td>${demoBadge}</td>
      <td>
        <div class="cand" style="color:${lc}"><span class="dot-inline" style="background:${lc}"></span>${r.leadCandidate || '—'}</div>
        <div class="cand-party">${r.leadParty || ''}</div>
      </td>
      <td>
        <div class="cand" style="color:${tc};opacity:.8"><span class="dot-inline" style="background:${tc}"></span>${r.trailCandidate || '—'}</div>
        <div class="cand-party">${r.trailParty || ''}</div>
      </td>
      <td><span class="margin-val ${mc}">${m > 0 ? fmtN(m) : '—'}</span></td>
      <td style="color:var(--muted);font-size:.75rem">${r.round || '—'}</td>
      <td>${badge}</td>
    </tr>`;
  }).join('');

  const total = Math.ceil(STATE.filtered.length / STATE.PAGE_SIZE);
  if (total <= 1) { pag.style.display = 'none'; return; }

  pag.style.display = 'flex';
  document.getElementById('page-info').textContent = `${start + 1}–${Math.min(start + STATE.PAGE_SIZE, STATE.filtered.length)} of ${STATE.filtered.length}`;
  document.getElementById('page-btns').innerHTML = (() => {
    const b = [`<button class="pbtn" onclick="goPage(${STATE.page - 1})" ${STATE.page === 1 ? 'disabled' : ''}>‹</button>`];
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - STATE.page) < 3)
        b.push(`<button class="pbtn${i === STATE.page ? ' cur' : ''}" onclick="goPage(${i})">${i}</button>`);
      else if (Math.abs(i - STATE.page) === 3)
        b.push(`<span style="color:var(--dim);padding:0 3px">…</span>`);
    }
    b.push(`<button class="pbtn" onclick="goPage(${STATE.page + 1})" ${STATE.page === total ? 'disabled' : ''}>›</button>`);
    return b.join('');
  })();
}

function goPage(p) {
  const total = Math.ceil(STATE.filtered.length / STATE.PAGE_SIZE);
  if (p < 1 || p > total) return;
  STATE.page = p;
  renderTable();
  document.querySelector('.table-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
