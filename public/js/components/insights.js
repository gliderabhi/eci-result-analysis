function renderInsights(d, meta) {
  const c          = d.constituencies;
  const withMargin = c.filter(r => parseInt(r.margin) > 0);
  const tight      = withMargin.filter(r => parseInt(r.margin) <= 1000);
  const close      = withMargin.filter(r => parseInt(r.margin) > 1000 && parseInt(r.margin) <= 5000);
  const landslide  = withMargin.filter(r => parseInt(r.margin) > 20000);
  const declared   = c.filter(r => isDeclared(r));
  const sorted     = [...withMargin].sort((a, b) => parseInt(b.margin) - parseInt(a.margin));
  const top        = sorted[0];
  const bot        = [...tight].sort((a, b) => parseInt(a.margin) - parseInt(b.margin))[0];

  const byDemo = {};
  c.forEach(r => { const maj = r.demo?.majority || 'Hindu'; byDemo[maj] = (byDemo[maj] || 0) + 1; });

  const DEMO_META = {
    Hindu:    { icon: '🕉️',  label: 'Hindu Majority Seats',    color: '#f59e0b' },
    Muslim:   { icon: '☪️',  label: 'Muslim Majority Seats',   color: '#10b981' },
    Christian:{ icon: '✝️',  label: 'Christian Majority Seats',color: '#3b82f6' },
    Mixed:    { icon: '🏳️', label: 'Tribal / Mixed Seats',     color: '#8b949e' },
  };

  const cards = [
    { id: 'declared',  icon: '✅', val: declared.length,            label: 'Results Declared', sub: `of ${c.length} reporting`, fn: r => isDeclared(r) },
    { id: 'counting',  icon: '⏳', val: c.length - declared.length, label: 'Still Counting',   sub: 'In progress',              fn: r => !isDeclared(r) },
    { id: 'tight',     icon: '🔴', val: tight.length,              label: 'Tight Contests',    sub: 'Margin ≤ 1,000 votes',     fn: r => parseInt(r.margin) <= 1000 && parseInt(r.margin) > 0 },
    { id: 'close',     icon: '🟡', val: close.length,              label: 'Close Contests',    sub: 'Margin 1,001–5,000',       fn: r => parseInt(r.margin) > 1000 && parseInt(r.margin) <= 5000 },
    { id: 'landslide', icon: '🟢', val: landslide.length,          label: 'Landslide Wins',    sub: 'Margin > 20,000',          fn: r => parseInt(r.margin) > 20000 },
    top ? { id: 'bigmargin', icon: '🏆', val: fmtN(parseInt(top.margin)), label: 'Biggest Margin', sub: top.constituency, fn: r => r.constituency === top.constituency } : null,
    bot ? { id: 'tightest',  icon: '⚡', val: fmtN(parseInt(bot.margin)), label: 'Tightest Race',  sub: bot.constituency, fn: r => r.constituency === bot.constituency } : null,
    ...Object.entries(DEMO_META).filter(([k]) => byDemo[k]).map(([k, m]) => ({
      id: 'demo-' + k, icon: m.icon, val: byDemo[k] || 0,
      label: m.label, sub: 'Census 2011 est.', color: m.color,
      fn: r => r.demo?.majority === k,
    })),
  ].filter(Boolean);

  window._insightFns = Object.fromEntries(cards.filter(cd => cd.fn).map(cd => [cd.id, cd.fn]));

  document.getElementById('insights').style.display = 'grid';
  document.getElementById('insights').innerHTML = cards.map(cd =>
    `<div class="insight-card${STATE.activeInsight === cd.id ? ' active' : ''}" onclick="setInsight('${cd.id}')">
      <div class="ins-icon">${cd.icon}</div>
      <div class="ins-value" style="${cd.color ? 'color:' + cd.color : ''}">${cd.val}</div>
      <div class="ins-label">${cd.label}</div>
      <div class="ins-sub">${cd.sub}</div>
    </div>`
  ).join('');
}

function setInsight(id) {
  STATE.activeInsight = STATE.activeInsight === id ? null : id;
  STATE.selectedParty = null;
  STATE.filterMode    = 'all';
  STATE.page          = 1;
  document.querySelectorAll('.filter-chip').forEach((c, i) => c.classList.toggle('on', i === 0));
  const d = STATE.allResults?.[STATE.activeTab];
  if (d) { renderInsights(d, getStateMeta(STATE.activeTab)); applyAndRender(d); }
}
