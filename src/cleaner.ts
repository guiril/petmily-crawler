import { fileURLToPath } from 'url';
import path from 'path';
import { writeFileSync } from 'fs';

import type {
  DataSource,
  RawVenue,
  SourceData,
  Venue,
  CleanedData,
  CleanerOptions,
  GeocodeResult,
} from './types/index.ts';

import 'dotenv/config';

import { DATA_SOURCES } from '../config.ts';
import { geocodeAddress, reverseGeocodeLocation } from './geocoding.ts';
import { readData } from './storage.ts';

const GEOCODE_DELAY_MS = 200;

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

const getDataFilePath = (sourceId: string): string =>
  path.join(__dirname, '..', 'data', 'raw', `${sourceId}.json`);

const getOutputFilePath = (): string => path.join(__dirname, '..', 'data', 'venues.json');

const getOverridesFilePath = (): string =>
  path.join(__dirname, '..', 'data', 'geocoding-overrides.json');

const loadOverrides = (): Record<string, GeocodeResult> => {
  try {
    return JSON.parse(readData(getOverridesFilePath()));
  } catch {
    return {};
  }
};

type GeocodingCache = Record<string, GeocodeResult>;

const getCacheFilePath = (): string => path.join(__dirname, '..', 'data', 'geocoding-cache.json');

const loadCache = (): GeocodingCache => {
  try {
    return JSON.parse(readData(getCacheFilePath()));
  } catch {
    return {};
  }
};

const saveCache = (cache: GeocodingCache): void => {
  writeFileSync(getCacheFilePath(), JSON.stringify(cache, null, 2));
};

const getCacheKey = (venue: VenueWithSource): string | null => {
  if (venue.address) return venue.address;
  if (venue.location) return `${venue.location.lat},${venue.location.lng}`;
  return null;
};

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
        const rawValue = arg.split('=')[1];
        const value = Number(rawValue);

        if (Number.isNaN(value) || value < 0) {
          console.error(`Invalid --limit value: ${rawValue}`);
          process.exit(1);
        }
        return { ...acc, limit: value };
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

const toVenueWithSource = (
  venue: RawVenue,
  sourceCity: string,
  sourceId: string,
): VenueWithSource => ({
  ...venue,
  sourceCity,
  sourceId,
});

const loadAllVenues = (sources: DataSource[]): VenueWithSource[] => {
  console.log('=== Loading all sources ===');

  const allVenues = sources.flatMap((source) => {
    console.log(`Loading ${source.city}...`);

    const sourceId = source.id;
    const dataFilePath = getDataFilePath(sourceId);
    const venueData: SourceData = JSON.parse(readData(dataFilePath));

    const venues = venueData.venues.map((venue) =>
      toVenueWithSource(venue, venueData.sourceCity, sourceId),
    );

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
  cache: GeocodingCache,
  cacheKey: string | null,
): Promise<VenueWithSource> => {
  if (venue.address) {
    console.log(`  Address: ${venue.address}`);
    const result = await geocodeAddress(venue.address, apiKey, { sourceCity: venue.sourceCity });

    if (!result) {
      console.log('  No result found');
      throw new Error('No geocoding result');
    }

    console.log(`  Updated:  ${result.formattedAddress}`);
    if (cacheKey) cache[cacheKey] = result;
    return mergeGeocodedData(venue, result);
  }

  if (venue.location) {
    console.log(`  Location: ${venue.location.lat},${venue.location.lng}`);
    const result = await reverseGeocodeLocation(venue.location, apiKey);

    if (!result) {
      console.log('  No result found');
      throw new Error('No geocoding result');
    }

    console.log(`  Updated:  ${result.formattedAddress}`);
    if (cacheKey) cache[cacheKey] = result;
    return mergeGeocodedData(venue, result);
  }

  console.log('  Skipped: no address or location');
  return venue;
};

// Cannot use Promise.all due to API rate limiting requirements
const geocodeVenuesSequentially = async (
  venues: VenueWithSource[],
  apiKey: string,
  overrides: Record<string, GeocodeResult>,
  cache: GeocodingCache,
): Promise<GeocodeSummary> => {
  const geocodedVenues: VenueWithSource[] = [];

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < venues.length; i++) {
    const venue = venues[i];
    console.log(`[${i + 1}/${venues.length}] ${venue.name}`);

    const override = overrides[venue.id];
    const cacheKey = getCacheKey(venue);
    const cached = cacheKey ? cache[cacheKey] : undefined;

    if (override ?? cached) {
      const result = (override ?? cached)!;
      console.log(`  ${override ? 'Override' : 'Cache'}: ${result.formattedAddress}`);

      geocodedVenues.push(mergeGeocodedData(venue, result));
      processed += 1;
      continue;
    }

    try {
      const updatedVenue = await geocodeOneVenue(venue, apiKey, cache, cacheKey);

      geocodedVenues.push(updatedVenue);
      processed += 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      processed += 1;
      failed += 1;

      if (errorMessage.includes('quota')) {
        console.error('API quota exceeded. Stopping.');
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
  const cache = loadCache();

  console.log(`Loaded ${Object.keys(overrides).length} geocoding override(s)`);
  console.log(`Loaded ${Object.keys(cache).length} cached result(s)`);

  const geocodeResult = await geocodeVenuesSequentially(venuesToGeocode, apiKey, overrides, cache);

  saveCache(cache);

  const geocodedById = new Map(geocodeResult.geocodedVenues.map((venue) => [venue.id, venue]));

  const updatedVenues = allVenues.map((venue) => geocodedById.get(venue.id) ?? venue);
  const venuesGroupedBySourceId = groupBySourceId(updatedVenues);

  saveCleanedData(venuesGroupedBySourceId);
  printSummary(allVenues.length, geocodeResult.processed, geocodeResult.failed);
})();
