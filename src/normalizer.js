function detectPlatform(url) {
  const u = url.toLowerCase()

  if (u.includes("flipkart.com")) return "flipkart"

  try {
    const host = new URL(url).hostname.toLowerCase()
    if (
      host.includes("amazon.") ||
      host === "a.co" ||
      host === "amzn.to" ||
      host === "amzn.in"
    ) {
      return "amazon"
    }
  } catch {
    if (u.includes("amazon.") || u.includes("a.co/") || u.includes("amzn.to/") || u.includes("amzn.in/")) {
      return "amazon"
    }
  }

  return "unknown"
}

function extractFlipkartProductId(url) {
  // matches /p/<id> where id starts with itm...
  const m = url.match(/\/p\/(itm[a-zA-Z0-9]+)/)
  return m ? m[1] : null
}

function extractAmazonAsin(url) {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i,
    /\/gp\/product\/([A-Z0-9]{10})(?:[/?]|$)/i,
    /\/product\/([A-Z0-9]{10})(?:[/?]|$)/i,
  ]

  for (const pattern of patterns) {
    const m = url.match(pattern)
    if (m) return m[1].toUpperCase()
  }

  return null
}

function normalize(url) {
  const platform = detectPlatform(url)

  return {
    originalUrl: url,
    platform,
    canonicalUrl: url,
    productId:
      platform === "flipkart"
        ? extractFlipkartProductId(url)
        : platform === "amazon"
          ? extractAmazonAsin(url)
          : null,
  }
}

module.exports = { normalize }
