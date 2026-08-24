-- Durcissement de l'acces a la caisse (lot B).
--
-- Ecrite a la main, PAS via `prisma migrate dev` : le schema et la base
-- divergent depuis juin sur `CashDrawerExpense_employeeId_fkey` (voir
-- docs/seo-notes.md). Une migration generee voudrait "reparer" cette
-- contrainte au passage, ce qui n'a rien a voir avec ce lot.

-- SalonEmployee : verrouillage apres echecs repetes du PIN.
ALTER TABLE "SalonEmployee"
  ADD COLUMN "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pinLockedUntil" TIMESTAMP(3);

-- Compteur generique de limite de debit. En base et non en memoire : une Map
-- ne survit pas a `pm2 reload`, donc chaque deploiement remettait les
-- compteurs a zero.
CREATE TABLE "RateLimitEntry" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitEntry_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitEntry_updatedAt_idx" ON "RateLimitEntry"("updatedAt");

-- Appairage d'un appareil a un salon, par code envoye au proprietaire.
-- `codeHash` et non `code` : une fuite de la base ne doit pas livrer des
-- codes utilisables.
CREATE TABLE "DevicePairingCode" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevicePairingCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DevicePairingCode_providerId_createdAt_idx"
  ON "DevicePairingCode"("providerId", "createdAt");
CREATE INDEX "DevicePairingCode_expiresAt_idx" ON "DevicePairingCode"("expiresAt");

ALTER TABLE "DevicePairingCode"
  ADD CONSTRAINT "DevicePairingCode_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
