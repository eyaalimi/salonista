/**
 * Image de partage de l'accueil.
 *
 * Aucune n'existait : un lien Salonista colle dans une story Instagram ou un
 * message WhatsApp s'affichait sans visuel, comme un lien mort. C'est la
 * premiere impression de la marque, alors que toute l'acquisition passe par
 * la.
 *
 * Generee par `next/og` a la demande, puis mise en cache. Pas de police
 * personnalisee : les charger demande d'embarquer un fichier et rallonge le
 * rendu ; les polices systeme suffisent a une vignette lue en un coup d'oeil.
 */

import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Salonista — réservez vos soins beauté en Tunisie";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FFF6F1",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 88 }}>
          <span style={{ color: "#3A1024", fontStyle: "italic" }}>salon</span>
          <span style={{ color: "#3A1024" }}>ista</span>
          <span style={{ color: "#C42A5A" }}>.</span>
        </div>

        <div
          style={{
            marginTop: 32,
            fontSize: 38,
            color: "#6B4157",
            textAlign: "center",
            maxWidth: 900,
            lineHeight: 1.3,
          }}
        >
          Réservez vos soins beauté en ligne, partout en Tunisie
        </div>

        <div
          style={{
            marginTop: 48,
            display: "flex",
            gap: 20,
            fontSize: 26,
            color: "#3A1024",
          }}
        >
          {["Coiffure", "Esthétique", "Onglerie", "Massage"].map((c) => (
            <div
              key={c}
              style={{
                backgroundColor: "#FFE0E8",
                padding: "12px 28px",
                borderRadius: 999,
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
