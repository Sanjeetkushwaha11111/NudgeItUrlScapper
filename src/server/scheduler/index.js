const os = require('os');
const prisma = require('../../db/prisma');
const tracksService = require('../services/tracksService');

const TICK_MS = 30 * 1000;        // scheduler polls DB
const BATCH_SIZE = 10;            // claim this many per tick
const CONCURRENCY = 3;            // run 3 scrapes at a time
const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

const INSTANCE_ID = `${os.hostname()}-${process.pid}`;

// simple promise pool (no extra deps)
async function runPool(items, concurrency, worker) {
    const queue = items.slice();
    const running = new Set();

    async function runOne() {
        const item = queue.shift();
        if (!item) return;
        const p = Promise.resolve().then(() => worker(item));
        running.add(p);
        try { await p; } finally { running.delete(p); }
        return runOne();
    }

    const starters = Array.from({ length: Math.min(concurrency, items.length) }, () => runOne());
    await Promise.all(starters);
}

async function claimDueTracks() {
    const now = new Date();
    const lockExpiresAt = new Date(Date.now() + LOCK_TTL_MS);

    // IMPORTANT:
    // - SELECT ... FOR UPDATE SKIP LOCKED prevents two instances claiming same rows
    // - also allows reclaiming expired locks (lockExpiresAt < now)
    const rows = await prisma.$queryRaw`
    WITH due AS (
      SELECT id
      FROM "Track"
      WHERE status = 'ACTIVE'
        AND "nextRunAt" IS NOT NULL
        AND "nextRunAt" <= NOW()
        AND (
          "lockExpiresAt" IS NULL
          OR "lockExpiresAt" < NOW()
        )
      ORDER BY "nextRunAt" ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "Track" t
    SET "lockedAt" = ${now},
        "lockedBy" = ${INSTANCE_ID},
        "lockExpiresAt" = ${lockExpiresAt}
    FROM due
    WHERE t.id = due.id
    RETURNING t.id;
  `;

    // rows is array of { id: number }
    return rows.map(r => r.id);
}

function computeBackoffMs(failureCount) {
    // 1m, 2m, 4m, 8m ... capped at 30m
    const base = 60 * 1000;
    const ms = base * Math.pow(2, Math.min(failureCount, 5));
    return Math.min(ms, 30 * 60 * 1000);
}

async function unlockSuccess(trackId) {
    await prisma.track.update({
        where: { id: trackId },
        data: {
            lockedAt: null,
            lockedBy: null,
            lockExpiresAt: null,
            failureCount: 0,
            lastError: null,
            lastErrorAt: null,
        },
    });
}

async function unlockFailure(trackId, err) {
    const track = await prisma.track.findUnique({
        where: { id: trackId },
        select: { failureCount: true, intervalMinutes: true },
    });

    const nextFailureCount = (track?.failureCount || 0) + 1;
    const backoffMs = computeBackoffMs(nextFailureCount);

    await prisma.track.update({
        where: { id: trackId },
        data: {
            lockedAt: null,
            lockedBy: null,
            lockExpiresAt: null,
            failureCount: nextFailureCount,
            lastError: err?.message ? String(err.message).slice(0, 500) : 'unknown_error',
            lastErrorAt: new Date(),
            nextRunAt: new Date(Date.now() + backoffMs),
        },
    });
}

async function processTrack(trackId) {
    try {
        const res = await tracksService.runTrackNow(trackId);

        // MVP notification (console). Replace with webhook later.
        if (res.changed) {
            console.log('[CHANGE]', {
                trackId,
                previous: res.previous,
                current: { price: res.snapshot.price, inStock: res.snapshot.inStock },
                at: new Date().toISOString(),
            });
        }

        await unlockSuccess(trackId);
    } catch (err) {
        console.error('[TRACK FAILED]', { trackId, error: err.message });
        await unlockFailure(trackId, err);
    }
}

async function tick() {
    const ids = await claimDueTracks();
    if (!ids.length) return;
    console.log(`[scheduler] claimed ${ids.length} track(s)`);

    await runPool(ids, CONCURRENCY, processTrack);
}

function startScheduler() {
    console.log(`[scheduler] starting instance=${INSTANCE_ID} tick=${TICK_MS}ms`);
    // run immediately + interval
    tick().catch(e => console.error('[scheduler tick error]', e));
    setInterval(() => tick().catch(e => console.error('[scheduler tick error]', e)), TICK_MS);
}

module.exports = { startScheduler };
