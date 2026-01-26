import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import type { Crawler, CrawlResult, DataSource, Venue } from '../types/index.ts';
import { CRAWLER_CONFIG } from '../../config.ts';

const SELECTORS = {
  updateText: '.multiColumn .bulletin p span',
  tableRows: '.list table tbody tr',
  nextButton: '.page ul li.next a[title="下一頁"]',
};

export class TaichungCrawler implements Crawler {
  #browser: Browser | null = null;
  #page: Page | null = null;
  #nextUrl: string = '';

  async crawl(source: DataSource): Promise<CrawlResult> {
    await this.#init();
    await this.#navigateToPage(source.url);

    const lastUpdate = await this.#getLastUpdateText();
    const venues = await this.#crawlAllPages();

    return { lastUpdate, venues };
  }

  async close(): Promise<void> {
    if (this.#browser) {
      await this.#browser.close();
    }
  }

  async #init(): Promise<void> {
    this.#browser = await puppeteer.launch(CRAWLER_CONFIG.launchOptions);
    this.#page = await this.#browser.newPage();
  }

  #assertPage(): Page {
    if (!this.#page) {
      throw new Error('Crawler not initialized');
    }

    return this.#page;
  }

  async #navigateToPage(url: string): Promise<void> {
    await this.#assertPage().goto(url);
    console.log(`Navigated to: ${url}`);
  }

  async #getLastUpdateText(): Promise<string | null> {
    try {
      return await this.#assertPage().$eval(
        SELECTORS.updateText,
        (element) => element.textContent,
      );
    } catch (error) {
      console.error('Error getting last update text:', error);
      return null;
    }
  }

  async #extractVenuesFromPage(): Promise<Venue[]> {
    try {
      const rowsData = await this.#assertPage().$$eval(SELECTORS.tableRows, (rows) => rows.map((row) => {
        const tdElements = [...row.querySelectorAll('td')];

        return {
          number: tdElements[0]?.textContent?.trim().slice(0, -1) ?? '',
          name: tdElements[1]?.textContent?.trim() ?? '',
          serviceType: tdElements[2]?.textContent?.trim() ?? '',
          petType: tdElements[3]?.textContent?.trim() ?? '',
          address: tdElements[4]?.textContent?.trim() ?? '',
          phone: tdElements[5]?.textContent?.trim() ?? '',
        };
      }));

      return rowsData.slice(1);
    } catch (error) {
      console.error('Error extracting venues:', error);
      return [];
    }
  }

  async #goToNextPage(): Promise<void> {
    await this.#assertPage().goto(this.#nextUrl);
    console.log(`Navigated to next page: ${this.#nextUrl}`);
  }

  async #getNextUrl(): Promise<void> {
    try {
      const nextButtonEl = await this.#assertPage().$(SELECTORS.nextButton);

      this.#nextUrl = '';

      if (nextButtonEl) {
        this.#nextUrl = await nextButtonEl.evaluate((el) => (el as HTMLAnchorElement).href);

        console.log(`Next button found: ${this.#nextUrl}`);
      } else {
        console.log('Next button not found');
      }
    } catch (error) {
      console.error('Error checking next page:', error);
    }
  }

  async #crawlAllPages(venues: Venue[] = [], pageCount: number = 0): Promise<Venue[]> {
    const maxPages = 50;
    const currentPage = pageCount + 1;

    console.log(`Crawling page ${currentPage}...`);

    const currentPageVenues = await this.#extractVenuesFromPage();
    venues.push(...currentPageVenues);

    await this.#getNextUrl();

    if (this.#nextUrl && currentPage < maxPages) {
      await this.#goToNextPage();
      return this.#crawlAllPages(venues, currentPage);
    }

    console.log(`Total pages crawled: ${currentPage}`);
    return venues;
  }
}
