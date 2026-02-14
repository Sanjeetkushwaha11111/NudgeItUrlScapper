const express = require('express');

const healthRoutes = require('./routes/health');
const scrapeRoutes = require('./routes/scrape');
const tracksRoutes = require('./routes/tracks');

const app = express();
app.use(express.json());

app.use('/health', healthRoutes);
app.use('/scrape', scrapeRoutes);
app.use('/tracks', tracksRoutes);

module.exports = app;
