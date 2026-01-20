import { PetFriendlyCrawler } from './src/crawler.js';
import { readData, writeData } from './src/storage.js';
import { TARGET_URL } from './config.js';

(async () => {
  const crawler = new PetFriendlyCrawler();

  try {
    console.log('Starting crawler...');

    await crawler.init();
    await crawler.navigateToPage(TARGET_URL);

    const lastUpdateText = await crawler.getLastUpdateText();

    console.log('Crawling venues data...');

    const venues = await crawler.crawlAllPages();
    const existingData = JSON.parse(readData());

    const updatedData = {
      ...existingData,
      lastUpdate: lastUpdateText,
      scrapedAt: Math.floor(Date.now() / 1000),
      petFriendlyVenues: venues,
    };

    writeData(updatedData);

    console.log('Data saved successfully');
  } catch (error) {
    console.error('Crawler failed:', error);
    process.exit(1);
  } finally {
    await crawler.close();
  }
})();
