/**
 * Image de partage d'un salon.
 *
 * Voir `src/app/opengraph-image.tsx` pour le raisonnement general : sans
 * elle, un lien partage sur Instagram s'affiche sans visuel.
 */

import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const alt = "Salon de beauté sur Salonista";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CATEGORIES: Record<string, string> = {
  COIFFURE: "Coiffure",
  ESTHETIQUE: "Esthétique",
  ONGLERIE: "Onglerie",
  MASSAGE: "Massage",
  PARFUMERIE: "Parfumerie",
  AUTRE: "Beauté",
};

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const salon = await prisma.providerProfile.findUnique({
    where: { id },
    select: {
      salonName: true,
      city: true,
      category: true,
      _count: { select: { offers: true } },
    },
  });

  const nom = salon?.salonName ?? "Salon de beauté";
  const ville = salon?.city ?? null;
  const categorie = salon ? (CATEGORIES[salon.category] ?? "Beauté") : "Beauté";
  const nbOffres = salon?._count.offers ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#FFF6F1",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 40 }}>
          <span style={{ color: "#3A1024", fontStyle: "italic" }}>salon</span>
          <span style={{ color: "#3A1024" }}>ista</span>
          <span style={{ color: "#C42A5A" }}>.</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              backgroundColor: "#FFE0E8",
              color: "#C42A5A",
              fontSize: 26,
              padding: "10px 26px",
              borderRadius: 999,
              alignSelf: "flex-start",
            }}
          >
            {categorie}
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 68,
              color: "#3A1024",
              lineHeight: 1.15,
              maxWidth: 1000,
            }}
          >
            {nom}
          </div>
          {ville && (
            <div style={{ marginTop: 16, fontSize: 34, color: "#6B4157" }}>
              {ville}
            </div>
          )}
        </div>

        <div style={{ display: "flex", fontSize: 30, color: "#6B4157" }}>
          {nbOffres > 0
            ? `${nbOffres} prestation${nbOffres > 1 ? "s" : ""} · réservation gratuite en ligne`
            : "Réservation gratuite en ligne"}
        </div>
      </div>
    ),
    size,
  );
}
