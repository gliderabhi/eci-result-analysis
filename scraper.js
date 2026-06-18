const { execFile } = require('child_process');
const cheerio = require('cheerio');
const { getMajority } = require('./demographics');

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    execFile('curl', ['-sL', '--max-time', '30', '-H', 'Accept-Language: en-IN,en;q=0.9', url], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

async function fetchPages(urls) {
  const BATCH = 4;
  const results = [];
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const htmls = await Promise.all(batch.map(fetchPage));
    results.push(...htmls);
  }
  return results;
}

function parsePartywise(html) {
  const $ = cheerio.load(html);
  const parties = [];
  $('table').first().find('tr').slice(1).each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 4) {
      const party   = $(cells[0]).text().replace(/\s+/g, ' ').trim();
      const won     = parseInt($(cells[1]).text().trim()) || 0;
      const leading = parseInt($(cells[2]).text().trim()) || 0;
      const total   = parseInt($(cells[3]).text().trim()) || 0;
      if (party && party.toLowerCase() !== 'total') {
        parties.push({ party, won, leading, total });
      }
    }
  });
  return parties;
}

function parseConstituencies(html) {
  const $ = cheerio.load(html);
  const constituencies = [];
  const mainTable = $('table').first();
  const statusLine = mainTable.find('tr').first().text().replace(/\s+/g, ' ').trim();

  const getText = (td) => {
    const clone = $(td).clone();
    clone.find('table').remove();
    return clone.text().replace(/\s+/g, ' ').trim();
  };
  const getParty = (td) => $(td).find('table td').first().text().replace(/\s+/g, ' ').trim();

  mainTable.children('tbody').children('tr').each((_, row) => {
    const tds = $(row).children('td');
    if (tds.length < 9) return;
    const constituency   = getText(tds[0]);
    const constNo        = getText(tds[1]);
    const leadCandidate  = getText(tds[2]);
    const leadParty      = getParty(tds[3]);
    const trailCandidate = getText(tds[4]);
    const trailParty     = getParty(tds[5]);
    const margin         = getText(tds[6]);
    const round          = getText(tds[7]);
    const status         = getText(tds[8]);
    if (constituency && constNo && !isNaN(parseInt(constNo))) {
      constituencies.push({ constituency, constNo, leadCandidate, leadParty, trailCandidate, trailParty, margin, round, status });
    }
  });

  return { statusLine, constituencies };
}

async function scrapeState(state, base) {
  const urls = [
    base + `partywiseresult-${state.code}.htm`,
    ...Array.from({ length: state.pages }, (_, i) => base + `statewise${state.code}${i + 1}.htm`),
  ];

  const [partyHtml, ...constHtmls] = await fetchPages(urls);
  const parties = parsePartywise(partyHtml);

  let statusLine = '';
  const constituencies = [];
  for (const html of constHtmls) {
    const result = parseConstituencies(html);
    if (!statusLine && result.statusLine) statusLine = result.statusLine;
    constituencies.push(...result.constituencies);
  }

  const enriched = constituencies.map(c => ({
    ...c,
    demo: getMajority(state.code, c.constituency),
  }));

  return {
    code: state.code,
    name: state.name,
    totalSeats: state.seats,
    scrapedAt: new Date().toISOString(),
    statusLine,
    parties,
    constituencies: enriched,
  };
}

async function scrapeAllStates(election) {
  const results = {};
  for (const state of election.states) {
    console.log(`  Scraping ${state.name} (${state.code})…`);
    try {
      results[state.code] = await scrapeState(state, election.base);
      console.log(`  ✓ ${state.name}: ${results[state.code].constituencies.length} constituencies`);
    } catch (err) {
      console.error(`  ✗ ${state.name}: ${err.message}`);
      results[state.code] = null;
    }
  }
  return results;
}

module.exports = { scrapeAllStates };
