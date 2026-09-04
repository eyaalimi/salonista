import { MetadataRoute } from "next";
import { MARKETPLACE_PUBLIQUE } from "@/lib/flags";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || "https://salonista.tn";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/cliente/",
          "/prestataire/",
          "/influenceuse/",
          "/admin/",
          // Fermees tant que la place de marche n'est pas ouverte : elles
          // redirigent vers "/", inutile d'y envoyer un robot.
          ...(MARKETPLACE_PUBLIQUE ? [] : ["/offres", "/offre/", "/salon/", "/pro"]),
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
