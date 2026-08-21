-- Logo du salon : distinct de `photos`, qui illustre les prestations.
-- Nullable et sans valeur par defaut : les salons existants n'en ont pas.
ALTER TABLE "ProviderProfile" ADD COLUMN "logo" TEXT;
