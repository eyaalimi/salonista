-- Booking: who confirmed the customer arrival (nullable; null for owner-User verifications)
ALTER TABLE "Booking"
  ADD COLUMN "qrVerifiedByEmployeeId" TEXT;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_qrVerifiedByEmployeeId_fkey"
  FOREIGN KEY ("qrVerifiedByEmployeeId") REFERENCES "SalonEmployee"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
