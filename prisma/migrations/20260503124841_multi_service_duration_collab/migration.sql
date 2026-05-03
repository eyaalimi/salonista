/*
  Warnings:

  - You are about to drop the column `offerId` on the `CollaborationRequest` table. All the data in the column will be lost.
  - You are about to drop the column `proposedPrice` on the `CollaborationRequest` table. All the data in the column will be lost.
  - You are about to drop the column `trackingLinkId` on the `CollaborationRequest` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "CollaborationRequest" DROP CONSTRAINT "CollaborationRequest_offerId_fkey";

-- DropForeignKey
ALTER TABLE "CollaborationRequest" DROP CONSTRAINT "CollaborationRequest_trackingLinkId_fkey";

-- DropIndex
DROP INDEX "CollaborationRequest_trackingLinkId_key";

-- AlterTable
ALTER TABLE "CollaborationRequest" DROP COLUMN "offerId",
DROP COLUMN "proposedPrice",
DROP COLUMN "trackingLinkId";

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "durationMinutes" INTEGER NOT NULL DEFAULT 60;

-- CreateTable
CREATE TABLE "CollaborationOffer" (
    "id" TEXT NOT NULL,
    "collabId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "trackingLinkId" TEXT,

    CONSTRAINT "CollaborationOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CollaborationOffer_trackingLinkId_key" ON "CollaborationOffer"("trackingLinkId");

-- CreateIndex
CREATE INDEX "CollaborationOffer_offerId_idx" ON "CollaborationOffer"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborationOffer_collabId_offerId_key" ON "CollaborationOffer"("collabId", "offerId");

-- AddForeignKey
ALTER TABLE "CollaborationOffer" ADD CONSTRAINT "CollaborationOffer_collabId_fkey" FOREIGN KEY ("collabId") REFERENCES "CollaborationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationOffer" ADD CONSTRAINT "CollaborationOffer_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationOffer" ADD CONSTRAINT "CollaborationOffer_trackingLinkId_fkey" FOREIGN KEY ("trackingLinkId") REFERENCES "TrackingLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
