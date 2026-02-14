const express = require('express');
const scrapeRoutes = require('./routes/scrape');


const healthRoutes = require('./routes/health');

const app = express();

app.use(express.json());

// routes
app.use('/health', healthRoutes);
app.use('/scrape', scrapeRoutes);

module.exports = app;
