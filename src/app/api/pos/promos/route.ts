import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/modules";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { etatPromos } from "@/lib/canal-promo";
import { cleChiffrementPresente } from "@/lib/chiffrement";
import { estAudience, lireProgrammation, nettoyerOffre, selectionnerDestinataires } from "@/lib/promos";
import { chargerClientesPromo, dernieresCampagnes } from "@/lib/promos-donnees";
import { passerMoteur } from "@/lib/promos-moteur";

/**
 * GET — etat du canal + dernieres campagnes.
 *
 * Lecture : `customers.view` (permission de LECTURE, ouverte a la vue « voir
 * comme le salon » du superadmin) + `promos.send` verifiee a la main.
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
  const [etat, salon, campagnes] = await Promise.all([
    etatPromos(employee.providerId),
    prisma.providerProfile.findUnique({ where: { id: employee.providerId }, select: { salonName: true } }),
    dernieresCampagnes(employee.providerId),
  ]);
  return Response.json({ etat, salonName: salon?.salonName ?? "", campagnes });
}

/**
 * POST — cree une campagne. N'ENVOIE RIEN dans cette requete : les
 * destinataires sont enregistres EN_ATTENTE et le moteur s'en charge (un
 * premier passage est lance juste apres la reponse, via `after`, puis le
 * cron prend le relais chaque minute).
 */
export async function POST(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("promos.send");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  try {
    await requireModule(employee.providerId, "POS");
  } catch {
    return Response.json({ error: "Module POS non activé" }, { status: 403 });
  }

  const corps = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corps) return Response.json({ error: "Corps invalide" }, { status: 400 });

  const etat = await etatPromos(employee.providerId);
  if (etat.mode === "AUCUN") {
    return Response.json(
      { error: "WhatsApp n'est pas encore connecté pour votre salon. Contactez Salonista pour l'activer." },
      { status: 409 },
    );
  }
  // Sans cle, le jeton ne se dechiffre pas : refuser AVANT de creer une
  // campagne dont aucun message ne partirait.
  if (etat.mode === "WHATSAPP" && (!cleChiffrementPresente() || !process.env.WHATSAPP_GRAPH_VERSION)) {
    return Response.json(
      { error: "L'envoi WhatsApp n'est pas configuré sur le serveur. Contactez Salonista." },
      { status: 503 },
    );
  }

  const offre = nettoyerOffre(corps.offre);
  if (!offre.ok) return Response.json({ error: offre.erreur }, { status: 422 });
  if (!estAudience(corps.audience)) {
    return Response.json({ error: "Choisissez qui reçoit la promo." }, { status: 422 });
  }
  const maintenant = new Date();
  const programmation = lireProgrammation(corps.programmeeLe, maintenant);
  if (!programmation.ok) return Response.json({ error: programmation.erreur }, { status: 422 });

  const idsManuels = Array.isArray(corps.idsManuels)
    ? corps.idsManuels.filter((x): x is string => typeof x === "string")
    : [];
  const clientes = await chargerClientesPromo(employee.providerId);
  const { retenues } = selectionnerDestinataires({
    clientes,
    audience: corps.audience,
    maintenant,
    idsManuels,
  });
  if (retenues.length === 0) {
    return Response.json({ error: "Aucune cliente à qui envoyer cette promo." }, { status: 422 });
  }

  const campagne = await prisma.$transaction(async (tx) => {
    const c = await tx.campagnePromo.create({
      data: {
        providerId: employee.providerId,
        employeeId: employee.id,
        canal: etat.mode === "WHATSAPP" ? "WHATSAPP" : "SIMULATION",
        texteOffre: offre.offre,
        audience: corps.audience as string,
        programmeeLe: programmation.programmeeLe,
        statut: "PROGRAMMEE",
        nbDestinataires: retenues.length,
      },
      select: { id: true, nbDestinataires: true, programmeeLe: true },
    });
    await tx.destinatairePromo.createMany({
      data: retenues.map((r) => ({
        campagneId: c.id,
        customerId: r.customerId,
        telephone: r.telephone,
        prenom: r.prenom,
        statut: "EN_ATTENTE",
      })),
    });
    return c;
  });

  if (!programmation.programmeeLe) {
    // Apres la reponse : la gerante voit sa campagne creee tout de suite,
    // l'envoi demarre sans qu'elle attende. Une erreur ici n'est pas perdue :
    // le cron repasse dans la minute.
    after(async () => {
      try {
        await passerMoteur();
      } catch (err) {
        console.error("[promos] premier passage:", err instanceof Error ? err.message : err);
      }
    });
  }

  return Response.json({ campagne }, { status: 201 });
}
