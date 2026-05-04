import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow connections from the public domain (and the bare IP during initial setup)
  // when running behind Nginx in production.
  allowedDevOrigins: ["172.25.240.1"],
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
