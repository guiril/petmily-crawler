import type { Venue } from './venue.ts';

export interface CrawlResult {
  lastUpdate: string | null;
  venues: Venue[];
}

export interface Crawler {
  crawl(source: DataSource): Promise<CrawlResult>;
  close(): Promise<void>;
}

export interface DataSource {
  id: string;
  city: string;
  url: string;
}

export interface CrawlerConfig {
  headless: boolean;
  timeout: number;
  launchOptions: {
    headless: boolean;
    args: string[];
    executablePath: string | undefined;
  };
}
