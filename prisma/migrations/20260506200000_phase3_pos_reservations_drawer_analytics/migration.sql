
-- CreateEnum
CREATE TYPE "CashDrawerStatus" AS ENUM ('OPEN', 'CLOSED', 'RECONCILED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "phantom" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "cashDrawerSessionId" TEXT;

-- CreateTable
CREATE TABLE "CashDrawerSession" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "CashDrawerStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "openingFloat" DECIMAL(10,3) NOT NULL,
    "closingCount" DECIMAL(10,3),
    "expectedCash" DECIMAL(10,3),
    "variance" DECIMAL(10,3),
    "openingNotes" TEXT,
    "closingNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashDrawerSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashDrawerSession_providerId_status_idx" ON "CashDrawerSession"("providerId", "status");

-- CreateIndex
CREATE INDEX "CashDrawerSession_employeeId_status_idx" ON "CashDrawerSession"("employeeId", "status");

-- CreateIndex
CREATE INDEX "CashDrawerSession_openedAt_idx" ON "CashDrawerSession"("openedAt");

-- CreateIndex
CREATE INDEX "Payment_cashDrawerSessionId_idx" ON "Payment"("cashDrawerSessionId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cashDrawerSessionId_fkey" FOREIGN KEY ("cashDrawerSessionId") REFERENCES "CashDrawerSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerSession" ADD CONSTRAINT "CashDrawerSession_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerSession" ADD CONSTRAINT "CashDrawerSession_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "SalonEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

