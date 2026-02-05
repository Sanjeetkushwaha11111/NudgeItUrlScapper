const axios = require("axios")

async function httpFetch(url) {

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9"
  }

  const res = await axios.get(url, {
    headers,
    timeout: 15000
  })

  return res.data
}

module.exports = { httpFetch }
