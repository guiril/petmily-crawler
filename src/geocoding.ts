import type { GeocodeOptions, GeocodeResult, LatLng } from './types/index.ts';
import { TAIWAN_CITIES } from './constants/cities.ts';

const GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

// Google may normalize street numbers (e.g. 82之1號 → different format), so we preserve the original.
// Connectors (-, 、, 之, /) cover cases like 82之1號, 64、66號, 1-2號
const STREET_NUMBER_AT_END = /\d[\d\-、之/]*號$/;
const STREET_NUMBER_WITH_TAIL = /\d[\d\-、之/]*號.*$/;

interface AddressParts {
  baseAddress: string;
  subAddress: string;
}

interface PreparedAddress extends AddressParts {
  searchAddress: string;
}

// https://developers.google.com/maps/documentation/geocoding/requests-geocoding
interface AddressComponent {
  long_name: string;
  types: string[];
}

interface ApiResult {
  formatted_address: string;
  address_components: AddressComponent[];
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

const splitAtStreetNumber = (address: string): AddressParts => {
  const addressLength = address.length;
  let lastStreetNumberIndex = -1;

  for (let i = 0; i < addressLength; i++) {
    if (address[i] === '號' && i > 0 && /\d/.test(address[i - 1])) {
      lastStreetNumberIndex = i;
    }
  }

  if (lastStreetNumberIndex === -1 || lastStreetNumberIndex === addressLength - 1) {
    return { baseAddress: address, subAddress: '' };
  }

  return {
    baseAddress: address.slice(0, lastStreetNumberIndex + 1),
    subAddress: address.slice(lastStreetNumberIndex + 1),
  };
};

const prepareAddress = (address: string, sourceCity: string): PreparedAddress => {
  const { baseAddress, subAddress } = splitAtStreetNumber(address);
  const hasCity = TAIWAN_CITIES.some((city) => baseAddress.startsWith(city));

  return {
    searchAddress: hasCity ? baseAddress : `${sourceCity}${baseAddress}`,
    baseAddress,
    subAddress,
  };
};

const buildFormattedAddress = (
  geocodedAddress: string,
  baseAddress: string,
  subAddress: string,
): string => {
  const trimmedAddress = geocodedAddress.replace(/^\d+台灣/, '');
  const streetNumberMatch = baseAddress.match(STREET_NUMBER_AT_END);

  if (!streetNumberMatch) return trimmedAddress;

  const streetPrefix = trimmedAddress.replace(STREET_NUMBER_WITH_TAIL, '');

  if (!streetPrefix || streetPrefix === trimmedAddress) {
    return `${trimmedAddress}${subAddress}`;
  }

  return `${streetPrefix}${streetNumberMatch[0]}${subAddress}`;
};

const findComponentByType = (components: AddressComponent[], type: string): string | undefined =>
  components.find((component) => component.types.includes(type))?.long_name;

const parseResult = (result: ApiResult, baseAddress: string, subAddress: string): GeocodeResult => {
  const components = result.address_components;
  const city = findComponentByType(components, 'administrative_area_level_1');
  const district = findComponentByType(components, 'administrative_area_level_2');

  return {
    formattedAddress: buildFormattedAddress(result.formatted_address, baseAddress, subAddress),
    city,
    district,
    location: result.geometry.location,
  };
};

const callGeocodeApi = async (params: URLSearchParams, label: string): Promise<ApiResult | null> => {
  const response = await fetch(`${GEOCODING_API_URL}?${params}`);
  const data: GeocodeApiResponse = await response.json();
  const { status } = data;

  if (status === 'OK') return data.results[0];

  if (status === 'ZERO_RESULTS') {
    console.warn(`No results for: ${label}`, data.error_message);
    return null;
  }

  const errorMessage = data.error_message ?? status;

  if (status === 'OVER_QUERY_LIMIT' || status === 'OVER_DAILY_LIMIT') {
    throw new Error(`API quota exceeded: ${errorMessage}`);
  }

  throw new Error(`Geocoding API error: ${errorMessage}`);
};

export const geocodeAddress = async (
  address: string,
  apiKey: string,
  { sourceCity }: GeocodeOptions,
): Promise<GeocodeResult | null> => {
  const { searchAddress, baseAddress, subAddress } = prepareAddress(address, sourceCity);

  const params = new URLSearchParams({
    address: searchAddress,
    key: apiKey,
    language: 'zh-TW',
    region: 'tw',
  });

  const result = await callGeocodeApi(params, address);
  return result ? parseResult(result, baseAddress, subAddress) : null;
};

export const reverseGeocodeLocation = async (
  location: LatLng,
  apiKey: string,
): Promise<GeocodeResult | null> => {
  const params = new URLSearchParams({
    latlng: `${location.lat},${location.lng}`,
    key: apiKey,
    language: 'zh-TW',
    region: 'tw',
  });

  const result = await callGeocodeApi(params, `${location.lat},${location.lng}`);
  return result ? parseResult(result, '', '') : null;
};
