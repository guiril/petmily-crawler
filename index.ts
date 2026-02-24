import { fileURLToPath } from 'url';
import path from 'path';
import type { DataSource, SourceData, CrawlResult } from './src/types/index.ts';
import { getCrawler } from './src/crawlers/index.ts';
import { readData, writeData } from './src/storage.ts';
import { DATA_SOURCES } from './config.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getDataFilePath = (sourceId: string): string => {
  return path.join(__dirname, 'data', `${sourceId}.json`);
};

const buildUpdatedData = (
  existingData: Partial<SourceData>,
  sourceCity: string,
  crawlResult: CrawlResult,
  currentTime: number,
): SourceData =>({
  ...existingData,
  sourceCity,
  lastUpdate: crawlResult.lastUpdate,
  venues: crawlResult.venues,
  scrapedAt: currentTime,
});

const crawlSource = async (source: DataSource): Promise<void> => {
  const crawl = getCrawler(source.id);

  console.log(`\n=== Starting crawler for ${source.city} ===`);

  const dataFilePath = getDataFilePath(source.id);
  const crawlResult: CrawlResult = await crawl(source.url);
  const existingData: Partial<SourceData> = JSON.parse(readData(dataFilePath));

  const updatedData = buildUpdatedData(
    existingData,
    source.city,
    crawlResult,
    Math.floor(Date.now() / 1000)
  );

  writeData(dataFilePath, updatedData);

  console.log(`Data saved successfully for ${source.city}`);
};

(async () => {
  await Promise.all(
    DATA_SOURCES.map(async (source) => {
      try {
        await crawlSource(source);
      } catch (error) {
        console.error(`Crawler failed for ${source.city}:`, error);
      }
    })
  );

  console.log('\n=== All crawlers completed ===');
})();
