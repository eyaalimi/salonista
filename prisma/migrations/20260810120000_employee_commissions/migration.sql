-- Employee commissions (staff commission on services).
--
-- Adds:
--   * SalonEmployee.commissionRate  — flat percentage per employee (nullable = no commission)
--   * SaleItem.commissionRateSnapshot / commissionAmount / commissionPaid /
--     commissionPaidAt — line-level commission bookkeeping, snapshotted at
--     sale-close time
--   * Index on (assignedEmployeeId, commissionPaid) for the "pending
--     commissions per employee" report.

ALTER TABLE "SalonEmployee"
  ADD COLUMN "commissionRate" DECIMAL(5,2);

ALTER TABLE "SaleItem"
  ADD COLUMN "commissionRateSnapshot" DECIMAL(5,2),
  ADD COLUMN "commissionAmount"       DECIMAL(10,3),
  ADD COLUMN "commissionPaid"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "commissionPaidAt"       TIMESTAMP(3);

CREATE INDEX "SaleItem_assignedEmployeeId_commissionPaid_idx"
  ON "SaleItem" ("assignedEmployeeId", "commissionPaid");
