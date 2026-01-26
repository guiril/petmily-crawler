import { fileURLToPath } from 'url';
import path from 'path';
import { writeFileSync } from 'fs';
import type { DataSource, SourceDataByCity, Venue, CleanedData, CleanerOptions } from './types/index.ts';
import 'dotenv/config';
import { TAIWAN_CITIES } from './constants/index.ts';
import { DATA_SOURCES } from '../config.ts';
import { geocodeAddress } from './geocoding.ts';
import { readData } from './storage.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getDataFilePath = (sourceId: string): string => {
  return path.join(__dirname, '..', 'data', `${sourceId}.json`);
};

const getOutputFilePath = (): string => {
  return path.join(__dirname, '..', 'data', 'venues.json');
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const parseArgs = (): CleanerOptions => {
  const args = process.argv.slice(2);
  const options: CleanerOptions = { limit: null, dryRun: false };

  args.forEach((arg) => {
    if (arg.startsWith('--limit=')) {
      const limit = Number(arg.split('=')[1]);
      options.limit = Number.isNaN(limit) || limit === 0 ? null : limit;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
    }
  });

  return options;
};

const needsGeocoding = (address: string | undefined): boolean => {
  if (!address) return false;

  const hasCity = TAIWAN_CITIES.some((city) => address.startsWith(city));
  const hasDistrict = /[市縣].{1,3}[區市鎮鄉]/.test(address);

  return !hasCity || !hasDistrict;
};

const loadSourceVenues = (source: DataSource): Venue[] => {
  const dataFilePath = getDataFilePath(source.id);
  const venueData: SourceDataByCity = JSON.parse(readData(dataFilePath));

  return venueData.venues.map((venue) => ({
    ...venue,
    city: venueData.sourceCity,
  }));
};

const processVenues = async (
  venues: Venue[],
  apiKey: string,
  options: CleanerOptions,
): Promise<{ processed: number; failed: number }> => {
  const { limit = null, dryRun = false } = options;
  let ungeocodedVenues = venues.filter((venue) => needsGeocoding(venue.address));

  console.log(`Total venues: ${venues.length}`);
  console.log(`Need geocoding: ${ungeocodedVenues.length}`);

  if (limit) {
    ungeocodedVenues = ungeocodedVenues.slice(0, limit);
    console.log(`Limited to: ${limit} (test mode)`);
  }

  if (dryRun) {
    console.log('\n[Dry Run] Would process:');
    ungeocodedVenues.forEach((venue, index) => console.log(`${index + 1}. ${venue.address}`));
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const venue of ungeocodedVenues) {
    console.log(`[${processed + 1}/${ungeocodedVenues.length}] ${venue.name}`);
    console.log(`  Original: ${venue.address}`);

    try {
      const result = await geocodeAddress(venue.address, apiKey, { defaultCity: venue.city });

      if (result) {
        venue.address = result.formattedAddress;
        venue.district = result.district;
        venue.location = result.location;
        console.log(`  Updated:  ${result.formattedAddress}`);
      } else {
        console.log('  No result found');
        failed++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  Error: ${errorMessage}`);
      failed++;

      if (errorMessage.includes('quota')) {
        console.error('API quota exceeded. Stopping.');
        break;
      }
    }

    processed++;
    await delay(200);
  }

  return { processed, failed };
};

const main = async (): Promise<void> => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const options = parseArgs();

  if (!apiKey) {
    const message = [
      'Error: GOOGLE_MAPS_API_KEY environment variable is required',
      '',
      'Usage:',
      '  GOOGLE_MAPS_API_KEY=your_key npm run clean [options]',
      '',
      'Options:',
      '  --limit=N    Only process first N records (for testing)',
      '  --dry-run    Preview addresses without calling API',
    ].join('\n');

    console.error(message);
    process.exit(1);
  }

  console.log('=== Loading all sources ===');

  const venuesByCity: Record<string, Venue[]> = {};

  for (const source of DATA_SOURCES) {
    console.log(`Loading ${source.city}...`);
    const venues = loadSourceVenues(source);
    venuesByCity[source.id] = venues;
    console.log(`  Loaded ${venues.length} venues`);
  }

  const allVenues = Object.values(venuesByCity).flat();
  console.log(`\nTotal venues loaded: ${allVenues.length}`);
  console.log('\n=== Processing geocoding ===');

  const { processed, failed } = await processVenues(allVenues, apiKey, options);

  if (!options.dryRun) {
    const outputPath = getOutputFilePath();
    const cleanedData: CleanedData = {
      updatedAt: Math.floor(Date.now() / 1000),
      venues: venuesByCity,
    };

    writeFileSync(outputPath, JSON.stringify(cleanedData, null, 2));
    console.log(`\nCleaned data saved to: ${outputPath}`);
  }

  console.log('\n--- Summary ---');
  console.log(`Total venues: ${allVenues.length}`);
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success: ${processed - failed}`);
};

main();
