-- Assujettissement du salon a la TVA.
--
-- Le taux etait porte par chaque offre et chaque produit, avec 19 % en dur
-- comme defaut. Or la majorite des salons tunisiens ne sont PAS assujettis :
-- ils devaient passer chaque ligne a 0 % a la main, et un oubli affichait une
-- TVA qu'ils ne collectent pas.
--
-- DEFAUT `false` : c'est le cas majoritaire, et l'erreur y est benigne — un
-- assujetti qui oublie de cocher voit une TVA absente et le corrige. L'inverse
-- (facturer une TVA non due) est un probleme fiscal.
--
-- Les offres DEJA en base gardent leur taux : aucun montant ne bouge tout seul
-- en production. `scripts/tva-remise-a-zero.ts` les remet a 0 % pour les salons
-- non assujettis, en inspection par defaut.
--
-- Ecrite a la main : `prisma migrate dev` voudrait aussi « corriger » la
-- contrainte CashDrawerExpense_employeeId_fkey, sur laquelle le schema et la
-- base divergent depuis juin (voir docs/seo-notes.md).
ALTER TABLE "ProviderProfile"
  ADD COLUMN "vatRegistered" BOOLEAN NOT NULL DEFAULT false;
