-- Phase 1 de l'espace superadmin : role, double authentification, journal.
--
-- SANS PERTE. Trois operations, toutes additives :
--   1. une valeur d'enum en plus (aucune ligne existante n'est touchee) ;
--   2. des colonnes nullables / a defaut sur "User" ;
--   3. une table neuve.
-- Aucun DROP, aucun ALTER de colonne existante, aucun UPDATE de donnees.

-- 1) Le role SUPERADMIN.
--    Ajouter une valeur d'enum ne reecrit pas la table : les lignes
--    existantes gardent leur role. SUPERADMIN n'est PAS hierarchique — un
--    ADMIN n'y gagne aucun droit (voir src/lib/superadmin-acces.ts).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPERADMIN';

-- 2) Double authentification. Toutes ces colonnes restent nulles pour les
--    comptes existants : aucune connexion actuelle n'est affectee.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpSecret"         TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpConfirmedAt"    TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpLastUsedStep"   INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpFailedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpLockedUntil"    TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "superadminSince"    TIMESTAMP(3);

-- 3) Le journal d'audit. En lecture seule par convention : aucune route ne
--    l'expose en ecriture autrement qu'en insertion.
CREATE TABLE IF NOT EXISTS "SuperadminAuditLog" (
    "id"               TEXT NOT NULL,
    "actorId"          TEXT NOT NULL,
    "actorEmail"       TEXT NOT NULL,
    "action"           TEXT NOT NULL,
    "targetProviderId" TEXT,
    "targetUserId"     TEXT,
    "motif"            TEXT NOT NULL,
    "ipHash"           TEXT,
    "userAgent"        TEXT,
    "metadata"         JSONB,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperadminAuditLog_pkey" PRIMARY KEY ("id")
);

-- Les quatre lectures du journal : par date (vue par defaut), par acteur,
-- par salon cible (depuis la fiche de support), par type d'action.
CREATE INDEX IF NOT EXISTS "SuperadminAuditLog_createdAt_idx"
    ON "SuperadminAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "SuperadminAuditLog_actorId_createdAt_idx"
    ON "SuperadminAuditLog"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "SuperadminAuditLog_targetProviderId_createdAt_idx"
    ON "SuperadminAuditLog"("targetProviderId", "createdAt");
CREATE INDEX IF NOT EXISTS "SuperadminAuditLog_action_createdAt_idx"
    ON "SuperadminAuditLog"("action", "createdAt");

-- L'acteur disparait avec ses lignes (Cascade) : un compte superadmin
-- supprime emporte son journal, il n'y a plus rien a lui imputer.
ALTER TABLE "SuperadminAuditLog"
    ADD CONSTRAINT "SuperadminAuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- La CIBLE, elle, est mise a NULL (SetNull) : si un salon ferme son compte,
-- la trace de l'intervention doit SURVIVRE. C'est tout l'interet d'un audit.
ALTER TABLE "SuperadminAuditLog"
    ADD CONSTRAINT "SuperadminAuditLog_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
