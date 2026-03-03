import type { GeocodeOptions, GeocodeResult } from './types/index.ts';
import { TAIWAN_CITIES } from './constants/cities.ts';

const GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

// Matches the building number (and anything after) at the end of a string.
// Connectors: -, 、, 之, / cover cases like 82之1號, 64、66號, 1-2號
const BUILDING_NUMBER_AT_END = /\d[\d\-、之\/]*號$/;
const BUILDING_NUMBER_WITH_TAIL = /\d[\d\-、之\/]*號.*$/;

interface AddressParts {
  base: string;
  suffix: string;
}

interface PreparedAddress {
  searchAddress: string;
  originalBase: string;
  suffix: string;
}

interface ApiResult {
  formatted_address: string;
  address_components: Array<{
    long_name: string;
    types: string[];
  }>;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface GeocodeApiResponse {
  status: string;
  results: ApiResult[];
  error_message?: string;
}

const splitAtBuildingNumber = (address: string): AddressParts => {
  let lastIdx = -1;

  for (let i = 0; i < address.length; i++) {
    if (address[i] === '號' && i > 0 && /\d/.test(address[i - 1])) {
      lastIdx = i;
    }
  }

  if (lastIdx === -1 || lastIdx === address.length - 1) {
    return { base: address, suffix: '' };
  }

  return {
    base: address.slice(0, lastIdx + 1),
    suffix: address.slice(lastIdx + 1),
  };
};

const prepareAddress = (
  address: string,
  sourceCity: string,
): PreparedAddress => {
  const { base, suffix } = splitAtBuildingNumber(address);
  const hasCity = TAIWAN_CITIES.some((city) => base.startsWith(city));

  return {
    searchAddress: hasCity ? base : `${sourceCity}${base}`,
    originalBase: base,
    suffix,
  };
};

const buildFormattedAddress = (
  geocodedAddress: string,
  originalBase: string,
  suffix: string,
): string => {
  const cleaned = geocodedAddress.replace(/^\d+台灣/, '');

  const originalNumberMatch = originalBase.match(BUILDING_NUMBER_AT_END);

  if (!originalNumberMatch) {
    return suffix ? `${cleaned}${suffix}` : cleaned;
  }

  const streetPrefix = cleaned.replace(BUILDING_NUMBER_WITH_TAIL, '');

  if (!streetPrefix || streetPrefix === cleaned) {
    return suffix ? `${cleaned}${suffix}` : cleaned;
  }

  return `${streetPrefix}${originalNumberMatch[0]}${suffix}`;
};

const parseResult = (
  result: ApiResult,
  originalBase: string,
  suffix: string,
): GeocodeResult => {
  const components = result.address_components;

  const city = components.find(
    (component) => component.types.includes('administrative_area_level_1'),
  )?.long_name;

  const district = components.find(
    (component) => /[區鄉鎮]$/.test(component.long_name),
  )?.long_name;

  return {
    formattedAddress: buildFormattedAddress(result.formatted_address, originalBase, suffix),
    city,
    district,
    location: result.geometry.location,
  };
};

// https://developers.google.com/maps/documentation/geocoding/requests-geocoding
export const geocodeAddress = async (
  address: string,
  apiKey: string,
  { sourceCity }: GeocodeOptions,
): Promise<GeocodeResult | null> => {
  const { searchAddress, originalBase, suffix } = prepareAddress(address, sourceCity);

  const params = new URLSearchParams({
    address: searchAddress,
    key: apiKey,
    language: 'zh-TW',
    region: 'tw',
  });

  const response = await fetch(`${GEOCODING_API_URL}?${params}`);
  const data: GeocodeApiResponse = await response.json();
  const { status } = data;

  if (status === 'OK') {
    return parseResult(data.results[0], originalBase, suffix);
  }

  if (status === 'ZERO_RESULTS') {
    console.warn(`No results for: ${address}`, data.error_message);
    return null;
  }

  const errorMessage = data.error_message ?? status;

  if (status === 'OVER_QUERY_LIMIT' || status === 'OVER_DAILY_LIMIT') {
    throw new Error(`API quota exceeded: ${errorMessage}`);
  }

  throw new Error(`Geocoding API error: ${errorMessage}`);
};
