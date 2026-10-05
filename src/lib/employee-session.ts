import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mergePermissions, type Permission } from "@/lib/permissions";
import type { EmployeeSessionData } from "@/types/next-auth";
import {
  COOKIE_VUE_LECTURE,
  estEcriture,
  vueLectureActive,
} from "@/lib/support-salon";

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

  /*
   * SALON SUSPENDU : plus rien, pas meme la lecture du catalogue.
   *
   * Le controle est pose dans `requireEmployee` et NON dans
   * `requirePermission` : plus de vingt routes de la caisse appellent le
   * premier directement, sans jamais passer par le second. Les avoir
   * oubliees laissait /api/pos/catalog livrer tout le catalogue d'un salon
   * suspendu — trouve en testant la suspension pour de vrai.
   *
   * Le message EXPLIQUE la situation plutot qu'un « 403 » muet : la personne
   * au comptoir n'a pas decide de la suspension et doit savoir qui appeler.
   */
  const provider = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
    select: { suspendedAt: true },
  });
  if (provider?.suspendedAt) {
    throw new HttpError(403, {
      error:
        "Ce compte est suspendu. Contacte Salonista au plus vite : contact@salonista.tn",
    });
  }

  return employee;
}

export async function requirePermission(perm: Permission): Promise<EmployeeSession> {
  const employee = await requireEmployee();
  if (!employee.permissions[perm]) {
    throw new HttpError(403, { error: "Permission insuffisante" });
  }

  /*
   * VUE « VOIR COMME LE SALON » : lecture seule, garantie ICI.
   *
   * Masquer les boutons d'ecriture dans l'interface ne protege de rien — rien
   * n'empeche d'appeler la route directement. Le refus est donc pose au point
   * de passage unique de toute la caisse, et porte sur la PERMISSION demandee.
   *
   * `estEcriture` refuse PAR DEFAUT : une permission ajoutee plus tard sera
   * bloquee sans que personne ait a y penser.
   */
  if (await vueLectureSeuleActive()) {
    if (estEcriture(perm)) {
      throw new HttpError(403, {
        error: "Mode consultation : aucune modification n'est possible.",
      });
    }
  }

  return employee;
}

/**
 * Un superadmin consulte-t-il ce salon en lecture seule ?
 *
 * Le cookie porte la date d'expiration ; passee celle-ci, la vue se referme
 * d'elle-meme sans qu'aucune tache de nettoyage soit necessaire.
 */
async function vueLectureSeuleActive(): Promise<boolean> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const brut = jar.get(COOKIE_VUE_LECTURE)?.value;
  if (!brut) return false;
  const expire = Number(brut);
  if (!Number.isFinite(expire)) return false;
  return vueLectureActive(new Date(expire));
}
