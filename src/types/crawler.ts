import type { RawVenue } from './venue.ts';

export type CrawlerFn = (url: string) => Promise<RawVenue[]>;

export interface DataSource {
  id: string;
  /** City name prepended to addresses during geocoding (e.g. "臺中市") */
  city: string;
  url: string;
}
