import { fileURLToPath } from 'url';
import path from 'path';
import { writeFileSync } from 'fs';

import type {
  DataSource,
  SourceData,
  Venue,
  CleanedData,
  CleanerOptions,
  GeocodeResult,
} from './types/index.ts';

import 'dotenv/config';

import { DATA_SOURCES } from '../config.ts';
import { geocodeAddress } from './geocoding.ts';
import { readData } from './storage.ts';

const getOverridesFilePath = (): string =>
  path.join(__dirname, '..', 'data', 'geocoding-overrides.json');

const loadOverrides = (): Record<string, GeocodeResult> => {
  try {
    return JSON.parse(readData(getOverridesFilePath()));
  } catch {
    return {};
  }
};

interface VenueWithSource extends Venue {
  sourceId: string;
}

interface GeocodeSummary {
  geocodedVenues: VenueWithSource[];
  processed: number;
  failed: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEOCODE_DELAY_MS = 200;

const getDataFilePath = (sourceId: string): string =>
  path.join(__dirname, '..', 'data', `${sourceId}.json`);

const getOutputFilePath = (): string => path.join(__dirname, '..', 'data', 'venues.json');

const mergeGeocodedData = (venue: VenueWithSource, result: GeocodeResult): VenueWithSource => ({
  ...venue,
  address: result.formattedAddress,
  district: result.district,
  location: result.location,
});

const groupBySourceId = (venues: VenueWithSource[]): Record<string, VenueWithSource[]> =>
  venues.reduce<Record<string, VenueWithSource[]>>((acc, venue) => {
    const { sourceId } = venue;
    return {
      ...acc,
      [sourceId]: [...(acc[sourceId] ?? []), venue],
    };
  }, {});

const parseArgs = (): CleanerOptions => {
  const args = process.argv.slice(2);

  return args.reduce<CleanerOptions>(
    (acc, arg) => {
      if (arg.startsWith('--limit=')) {
        const value = Number(arg.split('=')[1]);
        const isValid = !Number.isNaN(value) && value > 0;
        return isValid ? { ...acc, limit: value } : acc;
      }

      if (arg === '--dry-run') {
        return { ...acc, dryRun: true };
      }

      return acc;
    },
    { limit: null, dryRun: false },
  );
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const toVenuesWithSource = (source: DataSource, venueData: SourceData): VenueWithSource[] =>
  venueData.venues.map((venue) => ({
    ...venue,
    sourceCity: venueData.sourceCity,
    sourceId: source.id,
  }));

const loadAllVenues = (sources: DataSource[]): VenueWithSource[] => {
  console.log('=== Loading all sources ===');

  const allVenues = sources.flatMap((source) => {
    console.log(`Loading ${source.city}...`);

    const dataFilePath = getDataFilePath(source.id);
    const venueData: SourceData = JSON.parse(readData(dataFilePath));
    const venues = toVenuesWithSource(source, venueData);

    console.log(` Loaded ${venues.length} venues`);
    return venues;
  });

  console.log(`\nTotal venues loaded: ${allVenues.length}`);
  return allVenues;
};

const buildCleanedData = (venuesBySourceId: Record<string, VenueWithSource[]>): CleanedData => ({
  updatedAt: Math.floor(Date.now() / 1000),
  venues: Object.fromEntries(
    Object.entries(venuesBySourceId).map(([sourceId, venues]) => [
      sourceId,
      venues.map(({ sourceCity: _sourceCity, sourceId: _sourceId, ...rest }) => rest),
    ]),
  ),
});

const saveCleanedData = (venuesBySourceId: Record<string, VenueWithSource[]>): void => {
  const outputPath = getOutputFilePath();
  const cleanedData = buildCleanedData(venuesBySourceId);

  writeFileSync(outputPath, JSON.stringify(cleanedData, null, 2));
  console.log(`\nCleaned data saved to: ${outputPath}`);
};

const geocodeOneVenue = async (
  venue: VenueWithSource,
  apiKey: string,
  overrides: Record<string, GeocodeResult>,
): Promise<VenueWithSource> => {
  console.log(`  Original: ${venue.address}`);

  const override = overrides[venue.id];

  if (override) {
    console.log(`  Override: ${override.formattedAddress}`);
    return mergeGeocodedData(venue, override);
  }

  const result = await geocodeAddress(venue.address, apiKey, {
    sourceCity: venue.sourceCity,
  });

  if (!result) {
    console.log('  No result found');
    throw new Error('No geocoding result');
  }

  console.log(`  Updated:  ${result.formattedAddress}`);
  return mergeGeocodedData(venue, result);
};

// Cannot use Promise.all due to API rate limiting requirements
const geocodeVenuesSequentially = async (
  venues: VenueWithSource[],
  apiKey: string,
  overrides: Record<string, GeocodeResult>,
): Promise<GeocodeSummary> => {
  const geocodedVenues: VenueWithSource[] = [];

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < venues.length; i++) {
    const venue = venues[i];

    try {
      console.log(`[${i + 1}/${venues.length}] ${venue.name}`);
      const updatedVenue = await geocodeOneVenue(venue, apiKey, overrides);

      geocodedVenues.push(updatedVenue);
      processed += 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      geocodedVenues.push(venue);
      processed += 1;
      failed += 1;

      if (errorMessage.includes('quota')) {
        console.error('API quota exceeded. Stopping.');
        // Current venue (i) already pushed above; skip remaining
        geocodedVenues.push(...venues.slice(i + 1));
        break;
      }

      if (!errorMessage.includes('No geocoding result')) {
        console.error(`  Error: ${errorMessage}`);
      }
    }

    if (i < venues.length - 1) await delay(GEOCODE_DELAY_MS);
  }

  return { geocodedVenues, processed, failed };
};

// TypeScript assertion functions require function declaration syntax
function validateApiKey(apiKey: string | undefined): asserts apiKey is string {
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
}

const printSummary = (totalCount: number, processed: number, failed: number): void => {
  console.log('\n--- Summary ---');
  console.log(`Total venues: ${totalCount}`);
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success: ${processed - failed}`);
};

(async () => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const options = parseArgs();

  validateApiKey(apiKey);

  const allVenues = loadAllVenues(DATA_SOURCES);

  console.log('\n=== Processing geocoding ===');
  console.log(`Total venues: ${allVenues.length}`);

  const venuesToGeocode = options.limit ? allVenues.slice(0, options.limit) : allVenues;

  if (options.limit) {
    console.log(`Limited to: ${options.limit} (test mode)`);
  }

  if (options.dryRun) {
    console.log('\n[Dry Run] Would process:');

    venuesToGeocode.forEach((venue, index) => {
      console.log(`${index + 1}. ${venue.address}`);
    });

    printSummary(allVenues.length, 0, 0);
    return;
  }

  const overrides = loadOverrides();
  console.log(`Loaded ${Object.keys(overrides).length} geocoding override(s)`);

  const geocodeResult = await geocodeVenuesSequentially(venuesToGeocode, apiKey, overrides);

  const geocodedById = new Map(geocodeResult.geocodedVenues.map((venue) => [venue.id, venue]));

  const updatedVenues = allVenues.map((venue) => geocodedById.get(venue.id) ?? venue);

  const venuesGroupedBySourceId = groupBySourceId(updatedVenues);

  saveCleanedData(venuesGroupedBySourceId);
  printSummary(allVenues.length, geocodeResult.processed, geocodeResult.failed);
})();
