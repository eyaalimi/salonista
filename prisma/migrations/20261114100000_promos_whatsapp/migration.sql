-- Promos WhatsApp : connexion d'un salon a l'API WhatsApp Cloud, campagnes,
-- destinataires, et consentement de la cliente.
--
-- ADDITIVE ET SANS PERTE. Les fiches clientes existantes passent a
-- promosAcceptees = true (decision des fondateurs du 12/11/2026 : la case est
-- cochee par defaut, la gerante la decoche si la cliente refuse).

CREATE TYPE "CanalPromo" AS ENUM ('WHATSAPP', 'SIMULATION');
CREATE TYPE "StatutConnexionWhatsapp" AS ENUM ('BROUILLON', 'ACTIVE', 'SUSPENDUE');

ALTER TABLE "Customer" ADD COLUMN "promosAcceptees" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Customer" ADD COLUMN "promosRefuseesAt" TIMESTAMP(3);

CREATE TABLE "ConnexionWhatsapp" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "statut" "StatutConnexionWhatsapp" NOT NULL DEFAULT 'BROUILLON',
    "numeroAffiche" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "jetonChiffre" TEXT NOT NULL,
    "nomModele" TEXT NOT NULL,
    "langueModele" TEXT NOT NULL DEFAULT 'fr',
    "texteFinModele" TEXT NOT NULL,
    "prixMessageDT" DECIMAL(10,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnexionWhatsapp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampagnePromo" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "canal" "CanalPromo" NOT NULL,
    "texteOffre" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "programmeeLe" TIMESTAMP(3),
    "statut" TEXT NOT NULL,
    "nbDestinataires" INTEGER NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termineeLe" TIMESTAMP(3),

    CONSTRAINT "CampagnePromo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DestinatairePromo" (
    "id" TEXT NOT NULL,
    "campagneId" TEXT NOT NULL,
    "customerId" TEXT,
    "telephone" TEXT NOT NULL,
    "prenom" TEXT,
    "statut" TEXT NOT NULL,
    "reserveLe" TIMESTAMP(3),
    "messageIdExterne" TEXT,
    "erreur" TEXT,
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "envoyeLe" TIMESTAMP(3),
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DestinatairePromo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConnexionWhatsapp_providerId_key" ON "ConnexionWhatsapp"("providerId");
CREATE INDEX "ConnexionWhatsapp_phoneNumberId_idx" ON "ConnexionWhatsapp"("phoneNumberId");
CREATE INDEX "CampagnePromo_providerId_creeLe_idx" ON "CampagnePromo"("providerId", "creeLe");
CREATE INDEX "CampagnePromo_statut_programmeeLe_idx" ON "CampagnePromo"("statut", "programmeeLe");
CREATE UNIQUE INDEX "DestinatairePromo_messageIdExterne_key" ON "DestinatairePromo"("messageIdExterne");
CREATE INDEX "DestinatairePromo_campagneId_statut_idx" ON "DestinatairePromo"("campagneId", "statut");
CREATE INDEX "DestinatairePromo_statut_reserveLe_idx" ON "DestinatairePromo"("statut", "reserveLe");
CREATE UNIQUE INDEX "DestinatairePromo_campagneId_telephone_key" ON "DestinatairePromo"("campagneId", "telephone");

ALTER TABLE "ConnexionWhatsapp" ADD CONSTRAINT "ConnexionWhatsapp_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampagnePromo" ADD CONSTRAINT "CampagnePromo_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampagnePromo" ADD CONSTRAINT "CampagnePromo_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "SalonEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DestinatairePromo" ADD CONSTRAINT "DestinatairePromo_campagneId_fkey"
    FOREIGN KEY ("campagneId") REFERENCES "CampagnePromo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DestinatairePromo" ADD CONSTRAINT "DestinatairePromo_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
