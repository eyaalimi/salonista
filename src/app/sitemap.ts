import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL || "https://salonista.tn";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/offres`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/register`, changeFrequency: "monthly", priority: 0.3 },
  ];

  // Dynamic offer pages
  // Meme filtre que le feed public : une offre sans photo est masquee
  // partout, elle ne doit donc pas etre annoncee aux moteurs de recherche.
  const offers = await prisma.offer.findMany({
    where: { active: true, publishedToMarketplace: true, photos: { isEmpty: false } } as never,
    select: { id: true, createdAt: true },
  });

  const offerPages: MetadataRoute.Sitemap = offers.map((offer) => ({
    url: `${baseUrl}/offre/${offer.id}`,
    lastModified: offer.createdAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Meme exigence que pour les offres : une page sans contenu ne doit pas etre
  // annoncee a Google. Un salon sans offre publiee produirait une fiche quasi
  // vide, et faire decouvrir des pages vides sur un domaine neuf envoie
  // exactement le mauvais signal.
  const providers = await prisma.providerProfile.findMany({
    where: {
      offers: {
        some: {
          active: true,
          publishedToMarketplace: true,
          photos: { isEmpty: false },
        },
      },
    } as never,
    select: { id: true, createdAt: true },
  });

  const salonPages: MetadataRoute.Sitemap = providers.map((p) => ({
    url: `${baseUrl}/salon/${p.id}`,
    lastModified: p.createdAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...offerPages, ...salonPages];
}
