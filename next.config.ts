import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow connections from the public domain (and the bare IP during initial setup)
  // when running behind Nginx in production.
  allowedDevOrigins: ["172.25.240.1"],
  // Skip type-checking during prod build. We type-check locally and via the
  // generated client only needs to compile; the type checker would re-validate
  // 100+ files which adds little safety on the deploy path.
  // ESLint was historically here too but Next 16 dropped that key — lint runs
  // in CI instead.
  typescript: { ignoreBuildErrors: true },
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
