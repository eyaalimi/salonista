-- Phase 2 : suivi des campagnes marketing.
--
-- SANS PERTE. Deux tables neuves et cinq colonnes nullables sur
-- "ProviderProfile". Aucun DROP, aucun ALTER de colonne existante, aucun
-- UPDATE de donnees. Les 18 salons en production ne sont pas touches :
-- leurs colonnes d'attribution restent nulles (ils sont anterieurs au suivi).

-- 1) Les campagnes.
CREATE TABLE IF NOT EXISTS "Campaign" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "slug"           TEXT NOT NULL,
    "channel"        TEXT NOT NULL,
    "startsAt"       TIMESTAMP(3) NOT NULL,
    "endsAt"         TIMESTAMP(3),
    -- Budget en MILLIMES, entier : le dinar a 3 decimales et la monnaie ne
    -- passe jamais par un flottant.
    "budgetMillimes" INTEGER,
    "utmSource"      TEXT,
    "utmMedium"      TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Campaign_slug_key" ON "Campaign"("slug");
CREATE INDEX IF NOT EXISTS "Campaign_startsAt_idx" ON "Campaign"("startsAt");

-- 2) Les evenements de l'entonnoir.
--    ANONYMES en amont de l'inscription : `visitorId` est un nombre tire au
--    hasard (128 bits) qui n'encode ni IP, ni empreinte, ni horodatage.
CREATE TABLE IF NOT EXISTS "CampaignEvent" (
    "id"          TEXT NOT NULL,
    "campaignId"  TEXT,
    "visitorId"   TEXT,
    "providerId"  TEXT,
    "type"        TEXT NOT NULL,
    "utmSource"   TEXT,
    "utmMedium"   TEXT,
    "utmCampaign" TEXT,
    "metadata"    JSONB,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignEvent_pkey" PRIMARY KEY ("id")
);

-- Les quatre lectures du tableau de bord. Le composе (campagne, type, date)
-- porte l'entonnoir filtre par periode : la requete la plus frequente, et
-- celle qui grossira le plus vite.
CREATE INDEX IF NOT EXISTS "CampaignEvent_campaignId_type_createdAt_idx"
    ON "CampaignEvent"("campaignId", "type", "createdAt");
CREATE INDEX IF NOT EXISTS "CampaignEvent_visitorId_type_idx"
    ON "CampaignEvent"("visitorId", "type");
CREATE INDEX IF NOT EXISTS "CampaignEvent_type_createdAt_idx"
    ON "CampaignEvent"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "CampaignEvent_providerId_idx"
    ON "CampaignEvent"("providerId");

-- 3) L'attribution, figee sur le salon a l'inscription.
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "campaignId"  TEXT;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "utmSource"   TEXT;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "utmMedium"   TEXT;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "firstSeenAt" TIMESTAMP(3);

-- Supprimer une campagne ne doit PAS effacer l'origine d'un salon : les UTM
-- restent en place et racontent toujours d'ou il vient. D'ou SetNull.
ALTER TABLE "ProviderProfile"
    ADD CONSTRAINT "ProviderProfile_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignEvent"
    ADD CONSTRAINT "CampaignEvent_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Un salon supprime emporte ses evenements : ils ne designent plus personne.
ALTER TABLE "CampaignEvent"
    ADD CONSTRAINT "CampaignEvent_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
