const axios = require("axios")

function buildHeaders() {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9"
  }
}

async function httpFetch(url) {
  const res = await axios.get(url, {
    headers: buildHeaders(),
    timeout: 15000
  })

  return res.data
}

async function httpFetchWithMeta(url) {
  const res = await axios.get(url, {
    headers: buildHeaders(),
    timeout: 15000,
    maxRedirects: 10
  })

  const finalUrl = res?.request?.res?.responseUrl || url
  return {
    html: res.data,
    finalUrl
  }
}

module.exports = { httpFetch, httpFetchWithMeta }
