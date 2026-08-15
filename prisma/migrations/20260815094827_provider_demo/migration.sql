-- Salon de demonstration : exclu de l'index Google (noindex + absent du
-- sitemap) mais parfaitement consultable. Le defaut false laisse tous les
-- salons existants indexables, donc aucune donnee n'est affectee.
ALTER TABLE "ProviderProfile" ADD COLUMN "demo" BOOLEAN NOT NULL DEFAULT false;
