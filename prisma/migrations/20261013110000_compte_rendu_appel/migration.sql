-- Compte rendu d'appel sur les notes de support.
--
-- Une SupportNote etait du texte libre : parfait pour se souvenir,
-- inutilisable pour organiser une tournee d'appels. On ne pouvait pas
-- repondre a « qui dois-je rappeler aujourd'hui ? » sans relire toutes les
-- notes une par une.
--
-- MIGRATION ADDITIVE ET SANS PERTE :
--  - "resultat" est NULLABLE, donc les notes existantes restent valides. Une
--    note sans resultat n'est pas cassee : elle est anterieure a ce champ.
--  - "blocageLeve" a un DEFAULT, donc aucune ligne existante n'est rejetee.
--  - aucune colonne n'est supprimee ni renommee.

ALTER TABLE "SupportNote" ADD COLUMN "resultat" TEXT;
ALTER TABLE "SupportNote" ADD COLUMN "rappelLe" TIMESTAMP(3);
ALTER TABLE "SupportNote" ADD COLUMN "blocageLeve" BOOLEAN NOT NULL DEFAULT false;

-- La liste des rappels du jour, tous salons confondus, en une seule requete
-- plutot qu'un parcours des notes de chaque salon.
CREATE INDEX "SupportNote_rappelLe_idx" ON "SupportNote"("rappelLe");
