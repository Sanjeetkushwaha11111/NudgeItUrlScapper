const fs = require("fs");
const path = require("path");

const HEADERS = [
  "timestamp",
  "url",
  "pincode",
  "mobile",
  "id",
  "trackingMethod",
  "platform",
  "productId",
  "title",
  "price",
  "mrp",
  "inStock",
  "deliverable",
  "deliverableForRequestedPincode",
  "requestedPincodeApplied",
  "requestedPincode",
  "deliveryPincode",
  "deliveryText",
  "deliveryDate",
  "currency",
  "source",
  "priceFrom",
  "isPricePlausible",
  "needsReview",
  "errorCode",
  "errorMessage",
];

function csvEscape(value) {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function appendTrackLog(record, filePath) {
  const outPath =
    filePath || path.join(process.cwd(), "logs", "track.csv");
  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });

  const exists = fs.existsSync(outPath);
  const row = HEADERS.map((key) => csvEscape(record[key])).join(",") + "\n";

  if (!exists) {
    fs.writeFileSync(outPath, HEADERS.join(",") + "\n" + row, "utf8");
    return;
  }

  fs.appendFileSync(outPath, row, "utf8");
}

module.exports = { appendTrackLog };
