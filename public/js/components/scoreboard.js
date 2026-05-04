function renderScoreboard(d, meta) {
  const maxTotal = Math.max(...d.parties.map(p => p.total), 1);
  document.getElementById('scoreboard-section').style.display = 'block';
  document.getElementById('majority-note').textContent = `Majority: ${meta.majority} of ${meta.seats} seats`;

  document.getElementById('scoreboard').innerHTML = d.parties.map(p => {
    const abbr = partyAbbr(p.party);
    const col  = partyColor(p.party);
    const pct  = Math.round(p.total / maxTotal * 100);
    const isSel = STATE.selectedParty === abbr;
    return `<div class="party-card${isSel ? ' selected' : ''}" onclick="togglePartyFilter('${abbr}')" title="${p.party}">
      <div class="party-abbr" style="color:${col}">${abbr}</div>
      <div class="party-full">${p.party}</div>
      <div class="party-nums">
        <div class="pn"><span class="pn-val won">${p.won}</span><span class="pn-lbl">Won</span></div>
        <div class="pn"><span class="pn-val lead">${p.leading}</span><span class="pn-lbl">Leading</span></div>
        <div class="pn"><span class="pn-val" style="color:var(--text)">${p.total}</span><span class="pn-lbl">Total</span></div>
      </div>
      <div class="party-bar"><div class="party-bar-fill" style="width:${pct}%;background:${col}"></div></div>
    </div>`;
  }).join('');
}

function togglePartyFilter(abbr) {
  STATE.selectedParty = STATE.selectedParty === abbr ? null : abbr;
  STATE.activeInsight = null;
  STATE.filterMode    = 'all';
  STATE.page          = 1;
  document.querySelectorAll('.filter-chip').forEach((c, i) => c.classList.toggle('on', i === 0));
  const d = STATE.allResults?.[STATE.activeTab];
  if (d) { renderScoreboard(d, getStateMeta(STATE.activeTab)); applyAndRender(d); }
}
