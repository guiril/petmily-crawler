export interface LatLng {
  lat: number;
  lng: number;
}

export interface RawVenue {
  id: string;
  name: string;
  address: string;
  serviceType?: string;
  petType?: string;
  phone?: string;
}

export interface Venue extends RawVenue {
  defaultCity: string;
  district?: string;
  location?: LatLng;
}

export interface SourceData {
  sourceCity: string;
  lastUpdate: string | null;
  scrapedAt: number;
  venues: RawVenue[];
}

export type OutputVenue = Omit<Venue, 'defaultCity'>;

export interface CleanedData {
  updatedAt: number;
  venues: Record<string, OutputVenue[]>;
}
