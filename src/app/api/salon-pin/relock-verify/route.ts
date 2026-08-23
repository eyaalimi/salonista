/**
 * Revalide le PIN de l'employe deja connecte, apres un verrouillage par
 * inactivite.
 *
 * Ne cree AUCUNE session : celle-ci est intacte, l'ecran est simplement
 * masque. On verifie seulement que la personne devant la tablette est bien
 * celle qui s'est connectee.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEmployee, toResponse } from "@/lib/employee-session";
import { PinVerrouilleError, verifierPinEmploye } from "@/lib/verify-employee-pin";

export async function POST(req: NextRequest) {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const body = (await req.json().catch(() => null)) as { pin?: string } | null;
  const pin = body?.pin?.trim() ?? "";
  if (!pin) {
    return NextResponse.json({ error: "PIN requis" }, { status: 400 });
  }

  try {
    await verifierPinEmploye(employee.id, pin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "PIN incorrect";
    // 423 « Locked » distingue un compte verrouille d'un simple PIN faux :
    // l'interface peut alors cesser de proposer le pave numerique.
    const status = err instanceof PinVerrouilleError ? 423 : 401;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
