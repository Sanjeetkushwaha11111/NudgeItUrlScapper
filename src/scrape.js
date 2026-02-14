const { normalize } = require("./normalizer");
const { httpFetch, httpFetchWithMeta } = require("./http/fetch");
const flipkartHttp = require("./platforms/flipkart");
const amazonHttp = require("./platforms/amazon");
const { scrapeFlipkart } = require("./platforms/flipkart/playwright");
const { scrapeAmazon } = require("./platforms/amazon/playwright");
const { toISTISOString } = require("./utils/time");

const MAX_REASONABLE_PRICE_INR = 5000000;

function normalizeError(err) {
  if (!err) {
    return { errorCode: "PLAYWRIGHT_FAILED", errorMessage: "playwright_failed" };
  }

  const rawCode = err.code || err.name || "PLAYWRIGHT_FAILED";
  const errorCode = String(rawCode).toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  const errorMessage = err.message ? String(err.message) : "playwright_failed";

  return { errorCode, errorMessage };
}

function getPriceFromSource(source) {
  if (!source) return null;
  if (String(source).includes(":jsonld")) return "jsonld";
  if (String(source).includes(":dom")) return "dom";
  return null;
}

async function scrape(url, options = {}) {
  const info = normalize(url);

  const trackingMethod = (options.trackingMethod || process.env.TRACKING_METHOD || "auto")
    .toLowerCase()
    .trim();
  const usePlaywright = trackingMethod === "playwright";
  const useHttp = trackingMethod === "http";

  let data = {};
  let source = "http";
  let errorCode = null;
  let errorMessage = null;

  switch (info.platform) {
    case "flipkart": {
      if (usePlaywright) {
        try {
          const pw = await scrapeFlipkart(info.canonicalUrl, {
            pincode: options.pincode,
            debugDumpOnFailure: options.debugDumpOnFailure,
          });
          data = { ...data, ...pw };
          source = data.source || "playwright";
        } catch (err) {
          source = "playwright:error";
          const details = normalizeError(err);
          errorCode = details.errorCode;
          errorMessage = details.errorMessage;
        }
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
            debugDumpOnFailure: options.debugDumpOnFailure,
          });
          data = { ...data, ...pw };
          source = data.source || "playwright";
        } catch (err) {
          source = "playwright:error";
          const details = normalizeError(err);
          errorCode = details.errorCode;
          errorMessage = details.errorMessage;
        }
      }

      break;
    }

    case "amazon.in":
    case "amazon": {
      if (usePlaywright) {
        try {
          const pw = await scrapeAmazon(info.canonicalUrl, {
            pincode: options.pincode,
            useFreshContext: options.useFreshContext !== false,
            debugDumpOnFailure: options.debugDumpOnFailure,
          });
          data = { ...data, ...pw };
          if (!data.productId && pw?.debug?.finalUrl) {
            const resolved = normalize(pw.debug.finalUrl);
            data.productId = resolved.productId || data.productId || null;
          }
          source = data.source || "playwright";
        } catch (err) {
          source = "playwright:error";
          const details = normalizeError(err);
          errorCode = details.errorCode;
          errorMessage = details.errorMessage;
        }
        break;
      }

      if (useHttp || trackingMethod === "auto") {
        try {
          const { html, finalUrl } = await httpFetchWithMeta(info.canonicalUrl);
          if (amazonHttp && typeof amazonHttp.parse === "function") {
            data = amazonHttp.parse(html);
          }
          if (!data.productId && finalUrl) {
            const resolved = normalize(finalUrl);
            data.productId = resolved.productId || data.productId || null;
          }
          source = data.source || "http";
        } catch {}
      }

      if (trackingMethod === "auto" && !data.price) {
        try {
          const pw = await scrapeAmazon(info.canonicalUrl, {
            pincode: options.pincode,
            useFreshContext: options.useFreshContext !== false,
            debugDumpOnFailure: options.debugDumpOnFailure,
          });
          data = { ...data, ...pw };
          if (!data.productId && pw?.debug?.finalUrl) {
            const resolved = normalize(pw.debug.finalUrl);
            data.productId = resolved.productId || data.productId || null;
          }
          source = data.source || "playwright";
        } catch (err) {
          source = "playwright:error";
          const details = normalizeError(err);
          errorCode = details.errorCode;
          errorMessage = details.errorMessage;
        }
      }

      break;
    }

    default:
       break;
  }

  const requestedPincode = data.requestedPincode || (options.pincode || null);
  const requestedPincodeApplied =
    typeof data.requestedPincodeApplied === "boolean" ? data.requestedPincodeApplied : null;
  const price = data.price ?? null;
  const priceFrom = getPriceFromSource(source);
  const isPricePlausible =
    typeof price === "number" && Number.isFinite(price) && price > 0 && price <= MAX_REASONABLE_PRICE_INR;
  const needsReview =
    price == null ||
    !isPricePlausible ||
    (/^\d{6}$/.test(String(options.pincode || "").trim()) && requestedPincodeApplied !== true);

  return {
    platform: info.platform,
    productId: data.productId || info.productId || null,
    title: data.title || null,
    price,
    mrp: data.mrp ?? null,
    inStock: typeof data.inStock === "boolean" ? data.inStock : null,
    requestedPincode,
    deliveryPincode: data.deliveryPincode || null,
    requestedPincodeApplied,
    deliverableForRequestedPincode:
      typeof data.deliverableForRequestedPincode === "boolean"
        ? data.deliverableForRequestedPincode
        : null,
    deliverable: typeof data.deliverable === "boolean" ? data.deliverable : null,
    deliveryText: data.deliveryText || null,
    deliveryDate: data.deliveryDate || null,
    currency: data.currency || "INR",
    trackingMethod,
    timestamp: toISTISOString(new Date()),
    confidence: data.price && data.title ? 0.9 : 0.4,
    source,
    resultValidation: {
      priceFrom,
      isPricePlausible,
      needsReview,
    },
    errorCode,
    errorMessage,
  };
}

module.exports = { scrape };
