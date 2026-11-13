"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPhoneDisplay } from "@/lib/phone";
import { normaliser } from "@/lib/suggestions-cliente";
import {
  MODELES_OFFRE,
  OFFRE_MAX,
  composerApercu,
  libelleCout,
  nettoyerOffre,
  type Audience,
} from "@/lib/promos";
import { FileEnvoiLien } from "./file-envoi-lien";

type Etat = {
  mode: "WHATSAPP" | "SIMULATION" | "LIEN";
  numeroAffiche: string | null;
  prixMessageDT: string | null;
  texteFinModele: string;
  configIncomplete: boolean;
};

type Campagne = {
  id: string;
  texteOffre: string;
  canal: "WHATSAPP" | "SIMULATION" | "LIEN";
  statut: "PROGRAMMEE" | "EN_COURS" | "TERMINEE" | "ARRETEE";
  creeLe: string;
  programmeeLe: string | null;
  nbDestinataires: number;
  envoyes: number;
  lus: number;
  echecs: number;
  restants: number;
  nonEnvoyes: number;
  revenues: number;
};

type Audiences = {
  comptes: Record<string, number>;
  refus: number;
  clientes: Array<{ id: string; prenom: string | null; nom: string | null; telephone: string }>;
};

const CHOIX_AUDIENCE: Array<{ id: Audience; label: string }> = [
  { id: "TOUTES", label: "Toutes mes clientes" },
  { id: "RECENTES_90J", label: "Venues ces 3 derniers mois" },
  { id: "INACTIVES_60J", label: "Pas venues depuis 2 mois" },
  { id: "MANUELLE", label: "Je choisis moi-même" },
];

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function PromosClient() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [salonName, setSalonName] = useState("");
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [audiences, setAudiences] = useState<Audiences | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [rechargement, setRechargement] = useState(0);

  const [offre, setOffre] = useState("");
  const [audience, setAudience] = useState<Audience>("TOUTES");
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [recherche, setRecherche] = useState("");
  const [quand, setQuand] = useState<"maintenant" | "programmer">("maintenant");
  const [dateProgrammee, setDateProgrammee] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  // Campagne par liens dont la file d'envoi est ouverte a l'ecran.
  const [fileOuverte, setFileOuverte] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    fetch("/api/pos/promos", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!vivant) return;
        if (!r.ok) {
          setErreurChargement(d.error ?? `Erreur ${r.status}`);
          return;
        }
        setEtat(d.etat);
        setSalonName(d.salonName);
        setCampagnes(d.campagnes);
      })
      .catch(() => vivant && setErreurChargement("Connexion impossible."));
    fetch("/api/pos/promos/audiences", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivant && d && setAudiences(d))
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [rechargement]);

  // Une campagne en cours : on rafraichit sa progression toutes les 10 s.
  const enCours = campagnes.some((c) => c.statut === "EN_COURS" || c.statut === "PROGRAMMEE");
  useEffect(() => {
    if (!enCours) return;
    const id = setInterval(() => {
      fetch("/api/pos/promos", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setCampagnes(d.campagnes))
        .catch(() => {});
    }, 10_000);
    return () => clearInterval(id);
  }, [enCours]);

  const nombre =
    audience === "MANUELLE" ? coches.size : audiences?.comptes[audience] ?? 0;
  const offreNette = nettoyerOffre(offre);
  const exemplePrenom = audiences?.clientes.find((c) => c.prenom)?.prenom ?? "Amira";
  const apercu = composerApercu({
    prenom: exemplePrenom,
    offre: offreNette.ok ? offreNette.offre : "Votre offre apparaîtra ici.",
    texteFin: etat?.texteFinModele ?? "",
  });
  // Par liens wa.me : la gerante envoie elle-meme depuis son WhatsApp, une
  // cliente a la fois. Gratuit, pas de programmation.
  const parLiens = etat?.mode === "LIEN";
  const programmationValide =
    parLiens || quand === "maintenant" || (dateProgrammee !== "" && new Date(dateProgrammee) > new Date());
  const peutEnvoyer =
    !!etat && !etat.configIncomplete && offreNette.ok && nombre > 0 && programmationValide && !envoi;
  const cout = parLiens ? "gratuit, depuis votre WhatsApp" : libelleCout(nombre, etat?.prixMessageDT ?? null);

  const listeFiltree = useMemo(() => {
    const q = normaliser(recherche);
    const chiffres = recherche.replace(/\D/g, "");
    return (audiences?.clientes ?? []).filter((c) => {
      if (!q) return true;
      if (chiffres.length >= 2 && c.telephone.includes(chiffres)) return true;
      return normaliser(`${c.prenom ?? ""} ${c.nom ?? ""}`).includes(q);
    });
  }, [audiences, recherche]);

  function basculer(id: string) {
    setCoches((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function envoyer() {
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await fetch("/api/pos/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offre,
          audience,
          idsManuels: audience === "MANUELLE" ? Array.from(coches) : undefined,
          programmeeLe: !parLiens && quand === "programmer" ? new Date(dateProgrammee).toISOString() : null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(d.error ?? `Erreur ${res.status}`);
        return;
      }
      if (parLiens) {
        // La file s'ouvre tout de suite : la premiere cliente est prete.
        setFileOuverte(d.campagne.id);
        setSucces(null);
      } else {
        setSucces(
          quand === "programmer"
            ? `Promo programmée pour ${d.campagne.nbDestinataires} clientes.`
            : `C'est parti : ${d.campagne.nbDestinataires} messages en cours d'envoi.`,
        );
      }
      setOffre("");
      setCoches(new Set());
      setConfirmation(false);
      setRechargement((n) => n + 1);
    } catch {
      setErreur("Connexion impossible. Réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  async function arreter(id: string, canal: Campagne["canal"]) {
    const question =
      canal === "LIEN"
        ? "Arrêter cette promo ? Les clientes restantes ne recevront rien."
        : "Arrêter cette promo ? Les messages déjà partis ne peuvent pas être rappelés.";
    if (!window.confirm(question)) return;
    if (fileOuverte === id) setFileOuverte(null);
    const res = await fetch(`/api/pos/promos/${id}/arreter`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setErreur(d.error ?? `Erreur ${res.status}`);
    setRechargement((n) => n + 1);
  }

  if (erreurChargement) {
    return <p className="p-6 text-sm text-pos-danger">{erreurChargement}</p>;
  }

  return (
    <div className="min-h-full bg-pos-bg p-4 text-pos-ink md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Promos par WhatsApp</h1>
          <p className="mt-1 text-sm text-pos-ink-3">
            {parLiens
              ? "Écrivez votre offre : elle s'ouvre, prête à envoyer, dans le WhatsApp de chaque cliente."
              : "Écrivez votre offre : elle part en un clic sur le WhatsApp de vos clientes."}
          </p>
        </div>
        {parLiens && (
          <span className="rounded-full bg-pos-accent-soft px-3 py-1 text-sm font-medium text-pos-accent">
            Envoi depuis votre WhatsApp · gratuit
          </span>
        )}
        {etat?.mode === "WHATSAPP" && (
          <span className="rounded-full bg-pos-accent-soft px-3 py-1 text-sm font-medium text-pos-accent">
            ● WhatsApp connecté · {etat.numeroAffiche}
          </span>
        )}
      </header>

      {etat?.mode === "SIMULATION" && (
        <p role="note" className="mt-4 rounded border border-pos-warn bg-pos-surface px-4 py-2 text-sm text-pos-warn">
          Mode démo — aucun message réel n&apos;est envoyé.
        </p>
      )}
      {succes && (
        <p role="status" className="mt-4 rounded border border-pos-accent bg-pos-accent-soft px-4 py-2 text-sm">
          {succes}
        </p>
      )}

      {fileOuverte && (
        <div className="mt-5">
          <FileEnvoiLien
            key={fileOuverte}
            campagneId={fileOuverte}
            onChange={() => setRechargement((n) => n + 1)}
            onFermer={() => setFileOuverte(null)}
          />
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
        <section className="rounded border border-pos-border bg-pos-surface p-4 md:p-5">
          {/* 1. L'offre */}
          <h2 className="font-semibold">
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-pos-ink text-xs text-pos-bg">1</span>
            Votre offre
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {MODELES_OFFRE.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setOffre(m.texte)}
                className="min-h-[44px] rounded-full border border-pos-border px-4 text-sm"
              >
                {m.label}
              </button>
            ))}
          </div>
          <textarea
            value={offre}
            onChange={(e) => setOffre(e.target.value)}
            rows={4}
            maxLength={OFFRE_MAX + 50}
            placeholder="Promo à 10 DT : épilation lèvre + sourcils + brushing"
            aria-label="Votre offre"
            className="mt-3 w-full rounded border-2 border-pos-ink bg-pos-surface p-3 text-base"
          />
          <div className="mt-1 flex justify-between text-xs text-pos-ink-3">
            <span>« Aslema [prénom] ! » est ajouté au début, tout seul.</span>
            <span className={`pos-mono ${offre.trim().length > OFFRE_MAX ? "text-pos-danger" : ""}`}>
              {offreNette.ok ? offreNette.offre.length : offre.trim().length} / {OFFRE_MAX}
            </span>
          </div>

          {/* 2. Les destinataires */}
          <h2 className="mt-6 font-semibold">
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-pos-ink text-xs text-pos-bg">2</span>
            Qui la reçoit ?
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Destinataires">
            {CHOIX_AUDIENCE.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={audience === a.id}
                onClick={() => setAudience(a.id)}
                className={`min-h-[64px] rounded border p-3 text-left ${
                  audience === a.id ? "border-2 border-pos-ink bg-pos-highlight" : "border-pos-border bg-pos-surface"
                }`}
              >
                <span className="block text-sm">{a.label}</span>
                <span className="pos-mono text-lg font-semibold">
                  {a.id === "MANUELLE" ? coches.size : audiences ? audiences.comptes[a.id] ?? 0 : "…"}
                </span>
              </button>
            ))}
          </div>
          {audience === "MANUELLE" && (
            <div className="mt-3 rounded border border-pos-border">
              <input
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Nom ou téléphone"
                aria-label="Chercher une cliente"
                className="min-h-[44px] w-full border-b border-pos-border px-3 text-sm"
              />
              <ul className="max-h-64 overflow-y-auto">
                {listeFiltree.map((c) => (
                  <li key={c.id}>
                    <label className="flex min-h-[44px] items-center gap-3 px-3 text-sm hover:bg-pos-bg">
                      <input type="checkbox" checked={coches.has(c.id)} onChange={() => basculer(c.id)} className="h-5 w-5" />
                      <span className="flex-1">{[c.prenom, c.nom].filter(Boolean).join(" ") || "Sans nom"}</span>
                      <span className="pos-mono text-xs text-pos-ink-3">{formatPhoneDisplay(`+${c.telephone}`)}</span>
                    </label>
                  </li>
                ))}
                {listeFiltree.length === 0 && <li className="p-3 text-sm text-pos-ink-3">Aucune cliente.</li>}
              </ul>
            </div>
          )}
          {audiences && audiences.refus > 0 && (
            <p className="mt-2 text-xs text-pos-ink-3">
              {audiences.refus === 1
                ? "1 cliente a demandé à ne plus recevoir de promos : elle est exclue automatiquement."
                : `${audiences.refus} clientes ont demandé à ne plus recevoir de promos : elles sont exclues automatiquement.`}
            </p>
          )}

          {/* 3. Quand — sans objet par liens : rien ne part tout seul. */}
          {!parLiens && (
          <>
          <h2 className="mt-6 font-semibold">
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-pos-ink text-xs text-pos-bg">3</span>
            Quand ?
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Quand">
            {(["maintenant", "programmer"] as const).map((q) => (
              <button
                key={q}
                type="button"
                role="radio"
                aria-checked={quand === q}
                onClick={() => setQuand(q)}
                className={`min-h-[44px] rounded-full border px-4 text-sm ${
                  quand === q ? "border-pos-ink bg-pos-ink text-pos-bg" : "border-pos-border"
                }`}
              >
                {q === "maintenant" ? "Maintenant" : "Programmer"}
              </button>
            ))}
            {quand === "programmer" && (
              <input
                type="datetime-local"
                value={dateProgrammee}
                onChange={(e) => setDateProgrammee(e.target.value)}
                aria-label="Date et heure d'envoi"
                className="min-h-[44px] rounded border border-pos-border px-3 text-sm"
              />
            )}
          </div>
          </>
          )}

          {/* Pied */}
          <div className="mt-6 border-t border-pos-border pt-4">
            {etat?.configIncomplete ? (
              <p className="rounded border border-pos-warn bg-pos-bg p-4 text-sm text-pos-warn">
                L&apos;envoi WhatsApp n&apos;est pas encore configuré sur le serveur. Contactez Salonista.
              </p>
            ) : (
              <>
                <p className="text-sm text-pos-ink-3">
                  <span className="pos-mono">{nombre}</span> messages WhatsApp ·{" "}
                  {parLiens ? "envoyés un par un depuis votre WhatsApp, gratuit" : cout}
                </p>
                {erreur && !confirmation && <p className="mt-2 text-sm text-pos-danger">{erreur}</p>}
                <button
                  type="button"
                  onClick={() => {
                    setErreur(null);
                    setConfirmation(true);
                  }}
                  disabled={!peutEnvoyer}
                  className="mt-3 min-h-[56px] w-full rounded bg-pos-ink px-4 text-lg font-semibold text-pos-bg disabled:opacity-40"
                >
                  {parLiens ? "Préparer l'envoi à" : "Envoyer à"} {nombre} {nombre > 1 ? "clientes" : "cliente"}
                </button>
              </>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-5">
          <section aria-label="Ce que reçoit la cliente">
            <h2 className="mb-2 font-semibold">Ce que reçoit la cliente</h2>
            <div className="rounded bg-[#EFEAE2] p-4">
              <div className="max-w-[90%] rounded-lg bg-white p-3 text-sm shadow-sm">
                <p className="text-xs font-semibold text-pos-accent">
                  {salonName || "Votre salon"} <span className="font-normal text-pos-ink-3">· Compte professionnel</span>
                </p>
                <p className="mt-1 whitespace-pre-line">{apercu}</p>
                {/* Le bouton n'existe qu'avec le modele Meta. Par liens, la
                    cliente repond STOP (ecrit en fin de message). */}
                {!parLiens && (
                  <p className="mt-2 border-t border-pos-border pt-2 text-center text-sm font-medium text-[#027EB5]">
                    Ne plus recevoir de promos
                  </p>
                )}
              </div>
            </div>
          </section>

          <section aria-label="Dernières promos">
            <h2 className="mb-2 font-semibold">Dernières promos</h2>
            {campagnes.length === 0 ? (
              <p className="text-sm text-pos-ink-3">Aucune promo envoyée pour l&apos;instant.</p>
            ) : (
              <ul className="divide-y divide-pos-border rounded border border-pos-border bg-pos-surface">
                {campagnes.map((c) => {
                  const actif = c.statut === "EN_COURS" || c.statut === "PROGRAMMEE";
                  return (
                    <li key={c.id} className="p-3 text-sm">
                      <p className="font-medium">
                        {c.texteOffre.length > 60 ? `${c.texteOffre.slice(0, 60)}…` : c.texteOffre}
                      </p>
                      <p className="text-xs text-pos-ink-3">
                        {c.statut === "PROGRAMMEE" && c.programmeeLe
                          ? `Programmée le ${new Date(c.programmeeLe).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`
                          : dateCourte(c.creeLe)}
                        {c.canal === "SIMULATION" && " · démo"}
                        {c.canal === "LIEN" && " · par votre WhatsApp"}
                        {c.statut === "ARRETEE" && " · arrêtée"}
                      </p>
                      {actif ? (
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="pos-mono">
                            {c.envoyes} / {c.nbDestinataires} envoyés
                          </span>
                          {c.canal === "LIEN" && fileOuverte !== c.id && (
                            <button
                              type="button"
                              onClick={() => setFileOuverte(c.id)}
                              className="min-h-[44px] rounded bg-pos-accent px-3 font-medium text-white"
                            >
                              Continuer
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => arreter(c.id, c.canal)}
                            className="min-h-[44px] rounded border border-pos-danger px-3 text-pos-danger"
                          >
                            Arrêter
                          </button>
                        </div>
                      ) : (
                        <p className="mt-1">
                          <span className="pos-mono">{c.envoyes}</span> envoyés ·{" "}
                          {c.canal === "WHATSAPP" && (
                            <>
                              <span className="pos-mono">{c.lus}</span> lus ·{" "}
                            </>
                          )}
                          <span className="pos-mono">{c.revenues}</span>{" "}
                          {c.revenues > 1 ? "revenues" : "revenue"} dans les 15 jours
                          {c.echecs > 0 && <span className="text-pos-ink-3"> · {c.echecs} en échec</span>}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {confirmation && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded bg-pos-surface p-6">
            <p className="text-lg font-semibold">
              Envoyer la promo à {nombre} {nombre > 1 ? "clientes" : "cliente"} ?
            </p>
            {parLiens ? (
              <p className="mt-2 text-sm">
                Vous l&apos;enverrez une par une : pour chaque cliente, WhatsApp s&apos;ouvre avec le message
                prêt, vous appuyez sur Envoyer. C&apos;est gratuit. Vous pouvez vous arrêter et reprendre plus
                tard.
              </p>
            ) : (
              <p className="mt-2 text-sm">
                {cout.charAt(0).toUpperCase() + cout.slice(1)}. Une fois partis, les messages ne peuvent pas être
                rappelés.
              </p>
            )}
            {erreur && <p className="mt-2 text-sm text-pos-danger">{erreur}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmation(false)} className="min-h-[44px] px-4">
                Annuler
              </button>
              <button
                type="button"
                onClick={envoyer}
                disabled={envoi}
                className="min-h-[44px] rounded bg-pos-ink px-5 font-semibold text-pos-bg disabled:opacity-40"
              >
                {envoi ? "Préparation…" : parLiens ? "Commencer" : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
