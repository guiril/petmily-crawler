import puppeteer from 'puppeteer';
import { SELECTORS, CRAWLER_CONFIG } from '../config.js';

export class PetFriendlyCrawler {
  #browser;
  #page;
  #nextUrl;

  constructor() {}

  async init() {
    this.#browser = await puppeteer.launch(CRAWLER_CONFIG.launchOptions);

    this.#page = await this.#browser.newPage();
  }

  async navigateToPage(url) {
    try {
      await this.#page.goto(url);
      console.log(`Navigated to: ${url}`);
    } catch (error) {
      console.error('Error navigating to page:', error);
      throw error;
    }
  }

  async close() {
    if (this.#browser) {
      await this.#browser.close();
    }
  }

  async getLastUpdateText() {
    try {
      return await this.#page.$eval(
        SELECTORS.updateText,
        (element) => element.textContent
      );
    } catch (error) {
      console.error('Error getting last update text:', error);
      return null;
    }
  }

  async extractVenuesFromPage() {
    try {
      const rowsData = await this.#page.$$eval(SELECTORS.tableRows, (rows) =>
        rows.map((row) => {
          const tdElements = [...row.querySelectorAll('td')];

          return {
            number: tdElements[0]?.textContent.trim(),
            name: tdElements[1]?.textContent.trim(),
            serviceType: tdElements[2]?.textContent.trim(),
            petType: tdElements[3]?.textContent.trim(),
            address: tdElements[4]?.textContent.trim(),
            phone: tdElements[5]?.textContent.trim()
          };
        })
      );

      return rowsData.slice(1);
    } catch (error) {
      console.error('Error extracting venues:', error);
      return [];
    }
  }

  async crawlAllPages(allVenues = [], pageCount = 0) {
    const maxPages = 50;
    pageCount++;

    console.log(`Crawling page ${pageCount}...`);

    const currentPageVenues = await this.extractVenuesFromPage();
    allVenues.push(...currentPageVenues);

    await this.#getNextUrl();

    if (this.#nextUrl && pageCount < maxPages) {
      await this.#goToNextPage();
      return await this.crawlAllPages(allVenues, pageCount);
    }

    console.log(`Total pages crawled: ${pageCount}`);
    return allVenues;
  }

  async #getNextUrl() {
    try {
      const nextButtonEl = await this.#page.$(SELECTORS.nextButton);

      this.#nextUrl = '';

      if (nextButtonEl) {
        this.#nextUrl = await nextButtonEl.evaluate((el) => el.href);

        console.log(`Next button found: ${this.#nextUrl}`);
      } else {
        console.log('Next button not found');
      }
    } catch (error) {
      console.error('Error checking next page:', error);
    }
  }

  async #goToNextPage() {
    try {
      await this.#page.goto(this.#nextUrl);
      console.log(`Navigated to next page: ${this.#nextUrl}`);
    } catch (error) {
      console.error('Error going to next page:', error);
      throw error;
    }
  }
}
