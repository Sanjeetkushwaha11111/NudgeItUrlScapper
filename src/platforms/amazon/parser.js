const cheerio = require("cheerio");

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function firstText($, selectors) {
  for (const sel of selectors) {
    const text = $(sel).first().text();
    if (text && text.trim()) return text.trim();
  }
  return null;
}

function parseMoney(text) {
  if (!text) return null;

  const cleaned = String(text).replace(/[^0-9.,]/g, "").replace(/,/g, "");
  if (!cleaned) return null;

  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) return null;

  return Math.round(value);
}

function extractProductFromJsonLd($) {
  const scripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).text();
    if (!raw) continue;

    const parsed = safeJsonParse(raw);
    if (!parsed) continue;

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
        price,
        currency,
        inStock,
      };
    }
  }

  return null;
}

function parse(html) {
  const $ = cheerio.load(html);

  const fromLd = extractProductFromJsonLd($);

  const titleDom = firstText($, ["#productTitle", "h1"]);
  const priceDom = firstText($, [
    "#priceblock_ourprice",
    "#priceblock_dealprice",
    "#priceblock_saleprice",
    "#corePrice_feature_div .a-price .a-offscreen",
    "span.a-price .a-offscreen",
  ]);
  const mrpDom = firstText($, [
    "#priceblock_listprice",
    "#corePrice_feature_div .a-text-price .a-offscreen",
    "span.a-text-price .a-offscreen",
  ]);
  const availability = firstText($, ["#availability span", "#availability"]);

  const inStockDom =
    availability == null
      ? null
      : !/currently unavailable|out of stock|unavailable/i.test(availability);

  return {
    title: fromLd?.title || titleDom || null,
    productId: null,
    price: fromLd?.price ?? parseMoney(priceDom),
    mrp: parseMoney(mrpDom),
    inStock: typeof fromLd?.inStock === "boolean" ? fromLd.inStock : inStockDom,
    currency: fromLd?.currency || "INR",
    source: fromLd ? "http:jsonld" : "http:dom",
  };
}

module.exports = { parse };
