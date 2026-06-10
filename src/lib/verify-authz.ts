import type { Session } from "next-auth";

/**
 * Resolved identity of a caller verifying a QR code.
 * `kind: "owner-pending-lookup"` is an intermediate shape from the pure
 * classifier — it requires a DB hit to resolve the providerId. The async
 * `resolveVerifier` does that hit; callers only ever see `Verifier`.
 */
export type Verifier =
  | { kind: "employee"; employeeId: string; providerId: string }
  | { kind: "owner"; providerId: string }
  | { kind: "admin" }
  | { kind: "none" };

export type ClassifiedSession =
  | Verifier
  | { kind: "owner-pending-lookup"; userId: string };

/**
 * Pure classifier — no DB access. Inspects the session and returns
 * either a fully resolved Verifier OR a tag asking the caller to look
 * up the owner's providerProfile by userId.
 *
 * PIN employee path wins: a tablet session always reads as the employee,
 * not the underlying owner User the JWT might also carry.
 */
export function classifySession(session: Session | null): ClassifiedSession {
  if (!session) return { kind: "none" };

  if (session.employee) {
    return {
      kind: "employee",
      employeeId: session.employee.id,
      providerId: session.employee.providerId,
    };
  }

  // next-auth v4 types Session.user as { name?, email?, image? } only.
  // We extend the JWT with id/role in auth.ts; widen the cast here.
  const user = session.user as { id?: string; role?: string } | null | undefined;
  const role = user?.role;
  if (role === "ADMIN") return { kind: "admin" };

  if (role === "PROVIDER") {
    if (!user?.id) return { kind: "none" };
    return { kind: "owner-pending-lookup", userId: user.id };
  }

  return { kind: "none" };
}

/**
 * Async wrapper around classifySession. Resolves the owner-pending-lookup
 * case by querying providerProfile.
 */
export async function resolveVerifier(session: Session | null): Promise<Verifier> {
  const c = classifySession(session);
  if (c.kind !== "owner-pending-lookup") return c;
  // Deferred import: Prisma 7 runs module-level init on import, which
  // breaks vitest when imported at the top of a pure-helper file.
  // Keep classifySession's import path Prisma-free.
  const { prisma } = await import("@/lib/prisma");
  const profile = await prisma.providerProfile.findUnique({
    where: { userId: c.userId },
    select: { id: true },
  });
  if (!profile) return { kind: "none" };
  return { kind: "owner", providerId: profile.id };
}
