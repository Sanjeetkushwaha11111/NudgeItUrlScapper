const router = require('express').Router();
const { scrapeUrl } = require('../services/scrapeService');

router.post('/', async (req, res) => {
    try {
        const { url, trackingMethod, pincode, useFreshContext, debugDumpOnFailure } = req.body || {};

        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'url is required (string)' });
        }

        const result = await scrapeUrl(url, {
            trackingMethod,
            pincode,
            useFreshContext,
            debugDumpOnFailure,
        });
        return res.json(result);
    } catch (err) {
        console.error('Scrape error:', err);
        return res.status(500).json({ error: 'scrape_failed', message: err.message });
    }
});

module.exports = router;
