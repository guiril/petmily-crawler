import { createHash } from 'crypto';

import * as cheerio from 'cheerio';
import type { RawVenue, ServiceType } from '../types/index.ts';

const FOLDER_SERVICE_TYPE_MAP: Record<string, ServiceType> = {
  餐廳: '餐飲',
  飯店旅館業: '住宿',
  '臺北市狗運動公園、狗活動區': '娛樂',
  寵物服務: '其他',
  ㄧ般零售業: '其他',
  其他業者: '其他',
};

const generateId = (name: string, lat?: number, lng?: number): string => {
  const input = lat !== undefined && lng !== undefined ? `${lat},${lng}` : name;
  const hash = createHash('sha256').update(input).digest('hex').slice(0, 8);
  return `taipei-${hash}`;
};

const parseCoordinates = (coordText: string) => {
  const parts = coordText.trim().split(',');
  const lng = parseFloat(parts[0]);
  const lat = parseFloat(parts[1]);

  if (isNaN(lat) || isNaN(lng)) return undefined;

  return { lat, lng };
};

export const crawlTaipei = async (url: string): Promise<RawVenue[]> => {
  console.log(`Starting crawl: ${url}`);

  const response = await fetch(url);
  const kmlText = await response.text();

  const $ = cheerio.load(kmlText, { xmlMode: true });
  const venues: RawVenue[] = [];

  $('Folder').each((_, folder) => {
    const folderName = $(folder).children('name').text().trim();
    const serviceType = FOLDER_SERVICE_TYPE_MAP[folderName];
    if (!serviceType) return;

    $(folder)
      .find('Placemark')
      .each((_, placemark) => {
        const name = $(placemark).children('name').text().trim();
        const description = $(placemark).children('description').text().trim();
        const coordText = $(placemark).find('coordinates').text().trim();

        if (!name) return;

        const location = parseCoordinates(coordText);

        venues.push({
          id: generateId(name, location?.lat, location?.lng),
          name,
          address: description.startsWith('臺北') ? description : undefined,
          location,
          serviceTypes: serviceType ? [serviceType] : undefined,
        });
      });
  });

  return venues;
};
