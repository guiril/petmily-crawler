export interface CrawlerSelectors {
  updateText: string;
  tableRows: string;
  nextButton: string;
}

export interface DataSource {
  id: string;
  city: string;
  url: string;
  dataFile: string;
  selectors: CrawlerSelectors;
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
