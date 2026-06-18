const { execFile } = require('child_process');
const zlib = require('zlib');
const { parse } = require('csv-parse');
const db = require('./db');

const GE_STATE_META = {
  'Andhra_Pradesh':    { code: 'AP', flag: '🌶️',  name: 'Andhra Pradesh' },
  'Arunachal_Pradesh': { code: 'AR', flag: '🏔️',  name: 'Arunachal Pradesh' },
  'Assam':             { code: 'AS', flag: '🍵',   name: 'Assam' },
  'Bihar':             { code: 'BR', flag: '🌾',   name: 'Bihar' },
  'Chhattisgarh':      { code: 'CG', flag: '🌲',   name: 'Chhattisgarh' },
  'Goa':               { code: 'GA', flag: '🏖️',  name: 'Goa' },
  'Gujarat':           { code: 'GJ', flag: '🦁',   name: 'Gujarat' },
  'Haryana':           { code: 'HR', flag: '🌾',   name: 'Haryana' },
  'Himachal_Pradesh':  { code: 'HP', flag: '❄️',   name: 'Himachal Pradesh' },
  'Jammu_Kashmir':     { code: 'JK', flag: '🏔️',  name: 'Jammu & Kashmir' },
  'Jharkhand':         { code: 'JH', flag: '🌿',   name: 'Jharkhand' },
  'Karnataka':         { code: 'KA', flag: '🐘',   name: 'Karnataka' },
  'Kerala':            { code: 'KL', flag: '🌴',   name: 'Kerala' },
  'Madhya_Pradesh':    { code: 'MP', flag: '🐆',   name: 'Madhya Pradesh' },
  'Maharashtra':       { code: 'MH', flag: '🏙️',  name: 'Maharashtra' },
  'Manipur':           { code: 'MN', flag: '🎭',   name: 'Manipur' },
  'Meghalaya':         { code: 'ML', flag: '☁️',   name: 'Meghalaya' },
  'Mizoram':           { code: 'MZ', flag: '⛰️',   name: 'Mizoram' },
  'Nagaland':          { code: 'NL', flag: '🗡️',   name: 'Nagaland' },
  'Odisha':            { code: 'OD', flag: '🛕',   name: 'Odisha' },
  'Punjab':            { code: 'PB', flag: '🌾',   name: 'Punjab' },
  'Rajasthan':         { code: 'RJ', flag: '🏜️',  name: 'Rajasthan' },
  'Sikkim':            { code: 'SK', flag: '🏔️',  name: 'Sikkim' },
  'Tamil_Nadu':        { code: 'TN', flag: '🎭',   name: 'Tamil Nadu' },
  'Telangana':         { code: 'TS', flag: '🌶️',  name: 'Telangana' },
  'Tripura':           { code: 'TR', flag: '🏕️',  name: 'Tripura' },
  'Uttar_Pradesh':     { code: 'UP', flag: '🕌',   name: 'Uttar Pradesh' },
  'Uttarakhand':       { code: 'UK', flag: '🏔️',  name: 'Uttarakhand' },
  'West_Bengal':       { code: 'WB', flag: '🐯',   name: 'West Bengal' },
  'Delhi':             { code: 'DL', flag: '🏛️',  name: 'Delhi' },
  'Puducherry':        { code: 'PY', flag: '🏖️',  name: 'Puducherry' },
  'Chandigarh':        { code: 'CH', flag: '🏙️',  name: 'Chandigarh' },
  'Lakshadweep':       { code: 'LD', flag: '🏝️',  name: 'Lakshadweep' },
  'Andaman_Nicobar_Islands': { code: 'AN', flag: '🏝️', name: 'Andaman & Nicobar' },
  'Dadra_Nagar_Haveli_Daman_Diu': { code: 'DN', flag: '🌊', name: 'Dadra & NH + Daman & Diu' },
};

const MIN_YEAR = 2004;

function fetchGeCsv(stateKey) {
  return new Promise((resolve, reject) => {
    const url = `https://lokdhaba.ashoka.edu.in/downloads/${stateKey}/${stateKey}_GE.csv.gz`;
    execFile('curl', ['-sL', '--max-time', '90', url], { maxBuffer: 100 * 1024 * 1024, encoding: 'buffer' }, (err, stdout) => {
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

function processGEYear(year, byState) {
  const electionCode = `GE_${year}`;
  const allData = {};
  let totalSeats = 0;

  for (const [stateKey, rows] of Object.entries(byState)) {
    const meta = GE_STATE_META[stateKey];
    if (!meta) continue;

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

    if (constituencies.length === 0) continue;

    const parties = Object.entries(partyCounts)
      .map(([party, won]) => ({ party, won, leading: 0, total: won }))
      .sort((a, b) => b.won - a.won);

    totalSeats += constituencies.length;

    allData[meta.code] = {
      code:       meta.code,
      name:       meta.name,
      totalSeats: constituencies.length,
      scrapedAt:  new Date().toISOString(),
      statusLine: `Results declared — ${constituencies.length} Lok Sabha seats`,
      parties,
      constituencies,
    };
  }

  if (Object.keys(allData).length === 0) return 0;

  db.upsertElectionMeta({
    code:        electionCode,
    label:       `Lok Sabha ${year}`,
    name:        `General Election (Lok Sabha) ${year}`,
    state_name:  'India',
    state_code:  'IN',
    seats:       totalSeats,
    flag:        '🇮🇳',
    majority:    Math.ceil(totalSeats / 2),
    election_type: 'GE',
  });

  db.saveRun(electionCode, new Date().toISOString(), allData);
  return totalSeats;
}

async function importGEYear(targetYear) {
  const states = Object.keys(GE_STATE_META);
  const byState = {};
  for (const stateKey of states) {
    let rows;
    try { rows = await fetchGeCsv(stateKey); } catch (e) { continue; }
    for (const r of rows) {
      if (parseInt(r.Year) !== targetYear) continue;
      if (r.Election_Type && !r.Election_Type.includes('GE')) continue;
      if (!r.month || r.month.trim() === '') continue;
      if (!byState[stateKey]) byState[stateKey] = [];
      byState[stateKey].push(r);
    }
  }
  return processGEYear(targetYear, byState);
}

async function main() {
  const states = Object.keys(GE_STATE_META);

  // accumulate all rows per year across all states
  const byYear = {};

  for (const stateKey of states) {
    console.log(`\n[${stateKey}] Downloading GE data…`);
    let rows;
    try {
      rows = await fetchGeCsv(stateKey);
    } catch (e) {
      console.log(`  SKIP: ${e.message}`);
      continue;
    }
    console.log(`  ${rows.length} candidate rows`);

    for (const r of rows) {
      const year = parseInt(r.Year);
      if (year < MIN_YEAR) continue;
      if (r.Election_Type && !r.Election_Type.includes('GE')) continue;
      // skip by-elections — same convention as AE: by-polls have no month value
      if (!r.month || r.month.trim() === '') continue;
      if (!byYear[year]) byYear[year] = {};
      if (!byYear[year][stateKey]) byYear[year][stateKey] = [];
      byYear[year][stateKey].push(r);
    }
  }

  for (const [year, byState] of Object.entries(byYear).sort()) {
    const n = processGEYear(parseInt(year), byState);
    console.log(`\nGE ${year}: ${n} total seats saved`);
  }

  console.log('\nDone — Lok Sabha import complete.');
}

if (require.main === module) main().catch(console.error);
module.exports = { importGEYear };
