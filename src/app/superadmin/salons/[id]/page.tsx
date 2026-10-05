import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerSuperadmin, journaliser } from "@/lib/superadmin-session";
import { ficheSalon } from "@/lib/support-donnees";
import { ACTIONS, masquerTelephone } from "@/lib/support-salon";
import { LIBELLE_STATUT } from "@/lib/campagne-tableau";
import { ActionsClient, NoteClient } from "./actions-client";

export default async function FicheSalonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const moi = await exigerSuperadmin();
  const { id } = await params;
  const s = await ficheSalon(id);
  if (!s) notFound();

  /*
   * CONSULTER UNE FICHE EST DEJA UNE ACTION.
   *
   * Elle expose le nom du gerant, son e-mail, l'activite commerciale du
   * salon. La tracer permet de repondre un jour a « qui a regarde ce
   * compte ? » — question qui ne se pose jamais avant d'en avoir besoin.
   *
   * Le motif est generique parce qu'aucun n'est demande pour une simple
   * lecture : exiger une phrase a chaque consultation ferait saisir
   * « support » cent fois, et viderait le champ de son sens pour les actions
   * qui comptent vraiment.
   */
  await journaliser({
    acteur: moi,
    action: ACTIONS.FICHE_CONSULTEE,
    motif: "Consultation de la fiche de support",
    targetProviderId: s.id,
    targetUserId: s.gerant?.id ?? null,
  }).catch(() => {});

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/superadmin/salons"
          className="ds-focus text-sm font-semibold text-prune-soft hover:text-prune"
        >
          ← Retour à la recherche
        </Link>
        <h1 className="ds-display mt-3 text-2xl text-prune">{s.salonName}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge
            tone={
              s.statut === "actif" ? "menthe" : s.statut === "jamais-vendu" ? "rose" : "neutre"
            }
          >
            {LIBELLE_STATUT[s.statut]}
          </Badge>
          {s.suspendedAt && <Badge tone="rose">Suspendu</Badge>}
          {s.gerant?.mustChangePassword && (
            <Badge tone="rose">Doit changer son mot de passe</Badge>
          )}
        </div>
      </div>

      {s.suspendedAt && (
        <div
          role="alert"
          className="rounded-[var(--radius-card)] border border-rose bg-rose-soft px-5 py-4"
        >
          <p className="font-semibold text-prune">
            Suspendu le {s.suspendedAt.toLocaleDateString("fr-FR")}
          </p>
          {s.suspendedReason && (
            <p className="mt-1 text-sm text-prune">Motif : {s.suspendedReason}</p>
          )}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Bloc titre="Le salon">
          <Ligne label="Ville">{s.city ?? "—"}</Ligne>
          <Ligne label="Gouvernorat">{s.governorate ?? "—"}</Ligne>
          <Ligne label="Téléphone">{masquerTelephone(s.phone)}</Ligne>
          <Ligne label="Matricule fiscal">{s.matriculeFiscal ?? "—"}</Ligne>
          <Ligne label="Inscrit le">{s.createdAt.toLocaleDateString("fr-FR")}</Ligne>
          <Ligne label="Origine">{s.campagne ?? s.utmSource ?? "—"}</Ligne>
        </Bloc>

        <Bloc titre="Le gérant">
          {s.gerant ? (
            <>
              <Ligne label="Nom">{s.gerant.nom ?? "—"}</Ligne>
              {/* L'e-mail est affiche EN ENTIER ici, contrairement a la
                  recherche : c'est a cette adresse que part le lien de
                  reinitialisation, il faut pouvoir la confirmer au telephone. */}
              <Ligne label="E-mail">{s.gerant.email}</Ligne>
              <Ligne label="E-mail vérifié">{s.gerant.emailVerifie ? "Oui" : "Non"}</Ligne>
              <Ligne label="Dernière connexion">
                {s.gerant.derniereConnexion
                  ? s.gerant.derniereConnexion.toLocaleString("fr-FR")
                  : "Jamais"}
              </Ligne>
            </>
          ) : (
            <p className="text-sm text-prune-soft">Aucun compte gérant.</p>
          )}
        </Bloc>

        <Bloc titre="Activité">
          <Ligne label="Ventes">{String(s.nbVentes)}</Ligne>
          <Ligne label="Dernière vente">
            {s.derniereVenteAt ? s.derniereVenteAt.toLocaleDateString("fr-FR") : "Aucune"}
          </Ligne>
          <Ligne label="Équipe">{String(s.employes.length)} compte(s)</Ligne>
        </Bloc>

        <Bloc titre="Appareils et équipe">
          {s.employes.length === 0 ? (
            <p className="text-sm text-prune-soft">Aucun employé.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {s.employes.map((e) => {
                const verrouille =
                  e.verrouilleJusqua !== null && e.verrouilleJusqua > new Date();
                return (
                  <li key={e.id} className="text-sm">
                    <span className="font-semibold text-prune">{e.displayName}</span>{" "}
                    <span className="text-prune-soft">({e.role})</span>
                    {!e.actif && <span className="text-prune-soft"> — inactif</span>}
                    {/* On montre l'EXISTENCE d'un PIN, jamais sa valeur. */}
                    {!e.aUnPin && <span className="text-prune-soft"> — sans PIN</span>}
                    {verrouille && (
                      <span className="font-semibold text-rose-fonce"> — verrouillé</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Bloc>
      </section>

      <ActionsClient salonId={s.id} suspendu={s.suspendedAt !== null} />

      <section className="flex flex-col gap-3">
        <h2 className="ds-display text-lg text-prune">Notes de support</h2>
        <NoteClient salonId={s.id} />
        {s.notes.length === 0 ? (
          <p className="text-sm text-prune-soft">Aucune note.</p>
        ) : (
          <ul className="overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-white">
            {s.notes.map((n) => (
              <li key={n.id} className="border-b border-hairline px-5 py-3 last:border-0">
                <p className="text-sm text-prune">{n.contenu}</p>
                <p className="mt-1 text-xs text-prune-soft">
                  {n.authorEmail} — {n.createdAt.toLocaleString("fr-FR")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-prune-soft">
        Un mot de passe ou un PIN existant ne peut jamais être affiché : ils
        sont chiffrés, donc illisibles — y compris pour nous. Chaque action de
        cette page est enregistrée dans le{" "}
        <Link href="/superadmin/journal" className="underline">
          journal d&apos;audit
        </Link>
        .
      </p>
    </div>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-hairline bg-white px-5 py-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">
        {titre}
      </h2>
      <div className="mt-3 flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 text-sm">
      <span className="text-prune-soft">{label}</span>
      <span className="font-medium text-prune">{children}</span>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "menthe" | "rose" | "neutre";
  children: React.ReactNode;
}) {
  const classes = {
    menthe: "bg-menthe text-prune",
    rose: "bg-rose-soft text-prune",
    neutre: "bg-creme text-prune-soft",
  }[tone];
  return (
    <span
      className={`rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {children}
    </span>
  );
}
