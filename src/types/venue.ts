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
  district?: string;
  location?: LatLng;
}

export interface VenueData {
  sourceCity: string;
  lastUpdate: string | null;
  scrapedAt: number;
  venues: Venue[];
}
