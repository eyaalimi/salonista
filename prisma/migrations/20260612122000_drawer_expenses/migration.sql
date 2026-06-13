CREATE TYPE "ExpenseCategory" AS ENUM ('FOURNISSEUR', 'LIVRAISON', 'AVANCE_SALAIRE', 'ENTRETIEN', 'AUTRE');

CREATE TABLE "CashDrawerExpense" (
  "id" TEXT NOT NULL,
  "cashDrawerSessionId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "amount" DECIMAL(10,3) NOT NULL,
  "reason" TEXT NOT NULL,
  "category" "ExpenseCategory" NOT NULL DEFAULT 'AUTRE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashDrawerExpense_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CashDrawerExpense"
  ADD CONSTRAINT "CashDrawerExpense_cashDrawerSessionId_fkey"
  FOREIGN KEY ("cashDrawerSessionId") REFERENCES "CashDrawerSession"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashDrawerExpense"
  ADD CONSTRAINT "CashDrawerExpense_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "SalonEmployee"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE INDEX "CashDrawerExpense_cashDrawerSessionId_idx" ON "CashDrawerExpense"("cashDrawerSessionId");
CREATE INDEX "CashDrawerExpense_employeeId_idx" ON "CashDrawerExpense"("employeeId");
