import { TaichungCrawler } from './src/crawlers/taichung.js';
import { readData, writeData } from './src/storage.js';
import { DATA_SOURCES } from './config.js';

const taichungSource = DATA_SOURCES.find((source) => source.id === 'taichung');

(async () => {
  const crawler = new TaichungCrawler();

  try {
    console.log('Starting crawler...');

    await crawler.init(taichungSource.selectors);
    await crawler.navigateToPage(taichungSource.url);

    const lastUpdateText = await crawler.getLastUpdateText();

    console.log('Crawling venues data...');

    const venues = await crawler.crawlAllPages();
    const existingData = JSON.parse(readData(taichungSource.dataFile));

    const updatedData = {
      ...existingData,
      sourceCity: taichungSource.city,
      lastUpdate: lastUpdateText,
      scrapedAt: Math.floor(Date.now() / 1000),
      venues,
    };

    writeData(taichungSource.dataFile, updatedData);

    console.log('Data saved successfully');
  } catch (error) {
    console.error('Crawler failed:', error);
    process.exit(1);
  } finally {
    await crawler.close();
  }
})();
