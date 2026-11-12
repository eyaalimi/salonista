import { requirePermission, toResponse } from "@/lib/employee-session";
import { AUDIENCES, selectionnerDestinataires } from "@/lib/promos";
import { chargerClientesPromo } from "@/lib/promos-donnees";

/**
 * GET — nombre de destinataires par audience, clientes exclues pour refus,
 * et la liste des clientes joignables (pour « Je choisis moi-même »).
 *
 * Les nombres viennent de `selectionnerDestinataires`, la MEME fonction que
 * l'envoi : le chiffre affiche sur le bouton est celui qui partira.
 */
export async function GET() {
  let employee;
  try {
    employee = await requirePermission("customers.view");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  if (!employee.permissions["promos.send"]) {
    return Response.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const maintenant = new Date();
  const clientes = await chargerClientesPromo(employee.providerId);
  const comptes: Record<string, number> = {};
  for (const audience of AUDIENCES) {
    if (audience === "MANUELLE") continue;
    comptes[audience] = selectionnerDestinataires({ clientes, audience, maintenant }).retenues.length;
  }
  const toutes = selectionnerDestinataires({ clientes, audience: "TOUTES", maintenant });
  const parId = new Map(clientes.map((c) => [c.id, c]));

  return Response.json({
    comptes,
    refus: toutes.exclues.refus,
    // Joignables seulement (refus, numeros invalides et doublons deja ecartes).
    clientes: toutes.retenues.map((r) => ({
      id: r.customerId,
      prenom: parId.get(r.customerId)?.prenom ?? null,
      nom: parId.get(r.customerId)?.nom ?? null,
      telephone: r.telephone,
    })),
  });
}
