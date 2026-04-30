import * as cheerio from 'cheerio';
import type { RawVenue, ServiceType } from '../types/index.ts';
import { isServiceType } from '../types/index.ts';

const SERVICE_TYPE_MAP: Record<string, ServiceType> = {
  餐飲: '餐飲',
  住宿: '住宿',
  娛樂: '娛樂',
  其他: '其他',
};

const BASE_URL = 'https://www.animal.taichung.gov.tw';
const MAX_PAGES = 50;
const CONCURRENCY_LIMIT = 10;

const SELECTORS = {
  tableRows: '.list table tbody tr',
  detailLink: 'td:nth-child(2) a',
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

const splitField = (value: string | undefined): string[] =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const extractVenuesFromTable = (html: string, startIndex: number): VenueWithDetailUrl[] => {
  const $ = cheerio.load(html);

  return $(SELECTORS.tableRows)
    .toArray()
    .slice(1) // skip header row
    .map((row, index) => {
      const cellTexts = $(row)
        .find('td')
        .toArray()
        .map((td) => $(td).text().trim() || undefined);

      const detailUrl = $(row).find(SELECTORS.detailLink).attr('href') || null;

      return {
        venue: {
          id: `taichung-${startIndex + index}`,
          name: cellTexts[1],
          address: cellTexts[4],
          serviceTypes: splitField(cellTexts[2]).map((raw) => SERVICE_TYPE_MAP[raw]).filter(isServiceType),
          petTypes: splitField(cellTexts[3]),
          phone: cellTexts[5],
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
  collectedVenues: VenueWithDetailUrl[] = [],
  pageCount: number = 1,
): Promise<VenueWithDetailUrl[]> => {
  console.log(`Crawling page ${pageCount}...`);

  const html = await fetchHtml(url);
  const currentPageVenues = extractVenuesFromTable(html, collectedVenues.length);
  const accumulatedVenues = [...collectedVenues, ...currentPageVenues];

  const nextUrl = getNextUrl(html, url);

  if (nextUrl && pageCount < MAX_PAGES) {
    console.log(`Next page: ${nextUrl}`);
    return crawlAllPages(nextUrl, accumulatedVenues, pageCount + 1);
  }

  console.log(`Total pages crawled: ${pageCount}`);
  return accumulatedVenues;
};

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

export const crawlTaichung = async (url: string): Promise<RawVenue[]> => {
  console.log(`Starting crawl: ${url}`);

  const venuesWithDetailUrl = await crawlAllPages(url);

  return scrapeVenueImages(venuesWithDetailUrl);
};
