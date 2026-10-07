-- Categories de services, propres a chaque salon.
--
-- SANS PERTE. Une table neuve et une colonne nullable sur "Offer".
-- Aucun DROP, aucun ALTER de colonne existante, aucun UPDATE de donnees :
-- tous les services existants deviennent « non classes » et restent
-- parfaitement visibles dans l'onglet « Tout » de la caisse.

CREATE TABLE IF NOT EXISTS "ServiceCategory" (
    "id"         TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "nom"        TEXT NOT NULL,
    -- Ordre des onglets dans la caisse : le salon met ses plus vendus devant.
    "position"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- Un meme salon ne peut pas avoir deux fois « Cheveux ». La comparaison
-- insensible a la casse et aux accents se fait en amont (categorie-service.ts) ;
-- cet index n'est que le dernier filet.
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceCategory_providerId_nom_key"
    ON "ServiceCategory"("providerId", "nom");

-- La seule lecture : les categories d'un salon, dans l'ordre de ses onglets.
CREATE INDEX IF NOT EXISTS "ServiceCategory_providerId_position_idx"
    ON "ServiceCategory"("providerId", "position");

ALTER TABLE "ServiceCategory"
    ADD CONSTRAINT "ServiceCategory_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- La categorie d'un service. NULLABLE a dessein : « non classe » est un etat
-- NORMAL, c'est celui de tous les services au moment de cette migration.
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

CREATE INDEX IF NOT EXISTS "Offer_categoryId_idx" ON "Offer"("categoryId");

-- SetNull et NON Cascade : supprimer une categorie ne doit JAMAIS supprimer
-- les services qu'elle contient. Ils redeviennent « non classes », et le
-- salon les reclasse tranquillement. L'inverse ferait disparaitre un
-- catalogue entier sur un clic.
ALTER TABLE "Offer"
    ADD CONSTRAINT "Offer_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
