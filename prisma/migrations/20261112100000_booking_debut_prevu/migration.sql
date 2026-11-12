-- Heure prevue d'un passage libre (rendez-vous sans service, donc sans
-- creneau). Elle etait calculee a la creation puis jetee : le calendrier
-- plaçait ces rendez-vous a leur date de creation, donc sur le mauvais jour.
--
-- ADDITIVE ET SANS PERTE : deux colonnes NULLABLES. Les passages libres deja
-- enregistres restent nuls et retombent sur "createdAt" — c'etait leur seule
-- information, rien n'est invente.

ALTER TABLE "Booking" ADD COLUMN "debutPrevu" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "finPrevue" TIMESTAMP(3);

CREATE INDEX "Booking_debutPrevu_idx" ON "Booking"("debutPrevu");
