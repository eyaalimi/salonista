import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow connections from the public domain (and the bare IP during initial setup)
  // when running behind Nginx in production.
  allowedDevOrigins: ["172.25.240.1"],
  images: {
    // Local /uploads/* is served from public/, no remote loader needed.
    remotePatterns: [],
  },
};

export default nextConfig;
