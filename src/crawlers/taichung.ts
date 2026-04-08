import * as cheerio from 'cheerio';
import type { CrawlResult, RawVenue } from '../types/index.ts';

const MAX_PAGES = 50;
const BASE_URL = 'https://www.animal.taichung.gov.tw';

const SELECTORS = {
  updateText: '.multiColumn .bulletin p span',
  tableRows: '.list table tbody tr',
  nextButton: '.page ul li.next a[title="下一頁"]',
  detailImage: 'table.meta img[src^="/media/"]',
};

interface VenueWithDetailUrl {
  venue: RawVenue;
  detailUrl: string | null;
}

const fetchHtml = async (url: string): Promise<string> => {
  const response = await fetch(url);
  return response.text();
};

const splitField = (value: string | null | undefined): string[] =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const getLastUpdateText = (html: string): string | null => {
  const $ = cheerio.load(html);
  return $(SELECTORS.updateText).first().text() || null;
};

const extractVenuesFromTable = (html: string, startIndex: number): VenueWithDetailUrl[] => {
  const $ = cheerio.load(html);

  return $(SELECTORS.tableRows)
    .toArray()
    .slice(1)
    .map((row, index) => {
      const cells = $(row)
        .find('td')
        .toArray()
        .map((td) => $(td).text().trim() || null);

      const detailUrl = $(row).find('td:nth-child(2) a').attr('href') || null;

      return {
        venue: {
          id: `taichung-${startIndex + index}`,
          name: cells[1],
          address: cells[4],
          serviceType: splitField(cells[2]),
          petType: splitField(cells[3]),
          phone: cells[5] ?? undefined,
        } as RawVenue,
        detailUrl,
      };
    })
    .filter((item) => item.venue.name && item.venue.address) as VenueWithDetailUrl[];
};

const getNextUrl = (html: string, currentUrl: string): string => {
  const $ = cheerio.load(html);
  const href = $(SELECTORS.nextButton).attr('href');
  return href ? new URL(href, currentUrl).toString() : '';
};

const crawlAllPages = async (
  url: string,
  items: VenueWithDetailUrl[] = [],
  pageCount: number = 0,
): Promise<VenueWithDetailUrl[]> => {
  const currentPage = pageCount + 1;
  console.log(`Crawling page ${currentPage}...`);

  const html = await fetchHtml(url);
  const currentPageItems = extractVenuesFromTable(html, items.length);
  const updatedItems = [...items, ...currentPageItems];

  const nextUrl = getNextUrl(html, url);

  if (nextUrl && currentPage < MAX_PAGES) {
    console.log(`Next page: ${nextUrl}`);
    return crawlAllPages(nextUrl, updatedItems, currentPage);
  }

  console.log(`Total pages crawled: ${currentPage}`);
  return updatedItems;
};

const CONCURRENCY_LIMIT = 10;

const scrapeVenueImage = async ({ venue, detailUrl }: VenueWithDetailUrl): Promise<RawVenue> => {
  if (!detailUrl) return venue;

  try {
    const html = await fetchHtml(`${BASE_URL}${detailUrl}`);
    const $ = cheerio.load(html);
    const imageSrc = $(SELECTORS.detailImage).first().attr('src');

    console.log(`Scraped image for ${venue.name}: ${imageSrc ?? 'none'}`);
    return {
      ...venue,
      imageUrl: imageSrc ? `${BASE_URL}${imageSrc}` : undefined,
    };
  } catch (error) {
    console.error(`Error scraping detail for ${venue.name}:`, error);
    return venue;
  }
};

const scrapeVenueImages = async (venues: VenueWithDetailUrl[]): Promise<RawVenue[]> => {
  const results: RawVenue[] = [];

  for (let i = 0; i < venues.length; i += CONCURRENCY_LIMIT) {
    const venuesBatch = venues.slice(i, i + CONCURRENCY_LIMIT);
    const scrapedVenues = await Promise.all(venuesBatch.map(scrapeVenueImage));
    results.push(...scrapedVenues);
  }

  return results;
};

export const crawlTaichung = async (url: string): Promise<CrawlResult> => {
  console.log(`Starting crawl: ${url}`);

  const firstPageHtml = await fetchHtml(url);
  const lastUpdate = getLastUpdateText(firstPageHtml);

  const firstPageItems = extractVenuesFromTable(firstPageHtml, 0);
  const nextUrl = getNextUrl(firstPageHtml, url);

  const allItems = nextUrl ? await crawlAllPages(nextUrl, firstPageItems, 1) : firstPageItems;

  const venues = await scrapeVenueImages(allItems);

  return { lastUpdate, venues };
};
