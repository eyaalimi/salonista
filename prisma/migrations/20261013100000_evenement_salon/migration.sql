-- Activite technique d'un salon inscrit : connexions refusees, PIN, tiroir,
-- ecrans ouverts. Alimente le cockpit d'appels /superadmin/appels.
--
-- Table A PART de "CampaignEvent", deliberement : celle-la compte des
-- visiteurs anonymes pour piloter le budget publicitaire. Melanger les deux
-- gonflerait l'entonnoir avec des salons deja convertis.
--
-- Migration purement ADDITIVE : aucune colonne existante n'est touchee.

CREATE TABLE "EvenementSalon" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "employeeId" TEXT,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvenementSalon_pkey" PRIMARY KEY ("id")
);

-- L'activite d'un salon : la fiche de droite du cockpit.
CREATE INDEX "EvenementSalon_providerId_createdAt_idx"
    ON "EvenementSalon"("providerId", "createdAt");

-- Le comptage d'un type sur une periode, pour TOUS les salons d'un coup :
-- c'est ce qui evite une requete par salon dans la file d'appels.
CREATE INDEX "EvenementSalon_type_createdAt_idx"
    ON "EvenementSalon"("type", "createdAt");

-- Cascade : si un salon ferme son compte, son activite technique part avec
-- lui. Contrairement au journal superadmin, elle ne sert qu'a l'accompagner.
ALTER TABLE "EvenementSalon"
    ADD CONSTRAINT "EvenementSalon_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
