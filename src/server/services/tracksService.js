const { scrapeUrl } = require('./scrapeService');

// Your normalizer lives at src/normalizer.js
// Adjust the require if needed based on your exports.
const normalizerModule = require('../../normalizer');

function normalizeUrl(url) {
    // defensive: supports multiple export styles
    if (typeof normalizerModule === 'function') return normalizerModule(url);
    if (normalizerModule && typeof normalizerModule.normalize === 'function') return normalizerModule.normalize(url);
    if (normalizerModule && typeof normalizerModule.normalizer === 'function') return normalizerModule.normalizer(url);
    // fallback
    return { originalUrl: url, canonicalUrl: url, platform: 'unknown', productId: null };
}

function toIntervalMinutes(intervalMinutes) {
    const n = Number(intervalMinutes);
    if (!intervalMinutes) return 30;
    if (!Number.isFinite(n) || n < 5 || n > 24 * 60) return 30;
    return Math.floor(n);
}

function platformToEnum(p) {
    if (p === 'amazon') return 'amazon';
    if (p === 'flipkart') return 'flipkart';
    return 'unknown';
}

const DEFAULT_SCRAPE_TIMEOUT_MS = Number(process.env.TRACK_SCRAPE_TIMEOUT_MS || 30000);

function withTimeout(promise, timeoutMs, label) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const err = new Error(`${label} timed out after ${timeoutMs}ms`);
            err.code = 'scrape_timeout';
            err.httpStatus = 504;
            reject(err);
        }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

async function scrapeWithGuard(url, options) {
    return withTimeout(
        scrapeUrl(url, options),
        DEFAULT_SCRAPE_TIMEOUT_MS,
        'scrape'
    );
}

async function runBootstrapScrape(canonicalUrl, method) {
    const attempts = [method];
    if (method === 'auto') attempts.push('http');

    let lastError = null;
    for (const trackingMethod of attempts) {
        try {
            const result = await scrapeWithGuard(canonicalUrl, { trackingMethod });
            return { ok: true, trackingMethodUsed: trackingMethod, result };
        } catch (err) {
            lastError = err;
        }
    }

    return { ok: false, trackingMethodUsed: method, error: lastError };
}

function getPrisma() {
    try {
        return require('../../db/prisma');
    } catch (err) {
        const e = new Error(
            'Prisma client is not configured for Prisma 7. Install @prisma/adapter-pg and wire adapter in src/db/prisma.js.'
        );
        e.code = 'prisma_not_configured';
        e.httpStatus = 500;
        e.cause = err;
        throw e;
    }
}

exports.createTrack = async ({ url, intervalMinutes, trackingMethod }) => {
    const prisma = getPrisma();
    const interval = toIntervalMinutes(intervalMinutes);
    const method = trackingMethod || 'auto';

    const normalized = normalizeUrl(url);
    const platform = platformToEnum(normalized.platform);
    const canonicalUrl = normalized.canonicalUrl || url;

    // 1) create Track
    const track = await prisma.track.create({
        data: {
            originalUrl: normalized.originalUrl || url,
            canonicalUrl,
            platform,
            productId: normalized.productId || null,
            intervalMinutes: interval,
            trackingMethod: method,
            status: 'ACTIVE',
            nextRunAt: new Date(Date.now() + interval * 60 * 1000),
        },
    });

    // 2) run first scrape immediately
    const boot = await runBootstrapScrape(canonicalUrl, method);

    if (!boot.ok) {
        const errorCode = boot.error?.code || 'bootstrap_scrape_failed';
        const errorMessage = boot.error?.message || 'Bootstrap scrape failed';

        const failureResult = await prisma.$transaction(async (tx) => {
            const snapshot = await tx.snapshot.create({
                data: {
                    trackId: track.id,
                    price: null,
                    mrp: null,
                    inStock: null,
                    currency: null,
                    title: null,
                    deliverable: null,
                    deliveryText: null,
                    deliveryDate: null,
                    source: 'bootstrap:error',
                    trackingMethod: boot.trackingMethodUsed,
                    raw: {
                        ok: false,
                        errorCode,
                        errorMessage,
                    },
                },
            });

            const updatedTrack = await tx.track.update({
                where: { id: track.id },
                data: {
                    lastCheckedAt: new Date(),
                    nextRunAt: new Date(Date.now() + interval * 60 * 1000),
                },
            });

            return { track: updatedTrack, snapshot };
        });

        return {
            ...failureResult,
            bootstrap: {
                ok: false,
                error: errorCode,
                message: errorMessage,
            },
        };
    }

    const scrapeResult = boot.result;

    // 3) store snapshot + update latest fields (atomic)
    const { price, mrp, inStock, currency, title, deliverable, deliveryText, deliveryDate, source } = scrapeResult;

    const result = await prisma.$transaction(async (tx) => {
        const snapshot = await tx.snapshot.create({
            data: {
                trackId: track.id,
                price: Number.isFinite(price) ? price : null,
                mrp: Number.isFinite(mrp) ? mrp : null,
                inStock: typeof inStock === 'boolean' ? inStock : null,
                currency: currency || null,
                title: title || null,
                deliverable: typeof deliverable === 'boolean' ? deliverable : null,
                deliveryText: deliveryText || null,
                deliveryDate: deliveryDate || null,
                source: source || null,
                trackingMethod: boot.trackingMethodUsed,
                raw: scrapeResult,
            },
        });

        const updatedTrack = await tx.track.update({
            where: { id: track.id },
            data: {
                lastPrice: Number.isFinite(price) ? price : null,
                lastMrp: Number.isFinite(mrp) ? mrp : null,
                lastInStock: typeof inStock === 'boolean' ? inStock : null,
                lastCheckedAt: new Date(),
                // nextRunAt will be used in scheduler later; set it now for future readiness
                nextRunAt: new Date(Date.now() + interval * 60 * 1000),
            },
        });

        return { track: updatedTrack, snapshot };
    });

    return {
        ...result,
        bootstrap: {
            ok: true,
            trackingMethodUsed: boot.trackingMethodUsed,
        },
    };
};

