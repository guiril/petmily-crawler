import { LatLng } from './venue.ts';

export interface GeocodeOptions {
  defaultCity?: string;
}

export interface GeocodeResult {
  formattedAddress: string;
  city: string | undefined;
  district: string | undefined;
  location: LatLng;
}

export interface BatchGeocodeOptions {
  delayMs?: number;
  onProgress?: (current: number, total: number, address: string) => void;
}

export interface BatchGeocodeResult {
  address: string;
  result: GeocodeResult | null;
  error: string | null;
}
