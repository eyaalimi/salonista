/**
 * Choix de la gerante apres le passage en version gratuite : confirmer
 * l'employee gardee, ou en choisir une autre (echange).
 */

import { NextRequest } from "next/server";
import { requirePermission, toResponse } from "@/lib/employee-session";
import {
  choixEquipeAConfirmer,
  confirmerChoixEquipe,
  echangerEmployeeGardee,
} from "@/lib/plan-equipe";

export async function GET() {
  let actor;
  try {
    actor = await requirePermission("employees.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  return Response.json({ choix: await choixEquipeAConfirmer(actor.providerId) });
}

export async function POST(req: NextRequest) {
  let actor;
  try {
    actor = await requirePermission("employees.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const body = (await req.json().catch(() => null)) as
    | { action?: "confirmer" | "echanger"; employeeId?: string }
    | null;

  if (body?.action === "confirmer") {
    await confirmerChoixEquipe(actor.providerId);
    return Response.json({ ok: true });
  }

  if (body?.action === "echanger" && body.employeeId) {
    const res = await echangerEmployeeGardee(actor.providerId, body.employeeId);
    if (!res.ok) return Response.json({ error: res.error }, { status: 409 });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Action inconnue." }, { status: 400 });
}
