import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicOrigin } from "@/lib/public-origin";

// Rate limit store (in-memory, resets on server restart — fine for MVP)
const clickCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string, max: number): boolean {
  const now = Date.now();
  const entry = clickCounts.get(key);
  if (!entry || now > entry.resetAt) {
    clickCounts.set(key, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count++;
  return false;
}

// GET: register a click and redirect to offer page
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("ref");
  const origin = publicOrigin(req);

  if (!token) {
    return NextResponse.redirect(new URL("/offres", origin));
  }

  const trackingLink = await prisma.trackingLink.findUnique({
    where: { token },
  });

  if (!trackingLink) {
    return NextResponse.redirect(new URL("/offres", origin));
  }

  const offerId = trackingLink.offerId;

  // Get client IP (anonymized)
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const anonymizedIp = ip.split(".").slice(0, 3).join(".") + ".0";

  const redirectUrl = new URL(`/offre/${offerId}`, origin);
  const response = NextResponse.redirect(redirectUrl);

  // Set tracking cookie here (last click wins, valid 7 days)
  response.cookies.set("tracking_ref", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  // Rate limit: max 5 clicks per IP per offer per 24h — still redirect & set cookie, just don't count
  const rateLimitKey = `${anonymizedIp}:${offerId}`;
  if (isRateLimited(rateLimitKey, 5)) {
    return response;
  }

  await prisma.click.create({
    data: {
      trackingLinkId: trackingLink.id,
      clientIp: anonymizedIp,
      userAgent: req.headers.get("user-agent") || null,
      referrer: req.headers.get("referer") || null,
    },
  });

  await prisma.trackingLink.update({
    where: { id: trackingLink.id },
    data: { clicksCount: { increment: 1 } },
  });

  return response;
}
