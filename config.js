import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const TARGET_URL =
  'https://www.animal.taichung.gov.tw/1521448/1521512/1521537/1521539';

export const SELECTORS = {
  updateText: '.multiColumn .bulletin p span',
  tableRows: '.list table tbody tr',
  nextButton: '.page ul li.next a[title="下一頁"]'
};

export const DATA_FILE = path.join(__dirname, 'data', 'data.json');

export const CRAWLER_CONFIG = {
  headless: true,
  timeout: 10000
};
