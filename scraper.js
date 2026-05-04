const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { chromium: playwrightChromium } = require('playwright');
const cheerio = require('cheerio');
const { getMajority } = require('./demographics');

puppeteer.use(StealthPlugin());

const CHROMIUM = playwrightChromium.executablePath();
const BASE = 'https://results.eci.gov.in/ResultAcGenMay2026/';

const STATES = [
  { code: 'S03', name: 'Assam',       seats: 126, pages: 7  },
  { code: 'S11', name: 'Kerala',      seats: 140, pages: 7  },
  { code: 'U07', name: 'Puducherry',  seats: 30,  pages: 2  },
  { code: 'S22', name: 'Tamil Nadu',  seats: 234, pages: 12 },
  { code: 'S25', name: 'West Bengal', seats: 294, pages: 15 },
];

async function fetchPages(urls) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROMIUM,
    args: ['--no-sandbox', '--lang=en-IN'],
  });
  try {
    const results = [];
    const BATCH = 4;
    for (let i = 0; i < urls.length; i += BATCH) {
      const batch = urls.slice(i, i + BATCH);
      const htmls = await Promise.all(batch.map(async (url) => {
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-IN,en;q=0.9' });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));
        const html = await page.content();
        await page.close();
        return html;
      }));
      results.push(...htmls);
    }
    return results;
  } finally {
    await browser.close();
  }
}

function parsePartywise(html) {
  const $ = cheerio.load(html);
  const parties = [];
  $('table').first().find('tr').slice(1).each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 4) {
      const party = $(cells[0]).text().replace(/\s+/g, ' ').trim();
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

  mainTable.children('tbody').children('tr').slice(2).each((_, row) => {
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
  // demographics are added after all pages parsed (see scrapeState)
  });

  return { statusLine, constituencies };
}

async function scrapeState(state) {
  const urls = [
    BASE + `partywiseresult-${state.code}.htm`,
    ...Array.from({ length: state.pages }, (_, i) => BASE + `statewise${state.code}${i + 1}.htm`),
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

  // Attach demographic majority to each constituency
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

async function scrapeAllStates() {
  // Scrape all states sequentially to avoid overwhelming ECI servers
  const results = {};
  for (const state of STATES) {
    console.log(`  Scraping ${state.name} (${state.code})…`);
    try {
      results[state.code] = await scrapeState(state);
      console.log(`  ✓ ${state.name}: ${results[state.code].constituencies.length} constituencies`);
    } catch (err) {
      console.error(`  ✗ ${state.name}: ${err.message}`);
      results[state.code] = null;
    }
  }
  return results;
}

module.exports = { scrapeAllStates, STATES };
