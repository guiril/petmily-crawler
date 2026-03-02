import type { GeocodeOptions, GeocodeResult } from './types/index.ts';
import { TAIWAN_CITIES } from './constants/cities.ts';

const GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const FLOOR_PATTERN = /(\d+[Ff樓]|[Bb]\d+)$/;

interface FloorExtraction {
  addressWithoutFloor: string;
  floor: string | null;
}

interface PreparedAddress {
  searchAddress: string;
  floor: string | null;
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

const extractFloor = (address: string): FloorExtraction => {
  const match = address.match(FLOOR_PATTERN);

  if (match) {
    return {
      addressWithoutFloor: address.slice(0, match.index).trim(),
      floor: match[0],
    };
  }

  return { addressWithoutFloor: address, floor: null };
};

const prepareAddress = (
  address: string,
  sourceCity: string
): PreparedAddress => {
  const { addressWithoutFloor, floor } = extractFloor(address);

  const hasCity = TAIWAN_CITIES.some(
    (city) => addressWithoutFloor.startsWith(city)
  );

  return {
    searchAddress: hasCity ? addressWithoutFloor : `${sourceCity}${addressWithoutFloor}`,
    floor,
  };
};

const formatAddress = (
  googleAddress: string,
  floor: string | null
): string => {
  const cleaned = googleAddress
    .replace(/^\d{3}台灣/, '')
    .replace(/^\d{3}/, '');

  return floor ? `${cleaned}${floor}` : cleaned;
};

const parseResult = (
  result: ApiResult,
  floor: string | null
): GeocodeResult => {
  const components = result.address_components;

  const city = components.find(
    (component) => component.types.includes('administrative_area_level_1')
  )?.long_name;

  const district = components.find(
    (component) => /[區鄉鎮]$/.test(component.long_name)
  )?.long_name;

  return {
    formattedAddress: formatAddress(result.formatted_address, floor),
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
  const { searchAddress, floor } = prepareAddress(address, sourceCity);

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
    return parseResult(data.results[0], floor);
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
