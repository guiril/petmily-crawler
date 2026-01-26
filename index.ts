import { fileURLToPath } from 'url';
import path from 'path';
import type { DataSource, SourceDataByCity } from './src/types/index.ts';
import { getCrawler } from './src/crawlers/index.ts';
import { readData, writeData } from './src/storage.ts';
import { DATA_SOURCES } from './config.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getDataFilePath = (sourceId: string): string => {
  return path.join(__dirname, 'data', `${sourceId}.json`);
};

const crawlSource = async (source: DataSource): Promise<void> => {
  const crawler = getCrawler(source.id);

  try {
    console.log(`\n=== Starting crawler for ${source.city} ===`);

    const dataFilePath = getDataFilePath(source.id);
    const { lastUpdate, venues } = await crawler.crawl(source);
    const existingData: Partial<SourceDataByCity> = JSON.parse(readData(dataFilePath));

    const updatedData: SourceDataByCity = {
      ...existingData,
      sourceCity: source.city,
      lastUpdate,
      scrapedAt: Math.floor(Date.now() / 1000),
      venues,
    };

    writeData(dataFilePath, updatedData);

    console.log(`Data saved successfully for ${source.city}`);
  } finally {
    await crawler.close();
  }
};

(async () => {
  for (const source of DATA_SOURCES) {
    try {
      await crawlSource(source);
    } catch (error) {
      console.error(`Crawler failed for ${source.city}:`, error);
    }
  }

  console.log('\n=== All crawlers completed ===');
})();
