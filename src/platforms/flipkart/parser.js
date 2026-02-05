const cheerio = require("cheerio");
const { toNumber } = require("../../utils/number");

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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
      if (item && item["@type"] === "Product") {
        const offers = item.offers || {};
        const price = offers.price ?? null;
        const currency = offers.priceCurrency ?? null;
        const availability = offers.availability ?? "";

        return {
          title: item.name || null,
          productId: item.sku || null,
          price: typeof price === "number" ? price : toNumber(String(price)),
          currency: currency || null,
          inStock:
            typeof availability === "string"
              ? availability.includes("InStock")
              : null,
        };
      }
    }
  }

  return null;
}

function firstText($, selectors) {
  for (const sel of selectors) {
    const text = $(sel).first().text();
    if (text && text.trim()) return text.trim();
  }
  return null;
}

function parse(html) {
  const $ = cheerio.load(html);

  // JSON-LD is the most stable signal; DOM is fallback.
  const fromLd = extractProductFromJsonLd($);

  const titleDom = firstText($, ["span.B_NuCI", "h1"]);
  const priceDom = firstText($, [
    "div.hZ3P6w",
    "div.Nx9bqj",
    "div._30jeq3",
    "div._16Jk6d",
    "span._30jeq3",
  ]);
  const mrpDom = firstText($, ["div.kRYCnD", "div._3I9_wc", "span._2p6lqe", "div.yRaY8j"]);

  const notify =
    $("button:contains('NOTIFY')").length > 0 ||
    $("button:contains('NOTIFY ME')").length > 0;
  const soldOut = $("*:contains('Sold Out')").length > 0;
  const inStockDom = !(notify || soldOut);

  return {
    title: fromLd?.title || titleDom || null,
    productId: fromLd?.productId || null,
    price: fromLd?.price ?? toNumber(priceDom),
    mrp: toNumber(mrpDom),
    inStock: typeof fromLd?.inStock === "boolean" ? fromLd.inStock : inStockDom,
    currency: fromLd?.currency || "INR",
    source: fromLd ? "http:jsonld" : "http:dom",
  };
}

module.exports = { parse };
