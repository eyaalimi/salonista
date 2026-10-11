import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerSuperadmin, journaliser } from "@/lib/superadmin-session";
import { ficheSalon } from "@/lib/support-donnees";
import { ACTIONS } from "@/lib/support-salon";
import { LIBELLE_STATUT } from "@/lib/campagne-tableau";
import {
  afficher,
  completionProfil,
  estRenseigne,
  formaterTelephone,
  lienTelephone,
  NON_RENSEIGNE,
} from "@/lib/profil-salon-complet";
import { Copiable } from "../copiable";
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

  /*
   * L'inscription ne collecte QUE le nom du salon, le telephone et l'e-mail.
   * Tout le reste se remplit ensuite, depuis le profil — ou pas. Afficher le
   * taux donne une raison concrete de rappeler : « il te manque l'adresse et
   * le matricule fiscal » est un motif d'appel, « — » n'en est pas un.
   */
  const completion = completionProfil({
    city: s.city,
    governorate: s.governorate,
    address: s.address,
    phone: s.phone,
    matriculeFiscal: s.matriculeFiscal,
    nomGerant: s.gerant?.nom,
  });

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
          {/* Un salon de demonstration n'est pas un client : le confondre
              avec un vrai faussait la lecture du parc. */}
          {s.demo && <Badge tone="neutre">Salon de démonstration</Badge>}
          {s.verified && <Badge tone="menthe">Vérifié</Badge>}
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

      {/* Un profil complet n'a rien a signaler : la banniere ne s'affiche que
          s'il manque quelque chose. */}
      {completion.manquants.length > 0 && (
        <div className="rounded-[var(--radius-card)] border border-hairline bg-creme px-5 py-4">
          <p className="font-semibold text-prune">
            Profil complété à {completion.pourcentage} % ({completion.remplis}/
            {completion.total})
          </p>
          <p className="mt-1 text-sm text-prune-soft">
            Manquant : {completion.manquants.join(", ")}.
          </p>
          <p className="mt-2 text-xs text-prune-soft">
            L&apos;inscription ne demande que le nom du salon, le téléphone et
            l&apos;e-mail — le reste se remplit depuis le profil. Un champ vide
            est normal au début, et c&apos;est une raison d&apos;appeler.
          </p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Bloc titre="Le salon">
          <Ligne label="Téléphone">
            <Copiable
              valeur={formaterTelephone(s.phone)}
              lien={lienTelephone(s.phone)}
              absent={!lienTelephone(s.phone)}
            />
          </Ligne>
          <Ligne label="Adresse">
            <Copiable valeur={afficher(s.address)} absent={!estRenseigne(s.address)} />
          </Ligne>
          <Ligne label="Ville">
            <Copiable valeur={afficher(s.city)} absent={!estRenseigne(s.city)} />
          </Ligne>
          <Ligne label="Gouvernorat">
            <Copiable valeur={afficher(s.governorate)} absent={!estRenseigne(s.governorate)} />
          </Ligne>
          <Ligne label="Matricule fiscal">
            <Copiable
              valeur={afficher(s.matriculeFiscal)}
              absent={!estRenseigne(s.matriculeFiscal)}
            />
          </Ligne>
          {/* L'assujettissement change la facturation : il doit se voir. */}
          <Ligne label="Assujetti à la TVA">{s.vatRegistered ? "Oui" : "Non"}</Ligne>
          <Ligne label="Catégorie">{s.category}</Ligne>
          <Ligne label="Inscrit le">{s.createdAt.toLocaleDateString("fr-FR")}</Ligne>
        </Bloc>

        <Bloc titre="Le gérant">
          {s.gerant ? (
            <>
              <Ligne label="Nom">
                <Copiable valeur={afficher(s.gerant.nom)} absent={!estRenseigne(s.gerant.nom)} />
              </Ligne>
              {/* C'est a cette adresse que part le lien de reinitialisation :
                  il faut pouvoir la confirmer au telephone, et la copier. */}
              <Ligne label="E-mail">
                <Copiable valeur={s.gerant.email} lien={`mailto:${s.gerant.email}`} />
              </Ligne>
              <Ligne label="Téléphone du compte">
                <Copiable
                  valeur={formaterTelephone(s.gerant.phone)}
                  lien={lienTelephone(s.gerant.phone)}
                  absent={!lienTelephone(s.gerant.phone)}
                />
              </Ligne>
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

        {/* L'ORIGINE, en entier. `utmSource` seul ne disait pas de quelle
            annonce ni de quel support venait le salon. */}
        <Bloc titre="Origine">
          <Ligne label="Campagne">
            {afficher(s.campagne)}
          </Ligne>
          <Ligne label="Source (utm_source)">{afficher(s.utmSource)}</Ligne>
          <Ligne label="Support (utm_medium)">{afficher(s.utmMedium)}</Ligne>
          <Ligne label="Nom de campagne (utm_campaign)">{afficher(s.utmCampaign)}</Ligne>
          <Ligne label="Premier contact">
            {s.firstSeenAt ? s.firstSeenAt.toLocaleString("fr-FR") : NON_RENSEIGNE}
          </Ligne>
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
                    {/* Deja chargee, mais jamais affichee jusqu'ici : c'est
                        ce qui distingue un compte utilise d'un compte dormant. */}
                    <div className="text-xs text-prune-soft">
                      {e.derniereConnexion
                        ? `Dernière connexion : ${e.derniereConnexion.toLocaleString("fr-FR")}`
                        : "Jamais connecté"}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Bloc>
      </section>

      {estRenseigne(s.description) && (
        <section className="rounded-[var(--radius-card)] border border-hairline bg-white px-5 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">
            Description du salon
          </h2>
          {/* `whitespace-pre-line` : le salon a saisi des retours a la ligne,
              les ecraser rendrait le texte illisible. */}
          <p className="mt-2 whitespace-pre-line text-sm text-prune">{s.description}</p>
        </section>
      )}

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
        Les coordonnées sont affichées en entier pour pouvoir rappeler le
        salon. En revanche, un mot de passe ou un PIN existant ne peut jamais
        être affiché : ils sont chiffrés, donc illisibles — y compris pour
        nous. La consultation de cette fiche et chaque action qui s&apos;y
        trouve sont enregistrées dans le{" "}
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
