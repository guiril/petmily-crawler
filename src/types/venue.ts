export interface LatLng {
  lat: number;
  lng: number;
}

export interface Venue {
  number: string;
  name: string;
  serviceType: string;
  petType: string;
  address: string;
  phone: string;
  city?: string;
  district?: string;
  location?: LatLng;
}

export interface SourceDataByCity {
  sourceCity: string;
  lastUpdate: string | null;
  scrapedAt: number;
  venues: Venue[];
}

export interface CleanedData {
  updatedAt: number;
  venues: Record<string, Venue[]>;
}
