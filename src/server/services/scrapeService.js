const { scrape } = require('../../scrape');

// Normalize + enforce defaults for server usage
async function scrapeUrl(url, options = {}) {
    const trackingMethod = options.trackingMethod || 'auto';
    const pincode = options.pincode || undefined;
    const useFreshContext =
        typeof options.useFreshContext === 'boolean' ? options.useFreshContext : true;
    const debugDumpOnFailure =
        typeof options.debugDumpOnFailure === 'boolean' ? options.debugDumpOnFailure : true;

    const result = await scrape(url, {
        trackingMethod,
        pincode,
        useFreshContext,
        debugDumpOnFailure,
    });

    return result;
}

module.exports = { scrapeUrl };
