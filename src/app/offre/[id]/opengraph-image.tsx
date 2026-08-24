/**
 * Image de partage d'une offre.
 *
 * C'est le lien qu'une influenceuse colle dans sa story : il doit montrer la
 * prestation, le salon et surtout la remise. Sans image, il passait pour un
 * lien mort.
 *
 * La photo de l'offre n'est PAS embarquee : `next/og` devrait la telecharger
 * a chaque generation, ce qui allonge le rendu et casse la vignette si le
 * fichier manque. Le bandeau de couleur et le prix barre portent l'essentiel.
 */

import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const alt = "Offre beauté sur Salonista";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// `params` est une PROMESSE en Next 16 — verifie dans
// node_modules/next/dist/docs/.../opengraph-image.md.
export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const offre = await prisma.offer.findUnique({
    where: { id },
    select: {
      title: true,
      originalPrice: true,
      discountPrice: true,
      provider: { select: { salonName: true, city: true } },
    },
  });

  const titre = offre?.title ?? "Offre beauté";
  const salon = offre?.provider.salonName ?? "Salonista";
  const ville = offre?.provider.city ?? null;
  const prix = offre ? Number(offre.discountPrice).toFixed(0) : null;
  const prixBarre =
    offre?.originalPrice && Number(offre.originalPrice) > Number(offre.discountPrice)
      ? Number(offre.originalPrice).toFixed(0)
      : null;

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
              fontSize: 62,
              color: "#3A1024",
              lineHeight: 1.15,
              maxWidth: 1000,
            }}
          >
            {titre}
          </div>
          <div style={{ marginTop: 20, fontSize: 32, color: "#6B4157" }}>
            {salon}
            {ville ? ` · ${ville}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
          {prix && (
            <div style={{ fontSize: 72, color: "#C42A5A" }}>{prix} TND</div>
          )}
          {prixBarre && (
            <div
              style={{
                fontSize: 40,
                color: "#6B4157",
                textDecoration: "line-through",
              }}
            >
              {prixBarre} TND
            </div>
          )}
          <div
            style={{
              marginLeft: "auto",
              backgroundColor: "#A8E6CF",
              color: "#1F7A5A",
              fontSize: 28,
              padding: "14px 32px",
              borderRadius: 999,
            }}
          >
            Réservation gratuite
          </div>
        </div>
      </div>
    ),
    size,
  );
}
