function renderStateTabs(states) {
  document.getElementById('state-tabs').innerHTML = states.map((s, i) =>
    `<div class="state-tab${i === 0 ? ' active' : ''}" data-code="${s.code}" onclick="switchTab('${s.code}')">
      <span class="tab-flag">${s.flag || '🗳️'}</span>
      <div><div>${s.name}</div><div class="tab-seats">${s.seats} seats</div></div>
    </div>`
  ).join('');
}
