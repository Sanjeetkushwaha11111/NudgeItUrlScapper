# Amazon Module Context

This file documents the current Amazon implementation and the key places to edit safely.

## Scope

Amazon support is split into:
- HTTP parser: `src/platforms/amazon/parser.js`
- Playwright parser: `src/platforms/amazon/playwright.js`
- Module export: `src/platforms/amazon/index.js`
- Routing entry: `src/scrape.js`

## Execution Flow

1. `index.js` collects user input (`url`, `pincode`, `trackingMethod`, etc.).
2. `src/scrape.js` calls `scrape(url, options)`.
3. `scrape()` routes by platform (`amazon`) and method:
   - `http`: `httpFetchWithMeta` + `amazon.parse(html)`
   - `playwright`: `scrapeAmazon(url, { pincode })`
   - `auto`: HTTP first, Playwright fallback if `price` is missing
4. Final result is returned with timestamp and logged to CSV.

## Important Result Fields

Amazon result includes:
- `productId` (ASIN when available)
- `title`, `price`, `mrp`, `inStock`
- `requestedPincode`, `deliveryPincode`
- `requestedPincodeApplied`, `deliverableForRequestedPincode`
- `deliverable`, `deliveryText`, `deliveryDate`
- `source`, `error`

## HTTP Path Notes (`parser.js`)

Priority:
1. JSON-LD Product + offers
2. DOM fallback selectors

Price parsing:
- Uses a local `parseMoney()` to avoid `399.00 -> 39900` issues.
- Returns rounded INR integer values.

ASIN extraction:
- From JSON-LD product fields when available.
- Falls back to canonical/og URL patterns (`/dp/`, `/gp/product/`, `/product/`).

## Playwright Path Notes (`playwright.js`)

Priority:
1. JSON-LD Product data
2. Scoped DOM price selectors (product/buy-box containers)
3. Split price fallback (`a-price-whole` + `a-price-fraction`)

Pincode flow:
- Attempts location popover trigger.
- Fills zip input and submits.
- Verifies by reading visible delivery/location pincode.
- Exposes whether requested pincode was actually applied.

Freeze prevention:
- Uses short-timeout click helper for optional selectors.
- Avoids long default click waits on missing elements.

Debug dump:
- If price is still missing, dumps:
  - `pw_debug/amazon_page.html`
  - `pw_debug/amazon_page.png`

## Known Constraints

- Amazon layout differs by account/login/region/experiment.
- Same URL can return different delivery/pincode context if session address persists.
- `requestedPincodeApplied: false` means delivery status is not for requested pincode.

## Safe Edit Rules

- Prefer adding new selectors before replacing existing ones.
- Keep JSON-LD as primary source.
- Do not widen selectors to global `span.a-price...` without container scoping.
- Preserve `requestedPincodeApplied` logic; it prevents false delivery claims.

## Quick Test Commands

- Interactive:
  - `node index.js`
- Module load checks:
  - `node -e "require('./src/platforms/amazon/playwright')"`
  - `node -e "require('./src/platforms/amazon/parser')"`

