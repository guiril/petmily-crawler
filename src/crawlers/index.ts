import type { CrawlerFn } from '../types/index.ts';
import { crawlTaipei } from './taipei.ts';
import { crawlTaichung } from './taichung.ts';

export const getCrawler = (sourceId: string): CrawlerFn => {
  switch (sourceId) {
    case 'taipei':
      return crawlTaipei;
    case 'taichung':
      return crawlTaichung;
    default:
      throw new Error(`Unknown crawler source: ${sourceId}`);
  }
};
