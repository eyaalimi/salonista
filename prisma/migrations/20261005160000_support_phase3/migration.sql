-- Phase 3 : support des salons.
--
-- SANS PERTE. Quatre colonnes nullables (ou a defaut) et une table neuve.
-- Aucun DROP, aucun ALTER de colonne existante, aucun UPDATE de donnees.

-- 1) Changement de mot de passe force, et revocation des sessions.
--
--    `sessionsRevokedAt` est le SEUL moyen d'invalider un JWT : il est sans
--    etat par construction, on ne peut pas le rappeler une fois emis, on peut
--    seulement refuser de l'honorer a la prochaine requete.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionsRevokedAt"  TIMESTAMP(3);

-- 2) Suspension d'un salon. REVERSIBLE : les donnees restent en place, un
--    salon qui regularise retrouve son historique intact.
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "suspendedAt"     TIMESTAMP(3);
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT;

-- 3) Notes internes de support — l'historique des appels.
CREATE TABLE IF NOT EXISTS "SupportNote" (
    "id"          TEXT NOT NULL,
    "providerId"  TEXT NOT NULL,
    "authorId"    TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "contenu"     TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportNote_pkey" PRIMARY KEY ("id")
);

-- La seule lecture : les notes d'un salon, de la plus recente a la plus
-- ancienne, affichees sur sa fiche.
CREATE INDEX IF NOT EXISTS "SupportNote_providerId_createdAt_idx"
    ON "SupportNote"("providerId", "createdAt");

-- Un salon supprime emporte ses notes : elles ne designent plus personne.
-- L'AUTEUR, lui, n'est pas une cle etrangere — son e-mail est fige en texte,
-- pour que la note reste attribuable meme si le compte superadmin disparait.
ALTER TABLE "SupportNote"
    ADD CONSTRAINT "SupportNote_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
