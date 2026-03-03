import puppeteer from 'puppeteer';
import type { Page } from 'puppeteer';
import type { CrawlResult, RawVenue } from '../types/index.ts';
import { CRAWLER_CONFIG } from '../../config.ts';

const MAX_PAGES = 50;

const SELECTORS = {
  updateText: '.multiColumn .bulletin p span',
  tableRows: '.list table tbody tr',
  nextButton: '.page ul li.next a[title="下一頁"]',
};

const getLastUpdateText = async (page: Page): Promise<string | null> => {
  try {
    return await page.$eval(
      SELECTORS.updateText,
      (element) => element.textContent
    );
  } catch (error) {
    console.error('Error getting last update text:', error);
    return null;
  }
};

const splitField = (value: string | null): string[] =>
  value
    ? value.split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    : [];

const parseVenues = (
  rows: (string | null)[][],
  startIndex: number
): RawVenue[] =>
  rows
    .slice(1)
    .map((cells, index) => ({
      id: `taichung-${startIndex + index}`,
      name: cells[1],
      address: cells[4],
      serviceType: splitField(cells[2]),
      petType: splitField(cells[3]),
      phone: cells[5],
    }))
    .filter((venue) => venue.name && venue.address) as RawVenue[];

const extractVenuesFromTable = async (
  page: Page,
  startIndex: number
): Promise<RawVenue[]> => {
  try {
    const rawRows = await page.$$eval(SELECTORS.tableRows, (rows) =>
      rows.map((row) =>
        [...row.querySelectorAll('td')].map(
          (td) => td.textContent?.trim() || null
        )
      )
    );

    return parseVenues(rawRows, startIndex);
  } catch (error) {
    console.error('Error extracting venues:', error);
    return [];
  }
};

const getNextUrl = async (page: Page): Promise<string> => {
  try {
    const nextButtonEl = await page.$(SELECTORS.nextButton);

    if (nextButtonEl) {
      const nextUrl = await nextButtonEl.evaluate(
        (el) => (el as HTMLAnchorElement).href
      );
      console.log(`Next button found: ${nextUrl}`);
      return nextUrl;
    }

    console.log('Next button not found');
    return '';
  } catch (error) {
    console.error('Error checking next page:', error);
    return '';
  }
};

const crawlAllPages = async (
  page: Page,
  venues: RawVenue[] = [],
  pageCount: number = 0
): Promise<RawVenue[]> => {
  const currentPage = pageCount + 1;

  console.log(`Crawling page ${currentPage}...`);

  const currentPageVenues = await extractVenuesFromTable(page, venues.length);
  const updatedVenues = [...venues, ...currentPageVenues];

  const nextUrl = await getNextUrl(page);

  if (nextUrl && currentPage < MAX_PAGES) {
    await page.goto(nextUrl);
    console.log(`Navigated to next page: ${nextUrl}`);
    return crawlAllPages(page, updatedVenues, currentPage);
  }

  console.log(`Total pages crawled: ${currentPage}`);
  return updatedVenues;
};

export const crawlTaichung = async (url: string): Promise<CrawlResult> => {
  const browser = await puppeteer.launch(CRAWLER_CONFIG.launchOptions);

  try {
    const page = await browser.newPage();
    await page.goto(url);
    console.log(`Navigated to: ${url}`);

    const lastUpdate = await getLastUpdateText(page);
    const venues = await crawlAllPages(page);

    return { lastUpdate, venues };
  } finally {
    await browser.close();
  }
};
