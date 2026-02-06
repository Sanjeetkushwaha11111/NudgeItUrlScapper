const { normalize } = require("./normalizer");
const { httpFetch } = require("./http/fetch");
const flipkartHttp = require("./platforms/flipkart");
const amazonHttp = require("./platforms/amazon");
const { scrapeFlipkart } = require("./platforms/flipkart/playwright");

async function scrape(url, options = {}) {
  const info = normalize(url);

  const trackingMethod = (options.trackingMethod || process.env.TRACKING_METHOD || "auto")
    .toLowerCase()
    .trim();
  const usePlaywright = trackingMethod === "playwright";
  const useHttp = trackingMethod === "http";

  let data = {};
  let source = "http";

  switch (info.platform) {
    case "flipkart": {
      if (usePlaywright) {
        try {
          const pw = await scrapeFlipkart(info.canonicalUrl, {
            pincode: options.pincode,
          });
          data = { ...data, ...pw };
          source = data.source || "playwright";
        } catch {}
        break;
      }

      if (useHttp || trackingMethod === "auto") {
        try {
          const html = await httpFetch(info.canonicalUrl);
          data = { ...data, ...flipkartHttp.parse(html) };
          source = data.source || "http";
        } catch {}
      }

      if (trackingMethod === "auto" && !data.price) {
        try {
          const pw = await scrapeFlipkart(info.canonicalUrl, {
            pincode: options.pincode,
          });
          data = { ...data, ...pw };
          source = data.source || "playwright";
        } catch {}
      }

      break;
    }

    case "amazon.in":
    case "amazon": {
      // Try HTTP parse for Amazon (no Playwright fallback available)
      try {
        const html = await httpFetch(info.canonicalUrl);
        if (amazonHttp && typeof amazonHttp.parse === "function") {
          data = amazonHttp.parse(html);
        }
        source = data.source || "http";
      } catch {}

      break;
    }

    default:
       break;
  }

  return {
    platform: info.platform,
    productId: data.productId || info.productId || null,
    title: data.title || null,
    price: data.price ?? null,
    mrp: data.mrp ?? null,
    inStock: typeof data.inStock === "boolean" ? data.inStock : null,
    deliverable: typeof data.deliverable === "boolean" ? data.deliverable : null,
    deliveryText: data.deliveryText || null,
    deliveryDate: data.deliveryDate || null,
    currency: data.currency || "INR",
    trackingMethod,
    timestamp: new Date().toISOString(),
    confidence: data.price && data.title ? 0.9 : 0.4,
    source,
  };
}

module.exports = { scrape };
