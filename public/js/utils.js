// Fallback meta for May 2026 states (used when no election is loaded yet)
const STATES_META = {
  S03: { name: 'Assam',       seats: 126, majority: 64,  flag: '🏔️' },
  S11: { name: 'Kerala',      seats: 140, majority: 71,  flag: '🌴' },
  U07: { name: 'Puducherry',  seats: 30,  majority: 16,  flag: '🏖️' },
  S22: { name: 'Tamil Nadu',  seats: 234, majority: 118, flag: '🎭' },
  S25: { name: 'West Bengal', seats: 294, majority: 148, flag: '🐯' },
};

const PARTY_COLORS = {
  TVK:'#f59e0b', DMK:'#dc2626', ADMK:'#16a34a', AIUDF:'#7c3aed',
  BJP:'#ea580c', INC:'#2563eb', AGP:'#0891b2', BPF:'#0d9488',
  UPPL:'#d97706', TMC:'#2dd4bf', 'TMC(M)':'#14b8a6', CPIM:'#ec4899',
  CPI:'#db2777', VCK:'#65a30d', PMK:'#7c3aed', IUML:'#0891b2',
  NCP:'#9333ea', RSP:'#e11d48', AITC:'#2dd4bf', ISF:'#6366f1',
  SUCI:'#f43f5e', BSPF:'#84cc16', JMM:'#0ea5e9', SS:'#f97316',
  NCP:'#9333ea', MNS:'#dc2626', SHS:'#f97316', BJP:'#ea580c',
  JCC:'#6366f1', INC:'#2563eb', TRS:'#ec4899', AIMIM:'#16a34a',
};

function getStateMeta(code) {
  if (STATE.currentElection) {
    const s = STATE.currentElection.states.find(st => st.code === code);
    if (s) return s;
  }
  return STATES_META[code] || { name: code, seats: 0, majority: 0, flag: '🗳️' };
}

function isDeclared(r) {
  return r.status && r.status.toLowerCase().includes('result declared');
}

function fmtN(n) {
  return Number(n).toLocaleString('en-IN');
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function partyColor(name) {
  if (!name) return '#6b7280';
  for (const [k, v] of Object.entries(PARTY_COLORS)) {
    if (name.toUpperCase().includes(k)) return v;
  }
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return `hsl(${h % 360},50%,52%)`;
}

function partyAbbr(name) {
  if (!name) return '?';
  const m = name.match(/- ([A-Z()\d]+)$/);
  if (m) return m[1];
  return name.split(' ').filter(w => w.length > 2).map(w => w[0]).join('').slice(0, 5).toUpperCase()
    || name.slice(0, 4).toUpperCase();
}
