import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mergePermissions, type Permission } from "@/lib/permissions";
import type { EmployeeSessionData } from "@/types/next-auth";

export type EmployeeSession = EmployeeSessionData;

/**
 * Resolve the active SalonEmployee for the current request.
 *
 * Sources, in order:
 * 1. PIN-authenticated session (`session.employee` set by the salon-pin provider).
 * 2. Email/password PROVIDER session — auto-resolves the OWNER row for that provider.
 *    If no OWNER row exists yet (provider pre-dates the employees table), one is
 *    created lazily so legacy providers don't have to do anything.
 */
export async function getCurrentEmployee(): Promise<EmployeeSession | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  if (session.employee) {
    return session.employee;
  }

  if (session.user.role !== "PROVIDER") return null;

  const provider = await prisma.providerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, salonName: true, user: { select: { name: true } } },
  });
  if (!provider) return null;

  let owner = await prisma.salonEmployee.findFirst({
    where: { providerId: provider.id, role: "OWNER", userId: session.user.id },
  });

  if (!owner) {
    owner = await prisma.salonEmployee.create({
      data: {
        providerId: provider.id,
        userId: session.user.id,
        displayName: provider.user?.name ?? provider.salonName,
        role: "OWNER",
        active: true,
      },
    });
  }

  return {
    id: owner.id,
    providerId: provider.id,
    role: owner.role,
    displayName: owner.displayName,
    permissions: mergePermissions(owner.role, owner.permissions),
  };
}

class HttpError extends Error {
  constructor(public status: number, public body: { error: string }) {
    super(body.error);
  }
}

export function toResponse(err: unknown): Response | null {
  if (err instanceof HttpError) {
    return Response.json(err.body, { status: err.status });
  }
  return null;
}

export async function requireEmployee(): Promise<EmployeeSession> {
  const employee = await getCurrentEmployee();
  if (!employee) {
    throw new HttpError(401, { error: "Authentification requise" });
  }
  return employee;
}

export async function requirePermission(perm: Permission): Promise<EmployeeSession> {
  const employee = await requireEmployee();
  if (!employee.permissions[perm]) {
    throw new HttpError(403, { error: "Permission insuffisante" });
  }
  return employee;
}
