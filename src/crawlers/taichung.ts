import puppeteer, { Browser, Page } from 'puppeteer';
import { CRAWLER_CONFIG } from '../../config.ts';
import { CrawlerSelectors, Venue } from '../types/index.ts';

export class TaichungCrawler {
  #browser: Browser | null = null;
  #page: Page | null = null;
  #selectors: CrawlerSelectors | null = null;
  #nextUrl: string = '';

  async init(selectors: CrawlerSelectors): Promise<void> {
    this.#selectors = selectors;
    this.#browser = await puppeteer.launch(CRAWLER_CONFIG.launchOptions);
    this.#page = await this.#browser.newPage();
  }

  async navigateToPage(url: string): Promise<void> {
    if (!this.#page) {
      throw new Error('Crawler not initialized');
    }

    try {
      await this.#page.goto(url);
      console.log(`Navigated to: ${url}`);
    } catch (error) {
      console.error('Error navigating to page:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.#browser) {
      await this.#browser.close();
    }
  }

  async getLastUpdateText(): Promise<string | null> {
    if (!this.#page || !this.#selectors) {
      throw new Error('Crawler not initialized');
    }

    try {
      return await this.#page.$eval(
        this.#selectors.updateText,
        (element) => element.textContent,
      );
    } catch (error) {
      console.error('Error getting last update text:', error);
      return null;
    }
  }

  async extractVenuesFromPage(): Promise<Venue[]> {
    if (!this.#page || !this.#selectors) {
      throw new Error('Crawler not initialized');
    }

    try {
      const selector = this.#selectors.tableRows;
      const rowsData = await this.#page.$$eval(selector, (rows) => rows.map((row) => {
        const tdElements = [...row.querySelectorAll('td')];

        return {
          number: tdElements[0]?.textContent?.trim() ?? '',
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

  async crawlAllPages(allVenues: Venue[] = [], pageCount: number = 0): Promise<Venue[]> {
    const maxPages = 50;
    const currentPage = pageCount + 1;

    console.log(`Crawling page ${currentPage}...`);

    const currentPageVenues = await this.extractVenuesFromPage();
    allVenues.push(...currentPageVenues);

    await this.#getNextUrl();

    if (this.#nextUrl && currentPage < maxPages) {
      await this.#goToNextPage();
      return this.crawlAllPages(allVenues, currentPage);
    }

    console.log(`Total pages crawled: ${currentPage}`);
    return allVenues;
  }

  async #getNextUrl(): Promise<void> {
    if (!this.#page || !this.#selectors) {
      throw new Error('Crawler not initialized');
    }

    try {
      const nextButtonEl = await this.#page.$(this.#selectors.nextButton);

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

  async #goToNextPage(): Promise<void> {
    if (!this.#page) {
      throw new Error('Crawler not initialized');
    }

    try {
      await this.#page.goto(this.#nextUrl);
      console.log(`Navigated to next page: ${this.#nextUrl}`);
    } catch (error) {
      console.error('Error going to next page:', error);
      throw error;
    }
  }
}
