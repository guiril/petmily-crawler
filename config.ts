import type { DataSource, CrawlerConfig } from './src/types/index.ts';

export const DATA_SOURCES: DataSource[] = [
  {
    id: 'taichung',
    city: '臺中市',
    url: 'https://www.animal.taichung.gov.tw/1521448/1521512/1521537/1521539',
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
