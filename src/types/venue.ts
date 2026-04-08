export interface LatLng {
  lat: number;
  lng: number;
}

export interface RawVenue {
  id: string;
  name: string;
  address: string;
  serviceTypes?: string[];
  petTypes?: string[];
  phone?: string;
  imageUrl?: string;
}

export interface Venue extends RawVenue {
  sourceCity: string;
  district?: string;
  location?: LatLng;
}

export interface SourceData {
  sourceCity: string;
  scrapedAt: number;
  venues: RawVenue[];
}

type OutputVenue = Omit<Venue, 'sourceCity'>;

export interface CleanedData {
  updatedAt: number;
  venues: Record<string, OutputVenue[]>;
}
