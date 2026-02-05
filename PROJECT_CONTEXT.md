# Project Context (NudgeItUrlScapper)

Quick reference for future edits and onboarding.

## Purpose
CLI-based product tracker that scrapes product pages (starting with Flipkart) and logs results to a CSV for Excel. Supports multiple platforms via `src/platforms/`.

## How To Run
- `node index.js`
- Prompts for:
  - `url`, `pincode`, `mobile`, `tracking id`, `tracking method (auto/http/playwright)`

## Output
- Console prints the scrape result.
- CSV log appended at `logs/track.csv` with headers and timestamp.

## Key Flow
1. `index.js` prompts for input and calls `scrape(url, { trackingMethod })`.
2. `src/scrape.js`:
   - Normalizes URL via `src/normalizer.js`.
   - Routes to platform parser:
     - Flipkart: method selection `http` / `playwright` / `auto`.
     - Amazon: HTTP-only (placeholder).
3. Result is logged via `src/utils/trackLog.js`.

## File Structure (Core)
- `index.js`: CLI entry (prompts + logging).
- `src/scrape.js`: main routing and method selection.
- `src/normalizer.js`: platform detection + canonical URL.
- `src/http/fetch.js`: HTTP fetcher (axios).
- `src/platforms/flipkart/`
  - `index.js`: re-export of parser.
  - `parser.js`: JSON-LD + DOM fallback extraction.
  - `playwright.js`: Playwright-based extraction (JSON-LD first).
- `src/platforms/amazon/index.js`: placeholder for Amazon parser.
- `src/utils/number.js`: `toNumber` helper.
- `src/utils/trackLog.js`: CSV logger for Excel.

## Tracking Methods
- `auto`: HTTP first, then Playwright fallback if price missing.
- `http`: HTTP only.
- `playwright`: Playwright only.

## Data Fields
Returned by `scrape()`:
- `platform`, `productId`, `title`, `price`, `mrp`, `inStock`, `currency`
- `trackingMethod`, `timestamp`, `source`

Logged to CSV:
- `timestamp`, `url`, `pincode`, `mobile`, `id`, `trackingMethod`
- `platform`, `productId`, `title`, `price`, `mrp`, `inStock`, `currency`, `source`

## Notes
- Flipkart selectors can change; JSON-LD is the most stable.
- Playwright should be used when HTTP is blocked or missing price.
