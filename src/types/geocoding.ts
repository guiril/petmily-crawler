import type { LatLng } from './venue.ts';

export interface GeocodeOptions {
  sourceCity: string;
}

export interface GeocodeResult {
  formattedAddress: string;
  city: string | undefined;
  district: string | undefined;
  location: LatLng;
}
