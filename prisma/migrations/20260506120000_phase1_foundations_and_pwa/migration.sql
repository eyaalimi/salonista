-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('OWNER', 'MANAGER', 'CASHIER', 'STYLIST');

-- CreateEnum
CREATE TYPE "SubscriptionModule" AS ENUM ('POS', 'REWARDS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'TRIAL');

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 19.00;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "assignedEmployeeId" TEXT,
ADD COLUMN     "createdViaPos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "walkIn" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "BookingItem" ADD COLUMN     "assignedEmployeeId" TEXT;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "birthday" TIMESTAMP(3),
    "notes" TEXT,
    "userId" TEXT,
    "firstSalonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalonEmployee" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "pinHash" TEXT,
    "role" "EmployeeRole" NOT NULL DEFAULT 'CASHIER',
    "permissions" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalonEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalonSubscription" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "module" "SubscriptionModule" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "activatedByUserId" TEXT,
    "pricingSnapshot" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalonSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_firstSalonId_idx" ON "Customer"("firstSalonId");

-- CreateIndex
CREATE INDEX "SalonEmployee_providerId_active_idx" ON "SalonEmployee"("providerId", "active");

-- CreateIndex
CREATE INDEX "SalonEmployee_userId_idx" ON "SalonEmployee"("userId");

-- CreateIndex
CREATE INDEX "SalonSubscription_status_idx" ON "SalonSubscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalonSubscription_providerId_module_key" ON "SalonSubscription"("providerId", "module");

-- CreateIndex
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

-- CreateIndex
CREATE INDEX "Booking_assignedEmployeeId_idx" ON "Booking"("assignedEmployeeId");

-- CreateIndex
CREATE INDEX "BookingItem_assignedEmployeeId_idx" ON "BookingItem"("assignedEmployeeId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "SalonEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "SalonEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalonEmployee" ADD CONSTRAINT "SalonEmployee_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalonEmployee" ADD CONSTRAINT "SalonEmployee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalonSubscription" ADD CONSTRAINT "SalonSubscription_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

