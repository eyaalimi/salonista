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
 *
 * `requiredPermission`: when set, a PIN-employee session lacking that
 * permission is downgraded to `{ kind: "none" }`. The check lives in the
 * classifier so callers cannot bypass it — there is no path through
 * `classifySession` that yields `kind: "employee"` without the permission.
 * Owner and admin verifiers bypass permission checks by design.
 */
export function classifySession(
  session: Session | null,
  requiredPermission?: string,
): ClassifiedSession {
  if (!session) return { kind: "none" };

  if (session.employee) {
    if (requiredPermission) {
      const perms = session.employee.permissions;
      if (!perms || !perms[requiredPermission as keyof typeof perms]) {
        return { kind: "none" };
      }
    }
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
 *
 * `requiredPermission` is forwarded to classifySession — a PIN employee
 * lacking the permission is reported as `kind: "none"`, indistinguishable
 * from an unauthenticated caller from the route's perspective.
 */
export async function resolveVerifier(
  session: Session | null,
  requiredPermission?: string,
): Promise<Verifier> {
  const c = classifySession(session, requiredPermission);
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
