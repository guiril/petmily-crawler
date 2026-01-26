import type { Crawler } from '../types/index.ts';
import { TaichungCrawler } from './taichung.ts';

export const getCrawler = (sourceId: string): Crawler => {
  switch (sourceId) {
    case 'taichung':
      return new TaichungCrawler();
    default:
      throw new Error(`Unknown crawler source: ${sourceId}`);
  }
};
