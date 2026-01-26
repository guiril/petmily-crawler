import { TaichungCrawler } from './src/crawlers/taichung.ts';
import { readData, writeData } from './src/storage.ts';
import { DATA_SOURCES } from './config.ts';
import { VenueData } from './src/types/index.ts';

const taichungSource = DATA_SOURCES.find((source) => source.id === 'taichung');

if (!taichungSource) {
  console.error('Taichung data source not found');
  process.exit(1);
}

(async () => {
  const crawler = new TaichungCrawler();

  try {
    console.log('Starting crawler...');

    await crawler.init(taichungSource.selectors);
    await crawler.navigateToPage(taichungSource.url);

    const lastUpdateText = await crawler.getLastUpdateText();

    console.log('Crawling venues data...');

    const venues = await crawler.crawlAllPages();
    const existingData: Partial<VenueData> = JSON.parse(readData(taichungSource.dataFile));

    const updatedData: VenueData = {
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
