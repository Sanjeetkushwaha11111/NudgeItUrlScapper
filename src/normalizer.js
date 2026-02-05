function detectPlatform(url) {
  const u = url.toLowerCase()
  if (u.includes("flipkart.com")) return "flipkart"
  if (u.includes("amazon.")) return "amazon"
  return "unknown"
}

function extractFlipkartProductId(url) {
  // matches /p/<id> where id starts with itm...
  const m = url.match(/\/p\/(itm[a-zA-Z0-9]+)/)
  return m ? m[1] : null
}

function normalize(url) {
  const platform = detectPlatform(url)

  return {
    originalUrl: url,
    platform,
    canonicalUrl: url,
    productId: platform === "flipkart" ? extractFlipkartProductId(url) : null,
  }
}

module.exports = { normalize }
