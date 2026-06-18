const { execFile } = require('child_process');
const zlib = require('zlib');
const { parse } = require('csv-parse');
const db = require('./db');

const STATE_META = {
  'Andhra_Pradesh':  { code: 'S01', flag: '🌶️', name: 'Andhra Pradesh' },
  'Arunachal_Pradesh': { code: 'S02', flag: '🏔️', name: 'Arunachal Pradesh' },
  'Assam':           { code: 'S03', flag: '🍵', name: 'Assam' },
  'Bihar':           { code: 'S04', flag: '🌾', name: 'Bihar' },
  'Chhattisgarh':    { code: 'S05', flag: '🌲', name: 'Chhattisgarh' },
  'Goa':             { code: 'S06', flag: '🏖️', name: 'Goa' },
  'Gujarat':         { code: 'S07', flag: '🦁', name: 'Gujarat' },
  'Haryana':         { code: 'S08', flag: '🌾', name: 'Haryana' },
  'Himachal_Pradesh':{ code: 'S09', flag: '❄️', name: 'Himachal Pradesh' },
  'Jharkhand':       { code: 'S10', flag: '🌿', name: 'Jharkhand' },
  'Karnataka':       { code: 'S12', flag: '🐘', name: 'Karnataka' },
  'Kerala':          { code: 'S11', flag: '🌴', name: 'Kerala' },
  'Madhya_Pradesh':  { code: 'S13', flag: '🐆', name: 'Madhya Pradesh' },
  'Maharashtra':     { code: 'S14', flag: '🏙️', name: 'Maharashtra' },
  'Manipur':         { code: 'S15', flag: '🎭', name: 'Manipur' },
  'Meghalaya':       { code: 'S16', flag: '☁️', name: 'Meghalaya' },
  'Mizoram':         { code: 'S17', flag: '⛰️', name: 'Mizoram' },
  'Nagaland':        { code: 'S18', flag: '🗡️', name: 'Nagaland' },
  'Odisha':          { code: 'S19', flag: '🛕', name: 'Odisha' },
  'Punjab':          { code: 'S20', flag: '🌾', name: 'Punjab' },
  'Rajasthan':       { code: 'S21', flag: '🏜️', name: 'Rajasthan' },
  'Sikkim':          { code: 'S22s', flag: '🏔️', name: 'Sikkim' },
  'Tamil_Nadu':      { code: 'S22', flag: '🎭', name: 'Tamil Nadu' },
  'Telangana':       { code: 'S23', flag: '🌶️', name: 'Telangana' },
  'Tripura':         { code: 'S24', flag: '🏕️', name: 'Tripura' },
  'Uttar_Pradesh':   { code: 'S25up', flag: '🕌', name: 'Uttar Pradesh' },
  'Uttarakhand':     { code: 'S25uk', flag: '🏔️', name: 'Uttarakhand' },
  'West_Bengal':     { code: 'S25', flag: '🐯', name: 'West Bengal' },
  'Delhi':           { code: 'U05', flag: '🏛️', name: 'Delhi' },
  'Puducherry':      { code: 'U07', flag: '🏖️', name: 'Puducherry' },
};

const MIN_YEAR = 2010;

function fetchCsv(stateKey) {
  return new Promise((resolve, reject) => {
    const url = `https://lokdhaba.ashoka.edu.in/downloads/${stateKey}/${stateKey}_AE.csv.gz`;
    execFile('curl', ['-sL', '--max-time', '60', url], { maxBuffer: 50 * 1024 * 1024, encoding: 'buffer' }, (err, stdout) => {
      if (err) return reject(err);
      zlib.gunzip(stdout, (err2, buf) => {
        if (err2) return reject(err2);
        const rows = [];
        const parser = parse(buf.toString('utf8'), { columns: true, skip_empty_lines: true, relax_quotes: true });
        parser.on('data', r => rows.push(r));
        parser.on('end', () => resolve(rows));
        parser.on('error', reject);
      });
    });
  });
}

function processElection(stateKey, year, rows, meta) {
  const electionCode = `${stateKey}_${year}`;

  // Group by constituency
  const byConst = {};
  for (const r of rows) {
    const key = r.Constituency_No || r.Constituency_Name;
    if (!byConst[key]) byConst[key] = [];
    byConst[key].push(r);
  }

  const constituencies = [];
  const partyCounts = {};

  for (const [, candidates] of Object.entries(byConst)) {
    candidates.sort((a, b) => parseInt(a.Position || 99) - parseInt(b.Position || 99));
    const winner   = candidates.find(c => c.Position === '1');
    const runnerup = candidates.find(c => c.Position === '2');
    if (!winner) continue;

    const party = winner.Party || 'IND';
    partyCounts[party] = (partyCounts[party] || 0) + 1;

    constituencies.push({
      constNo:        winner.Constituency_No,
      constituency:   winner.Constituency_Name,
      leadCandidate:  winner.Candidate,
      leadParty:      party,
      trailCandidate: runnerup?.Candidate || '',
      trailParty:     runnerup?.Party || '',
      margin:         winner.Margin || '0',
      round:          '',
      status:         'Result Declared',
    });
  }

  if (constituencies.length === 0) return null;

  const parties = Object.entries(partyCounts)
    .map(([party, won]) => ({ party, won, leading: 0, total: won }))
    .sort((a, b) => b.won - a.won);

  const seats = constituencies.length;
  const majority = Math.ceil(seats / 2);

  db.upsertElectionMeta({
    code:       electionCode,
    label:      `${meta.name} ${year}`,
    name:       `${meta.name} Assembly Election ${year}`,
    state_name: meta.name,
    state_code: meta.code,
    seats,
    flag:       meta.flag,
    majority,
  });

  const data = {
    [meta.code]: {
      code: meta.code,
      name: meta.name,
      totalSeats: seats,
      scrapedAt: new Date().toISOString(),
      statusLine: `Results declared — ${seats} constituencies`,
      parties,
      constituencies,
    }
  };

  db.saveRun(electionCode, new Date().toISOString(), data);
  return constituencies.length;
}

async function importState(stateKey) {
  const meta = STATE_META[stateKey];
  if (!meta) { console.log(`  skipping ${stateKey} — no meta`); return; }

  console.log(`\n[${stateKey}] Downloading…`);
  let rows;
  try {
    rows = await fetchCsv(stateKey);
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    return;
  }
  console.log(`  ${rows.length} candidate rows`);

  // Group by year — only general elections (month not empty) and within year range
  const byYear = {};
  for (const r of rows) {
    const year = parseInt(r.Year);
    if (year < MIN_YEAR) continue;
    if (!r.month || r.month.trim() === '') continue; // skip by-elections
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(r);
  }

  for (const [year, yearRows] of Object.entries(byYear)) {
    const n = processElection(stateKey, year, yearRows, meta);
    if (n) console.log(`  ${year}: ${n} constituencies saved`);
  }
}

async function main() {
  const states = Object.keys(STATE_META);
  for (const s of states) {
    await importState(s);
  }
  console.log('\nDone.');
}

main().catch(console.error);
