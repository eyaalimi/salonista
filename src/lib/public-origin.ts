import type { NextRequest } from "next/server";

// Behind Nginx, req.url resolves to localhost:3000 because that's what the
// upstream sees. Prefer the proxy's forwarded headers, then NEXTAUTH_URL,
// and only fall back to req.url for local/dev runs without a reverse proxy.
export function publicOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (proto && host) return `${proto}://${host}`;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  return new URL(req.url).origin;
}
