-- Message de promo par liens wa.me modifiable par le salon.
-- ADDITIVE : deux colonnes NULLABLES (NULL = message par defaut).

ALTER TABLE "CampagnePromo" ADD COLUMN "messageLien" TEXT;
ALTER TABLE "ProviderProfile" ADD COLUMN "modelePromoLien" TEXT;
