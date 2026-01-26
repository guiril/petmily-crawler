import 'dotenv/config';
import { writeFileSync } from 'fs';
import { readData } from './storage.ts';
import { geocodeAddress } from './geocoding.ts';
import { DATA_SOURCES } from '../config.ts';
import { TAIWAN_CITIES } from './constants/index.ts';
import { DataSource, VenueData, CleanerOptions } from './types/index.ts';

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

const getCleanedDataFile = (dataFile: string): string => dataFile.replace('.json', '-cleaned.json');

export const cleanAddresses = async (
  source: DataSource,
  apiKey: string,
  options: CleanerOptions = {},
): Promise<void> => {
  const { limit = null, dryRun = false } = options;
  const venueData: VenueData = JSON.parse(readData(source.dataFile));
  const { sourceCity, venues } = venueData;
  let ungeocodedVenues = venues.filter((venue) => needsGeocoding(venue.address));

  console.log(`\n=== Processing: ${source.city} ===`);
  console.log(`Total venues: ${venues.length}`);
  console.log(`Need geocoding: ${ungeocodedVenues.length}`);

  if (limit) {
    ungeocodedVenues = ungeocodedVenues.slice(0, limit);
    console.log(`Limited to: ${limit} (test mode)`);
  }

  if (dryRun) {
    console.log('\n[Dry Run] Would process:');
    ungeocodedVenues.forEach((venue, index) => console.log(`${index + 1}. ${venue.address}`));
    return;
  }

  let processed = 0;
  let failed = 0;

  for (const venue of ungeocodedVenues) {
    console.log(`[${processed + 1}/${ungeocodedVenues.length}] ${venue.name}`);
    console.log(`Original: ${venue.address}`);

    try {
      const result = await geocodeAddress(venue.address, apiKey, { defaultCity: sourceCity });

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

  const cleanedDataFile = getCleanedDataFile(source.dataFile);
  writeFileSync(cleanedDataFile, JSON.stringify(venueData, null, 2));
  console.log(`\nCleaned data saved to: ${cleanedDataFile}`);

  console.log('\n--- Summary ---');
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success: ${processed - failed}`);
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

  for (const source of DATA_SOURCES) {
    await cleanAddresses(source, apiKey, options);
  }
};

main();
