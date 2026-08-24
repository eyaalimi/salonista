import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Aucun en-tete de securite n'etait envoye. Voir src/lib/security-headers.ts
  // pour le detail de chacun ; la CSP part en Report-Only le temps de
  // decouvrir ce que les pages chargent vraiment.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(process.env.NODE_ENV === "production"),
      },
    ];
  },
  // Allow connections from the public domain (and the bare IP during initial setup)
  // when running behind Nginx in production.
  allowedDevOrigins: ["172.25.240.1"],
  // `typescript: { ignoreBuildErrors: true }` a ete RETIRE : les 23 erreurs
  // qu'il masquait sont corrigees (type `Provider` duplique cinq fois dans
  // l'assistant, et signatures `Pick<RewardProgram, …>` qui exigeaient des
  // `Decimal` la ou seul `.toString()` etait appele).
  //
  // Ne le remettez pas pour faire passer un build : le compilateur est
  // desormais le garde-fou du deploiement, en plus de la CI.
  images: {
    // Allow next/image to optimize files served from /uploads/ (user-uploaded photos).
    // In Next.js 16, local paths with query strings must be explicitly whitelisted.
    localPatterns: [
      {
        pathname: "/uploads/**",
        search: "",
      },
      {
        pathname: "/images/**",
        search: "",
      },
    ],
    remotePatterns: [],
  },
};

export default nextConfig;
