const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'eci-results.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS scrape_runs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    scraped_at TEXT    NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'success'
  );

  CREATE TABLE IF NOT EXISTS party_results (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id     INTEGER NOT NULL REFERENCES scrape_runs(id) ON DELETE CASCADE,
    state_code TEXT    NOT NULL,
    party      TEXT    NOT NULL,
    won        INTEGER NOT NULL DEFAULT 0,
    leading    INTEGER NOT NULL DEFAULT 0,
    total      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS constituency_results (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          INTEGER NOT NULL REFERENCES scrape_runs(id) ON DELETE CASCADE,
    state_code      TEXT    NOT NULL,
    state_name      TEXT    NOT NULL,
    const_no        TEXT,
    constituency    TEXT    NOT NULL,
    lead_candidate  TEXT,
    lead_party      TEXT,
    trail_candidate TEXT,
    trail_party     TEXT,
    margin          TEXT,
    round           TEXT,
    status          TEXT,
    status_line     TEXT,
    demo_majority   TEXT,
    demo_emoji      TEXT,
    demo_color      TEXT
  );
`);

const _insertRun   = db.prepare(`INSERT INTO scrape_runs (scraped_at, status) VALUES (?, ?)`);
const _insertParty = db.prepare(`
  INSERT INTO party_results (run_id, state_code, party, won, leading, total)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const _insertConst = db.prepare(`
  INSERT INTO constituency_results
    (run_id, state_code, state_name, const_no, constituency,
     lead_candidate, lead_party, trail_candidate, trail_party,
     margin, round, status, status_line, demo_majority, demo_emoji, demo_color)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const saveRun = db.transaction((scrapedAt, data) => {
  const { lastInsertRowid: runId } = _insertRun.run(scrapedAt, 'success');
  for (const [stateCode, stateData] of Object.entries(data)) {
    if (!stateData) continue;
    for (const p of stateData.parties || []) {
      _insertParty.run(runId, stateCode, p.party, p.won, p.leading, p.total);
    }
    for (const c of stateData.constituencies || []) {
      _insertConst.run(
        runId, stateCode, stateData.name,
        c.constNo, c.constituency,
        c.leadCandidate, c.leadParty,
        c.trailCandidate, c.trailParty,
        c.margin, c.round, c.status, stateData.statusLine || '',
        c.demo?.majority ?? null, c.demo?.emoji ?? null, c.demo?.color ?? null
      );
    }
  }
  return runId;
});

function getLatestRun() {
  return db.prepare(`SELECT * FROM scrape_runs WHERE status='success' ORDER BY id DESC LIMIT 1`).get();
}

function getRunData(runId) {
  const parties = db.prepare(`SELECT * FROM party_results       WHERE run_id=?`).all(runId);
  const consts  = db.prepare(`SELECT * FROM constituency_results WHERE run_id=?`).all(runId);
  const result  = {};

  for (const p of parties) {
    if (!result[p.state_code])
      result[p.state_code] = { code: p.state_code, parties: [], constituencies: [], statusLine: '' };
    result[p.state_code].parties.push({ party: p.party, won: p.won, leading: p.leading, total: p.total });
  }
  for (const c of consts) {
    if (!result[c.state_code])
      result[c.state_code] = { code: c.state_code, name: c.state_name, parties: [], constituencies: [], statusLine: '' };
    const s = result[c.state_code];
    if (!s.name) s.name = c.state_name;
    if (!s.statusLine && c.status_line) s.statusLine = c.status_line;
    s.constituencies.push({
      constNo: c.const_no, constituency: c.constituency,
      leadCandidate: c.lead_candidate, leadParty: c.lead_party,
      trailCandidate: c.trail_candidate, trailParty: c.trail_party,
      margin: c.margin, round: c.round, status: c.status,
      demo: c.demo_majority ? { majority: c.demo_majority, emoji: c.demo_emoji, color: c.demo_color } : null,
    });
  }
  return result;
}

function getHistory(limit = 20) {
  return db.prepare(`SELECT id, scraped_at, status FROM scrape_runs ORDER BY id DESC LIMIT ?`).all(limit);
}

module.exports = { saveRun, getLatestRun, getRunData, getHistory };
