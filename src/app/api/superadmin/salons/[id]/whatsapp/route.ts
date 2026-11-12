import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exigerSuperadmin,
  journaliser,
  reponseMotifManquant,
  reponseRefus,
} from "@/lib/superadmin-session";
import { ACTIONS } from "@/lib/support-salon";
import { validerConnexionWhatsapp } from "@/lib/connexion-whatsapp";
import { chiffrer, cleChiffrementPresente } from "@/lib/chiffrement";

/**
 * PUT — cree ou modifie la connexion WhatsApp Cloud d'un salon.
 *
 * LE JETON N'EST JAMAIS RENVOYE : ni dans la reponse, ni dans le journal
 * (seul `jetonModifie: true/false` y figure). Il est chiffre avant d'entrer
 * en base. Un champ jeton vide garde celui qui est enregistre.
 *
 * Journal AVANT l'ecriture, comme toute action de support : si le journal
 * echoue (motif trop court compris), rien n'est modifie.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let moi;
  try {
    moi = await exigerSuperadmin();
  } catch (err) {
    const r = reponseRefus(err);
    if (r) return r;
    throw err;
  }
  const { id } = await params;
  const corps = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

  const salon = await prisma.providerProfile.findUnique({ where: { id }, select: { id: true } });
  if (!salon) return Response.json({ error: "Salon introuvable" }, { status: 404 });

  const existante = await prisma.connexionWhatsapp.findUnique({ where: { providerId: id }, select: { id: true } });
  const v = validerConnexionWhatsapp(corps, existante !== null);
  if (!v.ok) return Response.json({ error: v.erreur }, { status: 400 });

  if (v.saisie.jeton && !cleChiffrementPresente()) {
    return Response.json(
      { error: "CLE_CHIFFREMENT_SECRETS absente sur le serveur : impossible d'enregistrer le jeton." },
      { status: 503 },
    );
  }

  try {
    await journaliser({
      acteur: moi,
      action: ACTIONS.WHATSAPP_CONNEXION,
      motif: typeof corps.motif === "string" ? corps.motif : "",
      targetProviderId: id,
      req,
      metadata: {
        statut: v.saisie.statut,
        numeroAffiche: v.saisie.numeroAffiche,
        phoneNumberId: v.saisie.phoneNumberId,
        nomModele: v.saisie.nomModele,
        prixMessageDT: v.saisie.prixMessageDT,
        jetonModifie: v.saisie.jeton !== null,
      },
    });
  } catch (err) {
    const r = reponseMotifManquant(err);
    if (r) return r;
    throw err;
  }

  const { jeton, ...champs } = v.saisie;
  await prisma.connexionWhatsapp.upsert({
    where: { providerId: id },
    create: { providerId: id, ...champs, jetonChiffre: chiffrer(jeton as string) },
    update: { ...champs, ...(jeton ? { jetonChiffre: chiffrer(jeton) } : {}) },
  });

  return Response.json({ ok: true });
}
