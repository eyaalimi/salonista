-- Add the marketplace publication flag.
ALTER TABLE "Offer" ADD COLUMN "publishedToMarketplace" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every existing offer was created for the marketplace, so flip it on.
UPDATE "Offer" SET "publishedToMarketplace" = true;

-- POS-only services have no "barred price"; let originalPrice be NULL.
ALTER TABLE "Offer" ALTER COLUMN "originalPrice" DROP NOT NULL;
