export interface LatLng {
  lat: number;
  lng: number;
}

const SERVICE_TYPES = ['餐飲', '住宿', '娛樂', '其他'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const isServiceType = (value: string): value is ServiceType =>
  (SERVICE_TYPES as readonly string[]).includes(value);

export interface RawVenue {
  id: string;
  name: string;
  address?: string;
  location?: LatLng;
  serviceTypes?: ServiceType[];
  petTypes?: string[];
  phone?: string;
  imageUrl?: string;
}

export interface Venue extends RawVenue {
  sourceCity: string;
  district?: string;
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
