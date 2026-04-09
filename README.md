# Petmily Crawler

Data pipeline for [Petmily](https://github.com/guiril/petmily), a pet-friendly venue finder. Crawls venue data from government sources, geocodes addresses via Google Maps API, and outputs a structured JSON file consumed by the API server.

## Pipeline

```
crawl → geocode addresses → venues.json
```

1. **Crawl** — Fetches venue listings from government websites using Cheerio
2. **Geocode** — Normalizes addresses and resolves coordinates via Google Maps Geocoding API
3. **Output** — Writes `data/venues.json`, grouped by city

## Data Sources

| City | Source                                                                                     |
| ---- | ------------------------------------------------------------------------------------------ |
| 台中 | [臺中市動物保護防疫處](https://www.animal.taichung.gov.tw/1521448/1521512/1521537/1521539) |

## Tech Stack

- **Runtime** — Node.js, TypeScript
- **Crawling** — Cheerio
- **Geocoding** — Google Maps Geocoding API
