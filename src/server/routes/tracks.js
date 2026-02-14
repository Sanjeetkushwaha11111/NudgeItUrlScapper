const router = require('express').Router();
const tracksController = require('../controllers/tracksController');

// Create a track (register URL once)
router.post('/', tracksController.createTrack);

// Run a track now (manual trigger; scheduler will reuse same service)
router.post('/:id/run', tracksController.runTrackNow);

// List tracks
router.get('/', tracksController.listTracks);

// Track details (and recent history later)
router.get('/:id', tracksController.getTrackById);

// Pause/resume (optional but useful for MVP)
router.patch('/:id', tracksController.updateTrack);

module.exports = router;
