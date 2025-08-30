# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `node app.js` - Run the main crawler application
- `npm install` - Install dependencies
- `npm test` - Currently shows "no test specified" error (tests not implemented)

## Architecture Overview

This is a simple web crawler built with Node.js and Puppeteer for scraping pet adoption information from Taichung City's animal shelter website.

### Key Components

- **app.js** - Main entry point containing the Puppeteer-based web scraping logic
  - Launches a non-headless browser instance
  - Navigates to Taichung animal shelter website
  - Extracts text content from specific DOM elements using CSS selectors
  - Currently targets red-colored text in bulletin articles

### Technology Stack

- **Node.js (v20.16.0)** with ES modules (`"type": "module"` in package.json)
- **Puppeteer (v24.17.0)** for browser automation and web scraping

### Current State

The application is in early development stage with basic scraping functionality. The crawler:
- Runs in non-headless mode for debugging
- Targets a specific government website for animal shelter information
- Contains commented-out code suggesting future search and navigation features
- Does not have browser cleanup (browser.close() is commented out)
- No error handling or data persistence implemented

### Development Notes

- Uses ES6 import syntax
- Browser viewport set to 1080x1024 for consistent rendering
- Target website: `https://www.animal.taichung.gov.tw/1521448/1521512/1521537/1521539`
- Selector pattern: `article.bulletin p span[style*="color: #ff0000"]` for extracting highlighted information