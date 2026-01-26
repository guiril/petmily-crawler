import { fileURLToPath } from 'url';
import path from 'path';
import { DataSource, CrawlerConfig } from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DATA_SOURCES: DataSource[] = [
  {
    id: 'taichung',
    city: '臺中市',
    url: 'https://www.animal.taichung.gov.tw/1521448/1521512/1521537/1521539',
    dataFile: path.join(__dirname, 'data', 'data.json'),
    selectors: {
      updateText: '.multiColumn .bulletin p span',
      tableRows: '.list table tbody tr',
      nextButton: '.page ul li.next a[title="下一頁"]',
    },
  },
];

export const CRAWLER_CONFIG: CrawlerConfig = {
  headless: true,
  timeout: 10000,
  launchOptions: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--deterministic-fetch',
      '--disable-features=VizDisplayCompositor',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  },
};
