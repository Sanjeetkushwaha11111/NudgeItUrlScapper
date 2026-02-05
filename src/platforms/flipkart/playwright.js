const { chromium } = require("playwright");
const { toNumber } = require("../../utils/number");
const fs = require("fs");
const path = require("path");

async function scrapeFlipkart(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: "en-IN",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  });

  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    const debug = {
      finalUrl: page.url(),
      status: resp ? resp.status() : null,
    };

    // IMPORTANT: do NOT wait on a selector. Just "try" and move on.
    const title = await page
      .locator("span.B_NuCI, h1")
      .first()
      .textContent()
      .catch(() => null);

    // Extract price from JSON-LD first; DOM is fallback.
    const jsonLdBlocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents()
      .catch(() => []);

    let price = null;
    let mrp = null;
    let currency = "INR";
    let titleFromLd = null;
    let productIdFromLd = null;
    let inStockFromLd = null;
    let source = "playwright:dom";

    for (const block of jsonLdBlocks) {
      try {
        const parsed = JSON.parse(block);
        const items = Array.isArray(parsed) ? parsed : [parsed];

        for (const item of items) {
          if (item && item["@type"] === "Product") {
            titleFromLd = item.name || titleFromLd;
            productIdFromLd = item.sku || productIdFromLd;

            const offers = item.offers || {};
            if (offers.price != null) {
              price =
                typeof offers.price === "number"
                  ? offers.price
                  : toNumber(String(offers.price));
            }
            if (offers.priceCurrency) currency = offers.priceCurrency;

            if (typeof offers.availability === "string") {
              inStockFromLd = offers.availability.includes("InStock");
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (price != null) {
      source = "playwright:jsonld";
    }

    // DOM fallback if JSON-LD not present
    if (!price) {
      const priceText = await page
        .locator("div.hZ3P6w, div.Nx9bqj, div._30jeq3, div._16Jk6d, span._30jeq3")
        .first()
        .textContent()
        .catch(() => null);

      price = toNumber(priceText);
    }

    if (!mrp) {
      const mrpText = await page
        .locator("div.kRYCnD, div._3I9_wc, span._2p6lqe, div.yRaY8j")
        .first()
        .textContent()
        .catch(() => null);
      mrp = toNumber(mrpText);
    }

    const inStock =
      typeof inStockFromLd === "boolean"
        ? inStockFromLd
        : (await page
          .locator("button:has-text('NOTIFY'), button:has-text('NOTIFY ME'), text=Sold Out")
          .count()) === 0;

    // If still missing critical fields, dump debug artifacts
    if (!price) {
      const outDir = path.join(process.cwd(), "pw_debug");
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, "page.html"), await page.content());
      await page.screenshot({ path: path.join(outDir, "page.png"), fullPage: true });
      debug.dumped = true;
      debug.dumpPath = outDir;
    }

    return {
      debug,
      title: titleFromLd || (title ? title.trim() : null),
      productId: productIdFromLd || null,
      price,
      mrp,
      inStock,
      currency,
      source,
    };
  } finally {
    await page.close().catch(() => { });
    await browser.close().catch(() => { });
  }
}

module.exports = { scrapeFlipkart };
