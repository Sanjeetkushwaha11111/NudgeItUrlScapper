const tracksService = require('../services/tracksService');
const { mapDatesToIST } = require('../../utils/time');

function parseId(req) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    return id;
}

exports.createTrack = async (req, res) => {
    try {
        const { url, intervalMinutes, trackingMethod } = req.body || {};
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'url is required (string)' });
        }

        const track = await tracksService.createTrack({
            url,
            intervalMinutes,
            trackingMethod,
        });

        return res.status(201).json(mapDatesToIST(track));
    } catch (err) {
        console.error('createTrack error:', err);
        return res.status(500).json({ error: 'create_track_failed', message: err.message });
    }
};

exports.runTrackNow = async (req, res) => {
    try {
        const id = parseId(req);
        if (!id) return res.status(400).json({ error: 'invalid_track_id' });

        const result = await tracksService.runTrackNow(id);
        return res.json(mapDatesToIST(result));
    } catch (err) {
        console.error('runTrackNow error:', err);
        const code = err.code || 'run_track_failed';
        const status = err.httpStatus || 500;
        return res.status(status).json({ error: code, message: err.message });
    }
};

exports.listTracks = async (req, res) => {
    try {
        const tracks = await tracksService.listTracks();
        return res.json(mapDatesToIST(tracks));
    } catch (err) {
        console.error('listTracks error:', err);
        return res.status(500).json({ error: 'list_tracks_failed', message: err.message });
    }
};

exports.getTrackById = async (req, res) => {
    try {
        const id = parseId(req);
        if (!id) return res.status(400).json({ error: 'invalid_track_id' });

        const track = await tracksService.getTrackById(id);
        return res.json(mapDatesToIST(track));
    } catch (err) {
        console.error('getTrackById error:', err);
        const status = err.httpStatus || 500;
        return res.status(status).json({ error: err.code || 'get_track_failed', message: err.message });
    }
};

exports.updateTrack = async (req, res) => {
    try {
        const id = parseId(req);
        if (!id) return res.status(400).json({ error: 'invalid_track_id' });

        const updated = await tracksService.updateTrack(id, req.body || {});
        return res.json(mapDatesToIST(updated));
    } catch (err) {
        console.error('updateTrack error:', err);
        const status = err.httpStatus || 500;
        return res.status(status).json({ error: err.code || 'update_track_failed', message: err.message });
    }
};
