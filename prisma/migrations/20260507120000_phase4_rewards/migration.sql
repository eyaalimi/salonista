-- CreateEnum
CREATE TYPE "RewardEligibility" AS ENUM ('SERVICES_ONLY', 'PRODUCTS_ONLY', 'BOTH');

-- CreateEnum
CREATE TYPE "RewardTransactionReason" AS ENUM ('EARN_PURCHASE', 'REDEEM_PURCHASE', 'WELCOME_BONUS', 'BIRTHDAY_BONUS', 'MANUAL_ADJUSTMENT', 'EXPIRATION', 'REFUND_REVERSAL');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'LOYALTY_POINTS';

-- CreateTable
CREATE TABLE "RewardProgram" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "pointsPerDinar" DECIMAL(10,3) NOT NULL DEFAULT 1.000,
    "dinarPerPoint" DECIMAL(10,3) NOT NULL DEFAULT 0.010,
    "minPointsToRedeem" INTEGER NOT NULL DEFAULT 100,
    "maxRedemptionPctPerSale" INTEGER NOT NULL DEFAULT 50,
    "eligibleOn" "RewardEligibility" NOT NULL DEFAULT 'BOTH',
    "inactivityExpireMonths" INTEGER,
    "welcomeBonusPoints" INTEGER NOT NULL DEFAULT 0,
    "birthdayBonusPoints" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardWallet" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
    "lifetimeRedeemed" INTEGER NOT NULL DEFAULT 0,
    "welcomeBonusApplied" BOOLEAN NOT NULL DEFAULT false,
    "lastBirthdayBonusYear" INTEGER,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" "RewardTransactionReason" NOT NULL,
    "saleId" TEXT,
    "refundId" TEXT,
    "adjustedByEmployeeId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RewardProgram_providerId_key" ON "RewardProgram"("providerId");

-- CreateIndex
CREATE INDEX "RewardProgram_active_idx" ON "RewardProgram"("active");

-- CreateIndex
CREATE INDEX "RewardWallet_providerId_lastActivityAt_idx" ON "RewardWallet"("providerId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "RewardWallet_customerId_idx" ON "RewardWallet"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardWallet_providerId_customerId_key" ON "RewardWallet"("providerId", "customerId");

-- CreateIndex
CREATE INDEX "RewardTransaction_walletId_createdAt_idx" ON "RewardTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "RewardTransaction_saleId_idx" ON "RewardTransaction"("saleId");

-- CreateIndex
CREATE INDEX "RewardTransaction_refundId_idx" ON "RewardTransaction"("refundId");

-- CreateIndex
CREATE INDEX "RewardTransaction_reason_idx" ON "RewardTransaction"("reason");

-- AddForeignKey
ALTER TABLE "RewardProgram" ADD CONSTRAINT "RewardProgram_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardWallet" ADD CONSTRAINT "RewardWallet_programId_fkey" FOREIGN KEY ("programId") REFERENCES "RewardProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardWallet" ADD CONSTRAINT "RewardWallet_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardWallet" ADD CONSTRAINT "RewardWallet_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardTransaction" ADD CONSTRAINT "RewardTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "RewardWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardTransaction" ADD CONSTRAINT "RewardTransaction_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardTransaction" ADD CONSTRAINT "RewardTransaction_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardTransaction" ADD CONSTRAINT "RewardTransaction_adjustedByEmployeeId_fkey" FOREIGN KEY ("adjustedByEmployeeId") REFERENCES "SalonEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

