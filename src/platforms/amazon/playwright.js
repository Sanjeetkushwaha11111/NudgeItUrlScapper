const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

function parseMoney(text) {
  if (!text) return null;

  const cleaned = String(text).replace(/[^0-9.,]/g, "").replace(/,/g, "");
  if (!cleaned) return null;

  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) return null;

  return Math.round(value);
}

function parseSplitPrice(wholeText, fractionText) {
  if (!wholeText) return null;

  const whole = String(wholeText).replace(/[^0-9]/g, "");
  const fraction = String(fractionText || "").replace(/[^0-9]/g, "");
  if (!whole) return null;

  const combined = fraction ? `${whole}.${fraction}` : whole;
  const value = Number.parseFloat(combined);
  if (Number.isNaN(value)) return null;

  return Math.round(value);
}

function cleanTitle(text) {
  if (!text) return null;
  const normalized = String(text).replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (/product summary presents key product information/i.test(normalized)) return null;
  if (/keyboard shortcut/i.test(normalized)) return null;
  if (normalized.length < 8) return null;
  return normalized;
}

async function getTitleFromDom(page) {
  const selectors = [
    "#productTitle",
    "#title #productTitle",
    "#title span",
    "meta[property='og:title']",
  ];

  for (const selector of selectors) {
    if (selector.startsWith("meta[")) {
      const value = await page.locator(selector).first().getAttribute("content").catch(() => null);
      const cleaned = cleanTitle(value);
      if (cleaned) return cleaned;
      continue;
    }

    const value = await page.locator(selector).first().textContent().catch(() => null);
    const cleaned = cleanTitle(value);
    if (cleaned) return cleaned;
  }

  return null;
}

function findProductFromJsonLd(blocks) {
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (!item || item["@type"] !== "Product") continue;

        const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
        let price = null;
        let currency = null;
        let inStock = null;

        for (const offer of offers) {
          if (!offer) continue;

          const rawPrice = offer.price ?? offer?.priceSpecification?.price ?? null;
          if (price == null && rawPrice != null) {
            price = typeof rawPrice === "number" ? Math.round(rawPrice) : parseMoney(rawPrice);
          }

          if (!currency && offer.priceCurrency) currency = offer.priceCurrency;

          if (inStock == null && typeof offer.availability === "string") {
            inStock = offer.availability.includes("InStock");
          }
        }

        return {
          title: item.name || null,
          productId: item.sku || item.productID || item.mpn || item.asin || null,
          price,
          currency,
          inStock,
        };
      }
    } catch {}
  }

  return null;
}

async function scrapeAmazon(url, options = {}) {
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

    const pincode = options.pincode ? String(options.pincode).trim() : "";
    if (/^\d{6}$/.test(pincode)) {
      const pinInput = page.locator(
        "input#GLUXZipUpdateInput, input[name='zipCode'], input[placeholder*='PIN'], input[placeholder*='pincode']"
      );
      if (await pinInput.count()) {
        await pinInput.first().fill(pincode).catch(() => {});
        await page.locator("#GLUXZipUpdate-announce, input.a-button-input").first().click().catch(() => {});
        await page.waitForTimeout(1800);
      }
    }

    const jsonLdBlocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents()
      .catch(() => []);

    const fromLd = findProductFromJsonLd(jsonLdBlocks);

    const titleDom = await getTitleFromDom(page);
    const priceDom = await page
      .locator(
        "#priceblock_ourprice, #priceblock_dealprice, #priceblock_saleprice, #corePrice_feature_div .a-price .a-offscreen, span.a-price .a-offscreen"
      )
      .first()
      .textContent()
      .catch(() => null);
    const priceWholeDom = await page
      .locator("#corePrice_feature_div .a-price-whole, span.a-price-whole")
      .first()
      .textContent()
      .catch(() => null);
    const priceFractionDom = await page
      .locator("#corePrice_feature_div .a-price-fraction, span.a-price-fraction")
      .first()
      .textContent()
      .catch(() => null);
    const mrpDom = await page
      .locator(
        "#priceblock_listprice, #corePrice_feature_div .a-text-price .a-offscreen, span.a-text-price .a-offscreen"
      )
      .first()
      .textContent()
      .catch(() => null);

    const availabilityText = await page
      .locator("#availability span, #availability")
      .first()
      .textContent()
      .then((t) => (t ? t.trim() : null))
      .catch(() => null);

    const deliveryText = await page
      .locator(
        "#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE span, #mir-layout-DELIVERY_BLOCK-slot-DELIVERY_MESSAGE span, #deliveryBlockMessage, #contextualIngressPtLabel_deliveryShortLine"
      )
      .first()
      .textContent()
      .then((t) => (t ? t.trim() : null))
      .catch(() => null);

    const deliveryDateMatch =
      deliveryText && deliveryText.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d{1,2}\s+[A-Za-z]{3,9}\b|\b\d{1,2}\s+[A-Za-z]{3,9}\b/i);

    const inStock =
      typeof fromLd?.inStock === "boolean"
        ? fromLd.inStock
        : availabilityText == null
          ? null
          : !/currently unavailable|out of stock|unavailable/i.test(availabilityText);

    const deliverable =
      deliveryText == null
        ? null
        : !/not deliverable|cannot be delivered|unavailable/i.test(deliveryText);

    const result = {
      debug,
      title: cleanTitle(fromLd?.title) || titleDom,
      productId: fromLd?.productId || null,
      price: fromLd?.price ?? parseMoney(priceDom) ?? parseSplitPrice(priceWholeDom, priceFractionDom),
      mrp: parseMoney(mrpDom),
      inStock,
      deliverable,
      deliveryText: deliveryText || null,
      deliveryDate: deliveryDateMatch ? deliveryDateMatch[0].replace(/^,\s*/, "").trim() : null,
      currency: fromLd?.currency || "INR",
      source: fromLd ? "playwright:jsonld" : "playwright:dom",
    };

    if (!result.price) {
      const outDir = path.join(process.cwd(), "pw_debug");
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, "amazon_page.html"), await page.content());
      await page.screenshot({ path: path.join(outDir, "amazon_page.png"), fullPage: true });
      result.debug.dumped = true;
      result.debug.dumpPath = outDir;
    }

    return result;
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

module.exports = { scrapeAmazon };
