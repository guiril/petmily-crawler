import { fileURLToPath } from 'url';
import path from 'path';
import type { DataSource, SourceData, RawVenue } from './src/types/index.ts';
import { getCrawler } from './src/crawlers/index.ts';
import { readData, writeData } from './src/storage.ts';
import { DATA_SOURCES } from './config.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getDataFilePath = (sourceId: string): string =>
  path.join(__dirname, 'data', 'raw', `${sourceId}.json`);

const buildUpdatedData = (
  existingData: Partial<SourceData>,
  sourceCity: string,
  venues: RawVenue[],
  currentTime: number,
): SourceData => ({
  ...existingData,
  sourceCity,
  venues,
  scrapedAt: currentTime,
});

const crawlSource = async (source: DataSource): Promise<void> => {
  const { id, city, url } = source;
  const crawl = getCrawler(id);

  console.log(`\n=== Starting crawler for ${city} ===`);

  const dataFilePath = getDataFilePath(id);
  const venues = await crawl(url);
  const existingData: Partial<SourceData> = JSON.parse(readData(dataFilePath));

  const updatedData = buildUpdatedData(
    existingData,
    city,
    venues,
    Math.floor(Date.now() / 1000),
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
    }),
  );

  console.log('\n=== All crawlers completed ===');
})();
