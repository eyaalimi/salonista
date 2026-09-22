-- La fiche cliente appartient a UN salon, pas a la base entiere.
--
-- AVANT : `Customer_phone_key` rendait `phone` unique globalement. Une cliente
-- inscrite chez un salon etait donc deja "prise" pour tous les autres : en
-- saisissant son numero, un nouveau salon recevait la fiche du salon d'a cote
-- (nom, prenom, email), et ne pouvait pas creer la sienne.
--
-- APRES : l'unicite porte sur le couple (firstSalonId, phone). Chaque salon
-- tient sa propre fiche ; un meme salon ne peut pas dupliquer une cliente.

-- 1) Rattacher les fiches orphelines avant de poser la contrainte.
--    En Postgres, NULL n'est jamais egal a NULL : une fiche sans salon
--    echapperait a l'unicite et laisserait passer des doublons. On les
--    rattache au salon de leur premiere reservation quand il existe.
UPDATE "Customer" c
SET "firstSalonId" = sub."providerId"
FROM (
  SELECT DISTINCT ON (b."customerId")
         b."customerId" AS "customerId",
         o."providerId" AS "providerId"
  FROM "Booking" b
  JOIN "BookingItem" bi ON bi."bookingId" = b."id"
  JOIN "Offer" o ON o."id" = bi."offerId"
  WHERE b."customerId" IS NOT NULL
  ORDER BY b."customerId", b."createdAt" ASC
) AS sub
WHERE c."id" = sub."customerId"
  AND c."firstSalonId" IS NULL;

-- 2) Deduplication defensive : si un meme salon detient deja deux fiches pour
--    un meme numero, la creation de l'index unique echouerait et bloquerait le
--    deploiement. On ne SUPPRIME rien (les ventes et reservations y pendent) :
--    on desambigue le doublon le plus recent en suffixant son numero, ce qui
--    le rend visible et corrigeable a la main par le salon.
UPDATE "Customer" c
SET "phone" = c."phone" || '-doublon-' || substr(c."id", 1, 6)
FROM (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "firstSalonId", "phone" ORDER BY "createdAt" ASC, "id" ASC
         ) AS rang
  FROM "Customer"
  WHERE "firstSalonId" IS NOT NULL
) AS d
WHERE c."id" = d."id" AND d.rang > 1;

-- 3) L'unicite globale du telephone disparait, remplacee par (salon, telephone).
DROP INDEX "Customer_phone_key";
CREATE UNIQUE INDEX "Customer_firstSalonId_phone_key"
  ON "Customer"("firstSalonId", "phone");

-- 4) `userId` perd son unicite : si deux salons ont chacun une fiche pour la
--    meme cliente inscrite sur la place de marche, les deux doivent pouvoir
--    pointer vers son compte. L'index simple reste, pour les lectures.
DROP INDEX "Customer_userId_key";
CREATE INDEX "Customer_userId_idx" ON "Customer"("userId");
