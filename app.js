import puppeteer from 'puppeteer';
import fs from 'fs';

const DATA_FILE = 'data.json';
const TARGET_URL =
  'https://www.animal.taichung.gov.tw/1521448/1521512/1521537/1521539';
const UPDATE_SELECTOR = '.multiColumn .bulletin p span';

const readData = () => fs.readFileSync(DATA_FILE, 'utf8');

const writeData = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data));
};

(async () => {
  const browser = await puppeteer.launch({
    headless: true
  });

  const page = await browser.newPage();

  await page.goto(TARGET_URL);

  const lastUpdateText = await page.$eval(
    UPDATE_SELECTOR,
    (element) => element.textContent
  );

  const rowsData = await page.$$eval('.list table tbody tr', (rows) =>
    rows.map((row) => {
      const cells = [...row.querySelectorAll('td')];
      return {
        number: cells[0]?.textContent.trim(),
        name: cells[1]?.textContent.trim(),
        serviceType: cells[2]?.textContent.trim(),
        petType: cells[3]?.textContent.trim(),
        address: cells[4]?.textContent.trim(),
        phone: cells[5]?.textContent.trim()
      };
    })
  );

  console.log(rowsData);

  const data = JSON.parse(readData());
  data.lastUpdate = lastUpdateText;
  data.scrapedAt = Math.floor(Date.now() / 1000);
  data.petFriendlyVenues = rowsData.slice(1); // Skip header row
  writeData(data);

  await browser.close();
})();
