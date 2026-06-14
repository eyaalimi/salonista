import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow connections from the public domain (and the bare IP during initial setup)
  // when running behind Nginx in production.
  allowedDevOrigins: ["172.25.240.1"],
  // Lightsail 1GB RAM can't run the type checker during the production build
  // — it gets OOM-killed silently after compile. We type-check locally and in
  // pre-commit; skipping it on the server lets the build finish in ~20 min
  // instead of swap-thrashing forever. Same for ESLint to save more memory.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
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
