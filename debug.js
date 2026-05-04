const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const cheerio = require('cheerio');

const CHROMIUM = 'C:\\Users\\Abhishekh.Sharma\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe';
const BASE = 'https://results.eci.gov.in/ResultAcGenMay2026/';
const STATES = ['S03', 'S11', 'U07', 'S22', 'S25'];

(async () => {
  const browser = await puppeteer.launch({ headless: true, executablePath: CHROMIUM, args: ['--no-sandbox'] });

  for (const code of STATES) {
    const page = await browser.newPage();
    await page.goto(BASE + `statewise${code}1.htm`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    const html = await page.content();
    await page.close();

    const $ = cheerio.load(html);
    const pages = [];
    $('a').each((_, a) => {
      const href = $(a).attr('href') || '';
      if (href.match(new RegExp(`statewise${code}\\d+\\.htm`))) pages.push(href);
    });
    const maxPage = pages.length ? Math.max(...pages.map(p => parseInt(p.match(/(\d+)\.htm/)?.[1]||0))) : 1;
    console.log(`${code}: max constituency page = ${maxPage} | links: ${pages.join(', ')}`);
  }

  await browser.close();
})();
