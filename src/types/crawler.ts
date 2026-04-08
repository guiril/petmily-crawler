import type { RawVenue } from './venue.ts';

export interface CrawlResult {
  lastUpdate: string | null;
  venues: RawVenue[];
}

export type CrawlerFn = (url: string) => Promise<CrawlResult>;

export interface DataSource {
  id: string;
  city: string;
  url: string;
}