exports.runTrackNow = async (trackId) => {
    const prisma = getPrisma();
    const track = await prisma.track.findUnique({ where: { id: trackId } });
    if (!track) {
        const err = new Error('Track not found');
        err.httpStatus = 404;
        err.code = 'track_not_found';
        throw err;
    }

    const scrapeResult = await scrapeWithGuard(track.canonicalUrl, {
        trackingMethod: track.trackingMethod,
    });

    const { price, mrp, inStock, currency, title, deliverable, deliveryText, deliveryDate, source } = scrapeResult;

    const prevPrice = track.lastPrice;
    const prevStock = track.lastInStock;

    const nextRunAt = new Date(Date.now() + track.intervalMinutes * 60 * 1000);

    const out = await prisma.$transaction(async (tx) => {
        const snapshot = await tx.snapshot.create({
            data: {
                trackId: track.id,
                price: Number.isFinite(price) ? price : null,
                mrp: Number.isFinite(mrp) ? mrp : null,
                inStock: typeof inStock === 'boolean' ? inStock : null,
                currency: currency || null,
                title: title || null,
                deliverable: typeof deliverable === 'boolean' ? deliverable : null,
                deliveryText: deliveryText || null,
                deliveryDate: deliveryDate || null,
                source: source || null,
                trackingMethod: track.trackingMethod,
                raw: scrapeResult,
            },
        });

        const updatedTrack = await tx.track.update({
            where: { id: track.id },
            data: {
                lastPrice: Number.isFinite(price) ? price : null,
                lastMrp: Number.isFinite(mrp) ? mrp : null,
                lastInStock: typeof inStock === 'boolean' ? inStock : null,
                lastCheckedAt: new Date(),
                nextRunAt,
            },
        });

        const changed =
            (Number.isFinite(price) && prevPrice !== null && prevPrice !== undefined && price !== prevPrice) ||
            (typeof inStock === 'boolean' && prevStock !== null && prevStock !== undefined && inStock !== prevStock);

        return { track: updatedTrack, snapshot, changed, previous: { price: prevPrice, inStock: prevStock } };
    });

    return out;
};

exports.listTracks = async () => {
    const prisma = getPrisma();
    return prisma.track.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
};

exports.getTrackById = async (trackId) => {
    const prisma = getPrisma();
    const track = await prisma.track.findUnique({
        where: { id: trackId },
        include: {
            snapshots: {
                orderBy: { scrapedAt: 'desc' },
                take: 20,
            },
        },
    });

    if (!track) {
        const err = new Error('Track not found');
        err.httpStatus = 404;
        err.code = 'track_not_found';
        throw err;
    }

    return track;
};

exports.updateTrack = async (trackId, patch) => {
    const prisma = getPrisma();
    const data = {};

    if (patch.status) {
        const s = String(patch.status).toUpperCase();
        if (s === 'ACTIVE' || s === 'PAUSED') data.status = s;
    }

    if (patch.intervalMinutes !== undefined) {
        data.intervalMinutes = toIntervalMinutes(patch.intervalMinutes);
    }

    if (patch.trackingMethod) {
        data.trackingMethod = String(patch.trackingMethod);
    }

    const updated = await prisma.track.update({
        where: { id: trackId },
        data,
    });

    return updated;
};
