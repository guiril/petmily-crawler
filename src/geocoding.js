import { TAIWAN_CITIES } from './constants/citys.js';

const GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

const FLOOR_PATTERN = /(\d+[Ff樓]|[Bb]\d+)$/;

const extractFloor = (address) => {
  const match = address.match(FLOOR_PATTERN);
  if (match) {
    return {
      addressWithoutFloor: address.slice(0, match.index).trim(),
      floor: match[0],
    };
  }
  return { addressWithoutFloor: address, floor: null };
};

const formatAddress = (googleAddress, floor) => {
  const cleaned = googleAddress
    .replace(/^\d{3}台灣/, '')
    .replace(/^\d{3}/, '');

  return floor ? `${cleaned}${floor}` : cleaned;
};

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export const geocodeAddress = async (address, apiKey, options = {}) => {
  const { defaultCity } = options;
  const { addressWithoutFloor, floor } = extractFloor(address);

  const hasCity = TAIWAN_CITIES.some((city) => addressWithoutFloor.startsWith(city));
  const searchAddress = hasCity || !defaultCity
    ? addressWithoutFloor
    : `${defaultCity}${addressWithoutFloor}`;

  const params = new URLSearchParams({
    address: searchAddress,
    key: apiKey,
    language: 'zh-TW',
    region: 'tw',
  });

  const response = await fetch(`${GEOCODING_API_URL}?${params}`);
  const data = await response.json();

  if (data.status === 'OK' && data.results.length > 0) {
    const result = data.results[0];
    const components = result.address_components;

    const city = components.find((c) => c.types.includes('administrative_area_level_1'))?.long_name;

    const district = components.find((c) => c.types.includes('administrative_area_level_3'))?.long_name;

    return {
      formattedAddress: formatAddress(result.formatted_address, floor),
      city,
      district,
      location: result.geometry.location,
    };
  }

  if (data.status === 'ZERO_RESULTS') {
    console.warn(`No results for: ${address}`);
    return null;
  }

  if (data.status === 'OVER_QUERY_LIMIT') {
    throw new Error('API quota exceeded');
  }

  throw new Error(`Geocoding API error: ${data.status}`);
};

export const batchGeocode = async (addresses, apiKey, options = {}) => {
  const { delayMs = 200, onProgress } = options;
  const results = [];

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];

    try {
      const result = await geocodeAddress(address, apiKey);
      results.push({ address, result, error: null });
    } catch (error) {
      results.push({ address, result: null, error: error.message });
    }

    onProgress?.(i + 1, addresses.length, address);

    if (i < addresses.length - 1) {
      await delay(delayMs);
    }
  }

  return results;
};
