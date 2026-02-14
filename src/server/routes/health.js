const router = require('express').Router();

router.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'nudgeit-scraper-backend',
    });
});

module.exports = router;
