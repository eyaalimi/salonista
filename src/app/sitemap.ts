import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL || "https://beaute.tn";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/offres`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/register`, changeFrequency: "monthly", priority: 0.3 },
  ];

  // Dynamic offer pages
  const offers = await prisma.offer.findMany({
    where: { active: true },
    select: { id: true, createdAt: true },
  });

  const offerPages: MetadataRoute.Sitemap = offers.map((offer) => ({
    url: `${baseUrl}/offre/${offer.id}`,
    lastModified: offer.createdAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...offerPages];
}
