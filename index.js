const readline = require("readline/promises");
const { stdin: input, stdout: output } = require("process");
const { scrape } = require("./src/scrape.js");
const { appendTrackLog } = require("./src/utils/trackLog");

async function promptInput() {
  const rl = readline.createInterface({ input, output });

  const url = (await rl.question("Product URL: ")).trim();
  const pincode = (await rl.question("Pincode (6 digits): ")).trim();
  const mobile = (await rl.question("Mobile number: ")).trim();
  const trackingId = (await rl.question("Tracking ID: ")).trim();
  const methodInput = (await rl.question("Method (auto/http/playwright): ")).trim();
  const freshContextInput = (await rl.question("Fresh context? (y/n, default y): ")).trim();
  const debugDumpInput = (await rl.question("Debug dump on fail? (y/n, default y): ")).trim();

  rl.close();

  const normalized = methodInput ? methodInput.toLowerCase() : "auto";
  const method = ["auto", "http", "playwright"].includes(normalized) ? normalized : "auto";
  const useFreshContext = freshContextInput ? freshContextInput.toLowerCase() !== "n" : true;
  const debugDumpOnFailure = debugDumpInput ? debugDumpInput.toLowerCase() !== "n" : true;
  return {
    url,
    pincode,
    mobile,
    trackingId,
    trackingMethod: method,
    useFreshContext,
    debugDumpOnFailure,
  };
}

async function run() {
  console.log("MVP Started");

  const inputData = await promptInput();
  if (!inputData.url) {
    console.log("Missing product URL. Exiting.");
    return;
  }

  const result = await scrape(inputData.url, {
    trackingMethod: inputData.trackingMethod,
    pincode: inputData.pincode,
    useFreshContext: inputData.useFreshContext,
    debugDumpOnFailure: inputData.debugDumpOnFailure,
  });

  console.log(result);

  appendTrackLog({
    timestamp: result.timestamp,
    url: inputData.url,
    pincode: inputData.pincode,
    mobile: inputData.mobile,
    id: inputData.trackingId,
    trackingMethod: inputData.trackingMethod,
    deliverable: result.deliverable,
    deliverableForRequestedPincode: result.deliverableForRequestedPincode,
    requestedPincodeApplied: result.requestedPincodeApplied,
    requestedPincode: result.requestedPincode,
    deliveryPincode: result.deliveryPincode,
    deliveryText: result.deliveryText,
    deliveryDate: result.deliveryDate,
    platform: result.platform,
    productId: result.productId,
    title: result.title,
    price: result.price,
    mrp: result.mrp,
    inStock: result.inStock,
    currency: result.currency,
    source: result.source,
    priceFrom: result.resultValidation?.priceFrom ?? null,
    isPricePlausible: result.resultValidation?.isPricePlausible ?? null,
    needsReview: result.resultValidation?.needsReview ?? null,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
  });
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
