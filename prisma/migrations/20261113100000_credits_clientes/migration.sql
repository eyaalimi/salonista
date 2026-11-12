-- Credits clientes (« Payer plus tard ») et dettes effacees.
--
-- ADDITIVE ET SANS PERTE : une valeur d'enum, des colonnes a valeur par defaut
-- ou NULLABLES. Les ventes existantes gardent amountDue = 0 : elles sont
-- reglees, rien n'est invente.
--
-- La valeur 'CREDIT' n'est UTILISEE nulle part dans cette migration :
-- PostgreSQL refuse d'employer une valeur d'enum dans la transaction qui l'a
-- creee. Meme forme que 'LOYALTY_POINTS' (20260507120000_phase4_rewards).

ALTER TYPE "SaleStatus" ADD VALUE 'CREDIT';

ALTER TABLE "Sale" ADD COLUMN "amountDue" DECIMAL(10,3) NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "creditSettledAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "detteEffaceeAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "detteEffaceeMotif" TEXT;
ALTER TABLE "Sale" ADD COLUMN "detteEffaceeMontant" DECIMAL(10,3);
ALTER TABLE "Sale" ADD COLUMN "detteEffaceeParId" TEXT;

ALTER TABLE "Payment" ADD COLUMN "isCreditSettlement" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Payment" ADD COLUMN "receivedByEmployeeId" TEXT;

CREATE INDEX "Sale_providerId_status_amountDue_idx" ON "Sale"("providerId", "status", "amountDue");

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_detteEffaceeParId_fkey"
    FOREIGN KEY ("detteEffaceeParId") REFERENCES "SalonEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedByEmployeeId_fkey"
    FOREIGN KEY ("receivedByEmployeeId") REFERENCES "SalonEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
