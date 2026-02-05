function toNumber(text) {
  if (!text) return null

  return parseInt(
    text
      .replace(/[^0-9]/g, ""),
    10
  )
}

module.exports = { toNumber }
