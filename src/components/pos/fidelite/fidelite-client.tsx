"use client";

/**
 * La page Fidelite.
 *
 * REMPLACE `loyalty-client.tsx`, dont le probleme n'etait pas l'apparence
 * mais le VOCABULAIRE : « cashback », « portefeuilles clientes », « solde »,
 * « gagnés (vie) », « min. points pour échanger », et des gabarits WhatsApp
 * montres avec leurs accolades. Une gerante de salon ne pouvait pas regler
 * son programme sans qu'on lui explique chaque mot.
 *
 * Trois decisions structurantes :
 *
 * 1. TOUT S'AFFICHE EN DINARS. Un point vaut `dinarPerPoint` — 0,010 DT dans
 *    les ratios canoniques, donc 100 points = 1 DT. Afficher « 600 points »
 *    laissait croire a 600 DT. Les points restent indiques en petit, parce
 *    que la caisse et les tickets, eux, les affichent.
 *
 * 2. LA RECOMPENSE SE REGLE A LA REGLETTE (3–10 %), sur la page, sans
 *    modale : c'est le seul reglage qu'une gerante veut vraiment changer.
 *    Les trois autres regles passent dans une modale.
 *
 * 3. AUCUN CHIFFRE N'EST FIGE DANS LE JSX. Apercu, exemple et pastilles
 *    passent par `fidelite-affichage.ts`, qui applique les vraies formules de
 *    la caisse. C'est ce qui empeche la page de promettre une reduction que
 *    l'encaissement refusera.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  etatRecompense,
  programToDinarPerPoint,
} from "@/lib/rewards/fidelite-affichage";
import { Etapes } from "./etapes";
import { RegletteRecompense } from "./reglette-recompense";
import { PastillesRegles } from "./pastilles-regles";
import { ExempleVisites } from "./exemple-visites";
import { ApercuWhatsapp } from "./apercu-whatsapp";
import { Clientes, ModaleModifierPoints, type ClienteFidele } from "./clientes";
import { ModaleRegles, type ReglesForm } from "./modale-regles";

type Programme = {
  id: string;
  active: boolean;
  cashbackPct: string;
  dinarPerPoint: string;
  minPointsToRedeem: number;
  maxRedemptionPctPerSale: number;
  welcomeBonusPoints: number;
  birthdayBonusPoints: number;
  whatsappMessage: string | null;
};

export function FideliteClient({ canEditSettings }: { canEditSettings: boolean }) {
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [clientes, setClientes] = useState<ClienteFidele[]>([]);
  const [moduleActif, setModuleActif] = useState(true);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [cibleRegles, setCibleRegles] = useState(false);
  const [ciblePoints, setCiblePoints] = useState<ClienteFidele | null>(null);

  const chargerProgramme = useCallback(async () => {
    const res = await fetch("/api/rewards/program");
    if (res.status === 403) {
      setModuleActif(false);
      return;
    }
    if (res.ok) setProgramme(await res.json());
  }, []);

  const chargerClientes = useCallback(async (q: string) => {
    const url = `/api/rewards/wallets?pageSize=50${q ? `&search=${encodeURIComponent(q)}` : ""}`;
    const res = await fetch(url);
    if (res.status === 403) {
      setModuleActif(false);
      return;
    }
    if (res.ok) {
      const data = (await res.json()) as { items?: ClienteFidele[] };
      setClientes(data.items ?? []);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await chargerProgramme();
      await chargerClientes("");
      setChargement(false);
    })();
  }, [chargerProgramme, chargerClientes]);

  // La recherche est volontairement retardee : une frappe ne doit pas lancer
  // une requete par caractere.
  useEffect(() => {
    const id = setTimeout(() => void chargerClientes(recherche), 250);
    return () => clearTimeout(id);
  }, [recherche, chargerClientes]);

  /**
   * Un seul chemin d'ecriture vers l'API, pour que la reglette, la modale des
   * regles et l'editeur WhatsApp ne puissent pas divergier. Il LEVE en cas
   * d'echec : chaque appelant affiche l'erreur dans son propre formulaire,
   * la ou la gerante regarde.
   */
  async function enregistrer(champs: Record<string, unknown>) {
    const res = await fetch("/api/rewards/program", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(champs),
    });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(d.error ?? "Enregistrement impossible");
    }
    setProgramme(await res.json());
  }

  if (chargement) {
    return <p className="p-6 text-sm text-pos-ink-3">Chargement…</p>;
  }

  if (!moduleActif) {
    return (
      <div className="mx-auto h-full max-w-2xl overflow-y-auto p-6">
        <h1 className="mb-2 text-2xl font-semibold text-pos-ink">Fidélité</h1>
        <div className="rounded-xl border border-pos-warn bg-pos-highlight p-4 text-sm text-pos-ink">
          <p className="font-semibold">Le programme fidélité est en pause.</p>
          <p className="mt-1 text-pos-ink-2">
            En version gratuite, vos clientes ne gagnent ni n&apos;utilisent de
            points. Leurs soldes sont conservés et tout reprend dès le passage
            au Premium.
          </p>
          <Link
            href="/pos/premium"
            className="mt-3 inline-block rounded-lg bg-pos-accent px-4 py-2 text-sm font-medium text-white hover:bg-pos-accent/90"
          >
            Passer au Premium
          </Link>
        </div>
      </div>
    );
  }

  if (!programme) {
    return <p className="p-6 text-sm text-pos-ink-3">Fidélité indisponible.</p>;
  }

  const dinarPerPoint = programToDinarPerPoint(programme.dinarPerPoint);
  const etat = etatRecompense(Number(programme.cashbackPct));

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6 md:space-y-8">
        {/* 1 — En-tete */}
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-pos-ink md:text-2xl">Fidélité</h1>
          <span
            className={
              programme.active
                ? "inline-flex items-center gap-1.5 rounded-full bg-pos-accent px-3 py-1 text-xs font-semibold text-white"
                : "inline-flex items-center gap-1.5 rounded-full bg-pos-border px-3 py-1 text-xs font-semibold text-pos-ink-2"
            }
          >
            <span
              aria-hidden
              className={
                programme.active
                  ? "h-1.5 w-1.5 rounded-full bg-white"
                  : "h-1.5 w-1.5 rounded-full bg-pos-ink-3"
              }
            />
            {programme.active ? "Activée" : "Désactivée"}
          </span>
        </header>

        {/* 2 — Les trois etapes */}
        <Etapes />

        {/* 3 — La reglette et son apercu */}
        <RegletteRecompense
          etat={etat}
          peutModifier={canEditSettings}
          onEnregistrer={(pct) => enregistrer({ cashbackPct: pct })}
        />

        {/* 4 — Les autres regles */}
        <PastillesRegles
          minPointsToRedeem={programme.minPointsToRedeem}
          maxRedemptionPctPerSale={programme.maxRedemptionPctPerSale}
          welcomeBonusPoints={programme.welcomeBonusPoints}
          birthdayBonusPoints={programme.birthdayBonusPoints}
          dinarPerPoint={dinarPerPoint}
          peutModifier={canEditSettings}
          onModifier={() => setCibleRegles(true)}
        />

        {/* 5 — L'exemple pedagogique */}
        <ExempleVisites
          minPointsToRedeem={programme.minPointsToRedeem}
          maxRedemptionPctPerSale={programme.maxRedemptionPctPerSale}
        />

        {/* 6 — Le message WhatsApp */}
        <ApercuWhatsapp
          message={programme.whatsappMessage}
          peutModifier={canEditSettings}
          onEnregistrer={(message) => enregistrer({ whatsappMessage: message })}
        />

        {/* 7 — Les clientes */}
        <Clientes
          clientes={clientes}
          dinarPerPoint={dinarPerPoint}
          recherche={recherche}
          onRecherche={setRecherche}
          peutModifier={canEditSettings}
          onModifierPoints={setCiblePoints}
        />
      </div>

      {cibleRegles && (
        <ModaleRegles
          initial={{
            active: programme.active,
            minPointsToRedeem: programme.minPointsToRedeem,
            maxRedemptionPctPerSale: programme.maxRedemptionPctPerSale,
            welcomeBonusPoints: programme.welcomeBonusPoints,
            birthdayBonusPoints: programme.birthdayBonusPoints,
          }}
          dinarPerPoint={dinarPerPoint}
          onFermer={() => setCibleRegles(false)}
          onEnregistrer={async (valeurs: ReglesForm) => {
            await enregistrer(valeurs);
            setCibleRegles(false);
          }}
        />
      )}

      {ciblePoints && (
        <ModaleModifierPoints
          cliente={ciblePoints}
          dinarPerPoint={dinarPerPoint}
          onFermer={() => setCiblePoints(null)}
          onFait={async () => {
            setCiblePoints(null);
            await chargerClientes(recherche);
          }}
        />
      )}
    </div>
  );
}
