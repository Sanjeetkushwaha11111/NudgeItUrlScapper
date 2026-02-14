-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('amazon', 'flipkart', 'unknown');

-- CreateEnum
CREATE TYPE "TrackStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateTable
CREATE TABLE "Track" (
    "id" SERIAL NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "platform" "Platform" NOT NULL DEFAULT 'unknown',
    "productId" TEXT,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "trackingMethod" TEXT NOT NULL DEFAULT 'auto',
    "status" "TrackStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastPrice" INTEGER,
    "lastMrp" INTEGER,
    "lastInStock" BOOLEAN,
    "lastCheckedAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" SERIAL NOT NULL,
    "trackId" INTEGER NOT NULL,
    "price" INTEGER,
    "mrp" INTEGER,
    "inStock" BOOLEAN,
    "currency" VARCHAR(8),
    "title" TEXT,
    "deliverable" BOOLEAN,
    "deliveryText" TEXT,
    "deliveryDate" TEXT,
    "source" TEXT,
    "trackingMethod" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Track_platform_idx" ON "Track"("platform");

-- CreateIndex
CREATE INDEX "Track_status_nextRunAt_idx" ON "Track"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "Snapshot_trackId_scrapedAt_idx" ON "Snapshot"("trackId", "scrapedAt");

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;
