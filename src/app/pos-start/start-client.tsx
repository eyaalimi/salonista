"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
/* Le MEME validateur que le serveur (`exigerTelephoneSalon` s'appuie dessus) :
   deux regles ecrites separement finiraient par diverger, et le bouton
   s'activerait pour un numero que l'API refuse. */
import { tryNormalizePhone } from "@/lib/phone";

/** Doit rester aligne sur la verification du serveur (`api/pos/signup`). */
const MIN_PASSWORD_LENGTH = 6;

const IMG = "/images/lp/";

/**
 * Captures REELLES de la caisse, deja deployees pour la landing. Un salon qui
 * s'inscrit voit le produit qu'il active, pas une illustration generique — et
 * ces fichiers ne coutent rien de plus, ils sont deja en cache pour qui vient
 * de la page d'accueil.
 */
const VITRINE = [
  { img: "ecran-caisse", titre: "Encaisse en trois gestes", texte: "Le panier, le moyen de paiement, le ticket. Rien de plus." },
  { img: "ecran-rdv", titre: "Ton agenda au comptoir", texte: "Les rendez-vous du jour, et l'encaissement en un clic depuis la fiche." },
  { img: "ecran-fidelite", titre: "Une clientele qui revient", texte: "Des points a chaque visite, une recompense qui se declenche toute seule." },
] as const;

/** Duree d'affichage d'une capture. Assez long pour lire le titre sans presser. */
const ROTATION_MS = 5000;

export default function StartClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [salonName, setSalonName] = useState("");
  /**
   * Les HUIT chiffres locaux seulement : le « +216 » est affiche a cote du
   * champ, pas dans la valeur. Le serveur normalise de toute facon
   * (`exigerTelephoneSalon`), mais laisser la personne retaper un indicatif
   * deja visible a l'ecran invite a la double saisie (« +216 +216 20… »).
   */
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * L'email saisi appartient deja a un compte. C'est le seul cas ou l'on
   * propose de se connecter : ailleurs, un lien vers /login n'aurait aucun
   * sens et detournerait le commercial de son inscription.
   */
  const [dejaInscrit, setDejaInscrit] = useState(false);
  const [ownerPin, setOwnerPin] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [vue, setVue] = useState(0);

  /**
   * La rotation s'arrete pour qui a demande moins d'animations, et ne tourne
   * pas non plus une fois le PIN affiche : cet ecran-la demande de la lecture,
   * pas du mouvement dans le coin de l'oeil.
   */
  useEffect(() => {
    if (ownerPin) return;
    const doux = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (doux.matches) return;
    const id = setInterval(
      () => setVue((v) => (v + 1) % VITRINE.length),
      ROTATION_MS,
    );
    return () => clearInterval(id);
  }, [ownerPin]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setDejaInscrit(false);
    setBusy(true);
    try {
      const res = await fetch("/api/pos/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          salonName: salonName.trim() || undefined,
          // Les huit chiffres locaux : le serveur les normalise en `+216…`.
          phone: phone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Erreur lors de l'activation");
        setDejaInscrit(res.status === 409);
        return;
      }
      setOwnerPin(data.ownerPin);
      setEmployeeId(data.employeeId);
    } finally {
      setBusy(false);
    }
  }

  async function enterPos() {
    if (!employeeId || !ownerPin) return;
    setBusy(true);
    const result = await signIn("salon-pin", {
      employeeId,
      pin: ownerPin,
      redirect: false,
    });
    setBusy(false);
    if (result?.ok) {
      router.push("/pos/bienvenue");
    } else {
      setError("Impossible de se connecter automatiquement. Va sur /salon-pin.");
    }
  }

  /* ------------------------------------------------------------------ */
  /* Panneau de droite — la preuve par le produit.                      */
  /* ------------------------------------------------------------------ */
  const vitrine = (
    <aside
      className="hidden lg:flex flex-col justify-center gap-10 bg-rose-soft px-12 py-16"
      aria-hidden="true"
    >
      <div>
        {/* Prune et non rose-fonce : sur le rose-soft du panneau, le rose
            fonce ne mesure que 4,46:1 — sous le seuil AA de 4,5:1. */}
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-prune">
          Ta caisse, gratuite
        </p>
        <h2 className="ds-display mt-3 text-4xl leading-[1.1] text-prune">
          Tout ton salon
          <br />
          sur un seul écran.
        </h2>
      </div>

      <div>
        {/* Le conteneur porte le ratio des captures (1,6:1) : sans lui, la
            colonne se redimensionne a chaque rotation et le texte sous
            l'image sautille. */}
        <div className="relative aspect-[1585/983] w-full overflow-hidden rounded-[var(--radius-panel)] border-2 border-white bg-white">
          {VITRINE.map((v, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={v.img}
              src={`${IMG}${v.img}.webp`}
              srcSet={`${IMG}${v.img}-760.webp 760w, ${IMG}${v.img}-1100.webp 1100w, ${IMG}${v.img}-1540.webp 1540w`}
              sizes="45vw"
              alt=""
              className={
                "absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-700 " +
                (i === vue ? "opacity-100" : "opacity-0")
              }
            />
          ))}
        </div>

        <h3 className="ds-display mt-6 text-xl text-prune">
          {VITRINE[vue].titre}
        </h3>
        <p className="mt-1.5 text-base leading-relaxed text-prune-soft">
          {VITRINE[vue].texte}
        </p>

        <div className="mt-6 flex gap-2">
          {VITRINE.map((v, i) => (
            <span
              key={v.img}
              className={
                "h-1.5 rounded-full transition-all duration-500 " +
                (i === vue ? "w-8 bg-rose-fonce" : "w-1.5 bg-prune-soft/30")
              }
            />
          ))}
        </div>
      </div>
    </aside>
  );

  /* ------------------------------------------------------------------ */
  /* Le PIN, affiche une seule fois.                                    */
  /* ------------------------------------------------------------------ */
  if (ownerPin && employeeId) {
    return (
      <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <main className="flex items-center justify-center px-6 py-14 sm:px-10">
          <div className="w-full max-w-md text-center">
            <div className="mb-10 flex justify-center">
              <Logo className="text-2xl" href={null} />
            </div>

            {/* Prune sur menthe (8,13:1). Le menthe-deep n'y donnerait que
                3,73:1, et cette coche porte du sens : elle dit que le compte
                est cree. */}
            <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-menthe text-2xl text-prune">
              ✓
            </div>
            <h1 className="ds-display text-3xl leading-tight text-prune">
              Ta caisse est prête.
            </h1>
            <p className="mt-3 text-base leading-relaxed text-prune-soft">
              Note ton code PIN propriétaire — il te permet de revenir à la
              caisse à tout moment.
            </p>

            <div className="mt-8 rounded-[var(--radius-panel)] bg-rose-soft p-7">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-prune">
                Ton PIN
              </div>
              <div className="pos-mono mt-3 text-5xl font-bold tracking-[0.3em] text-prune">
                {ownerPin}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-prune-soft">
                Conserve-le précieusement. Pas de SMS — c&apos;est le seul
                écran où il s&apos;affiche.
              </p>
            </div>

            {/* Le salon vient de saisir un mot de passe : sans cette mention il
                ne saurait pas qu'il ouvre aussi son espace sur le site. */}
            <p className="mt-5 rounded-[var(--radius-panel)] border-2 border-hairline p-4 text-left text-sm leading-relaxed text-prune-soft">
              Sur salonista.tn, connecte-toi avec{" "}
              <span className="font-semibold text-prune">{email}</span> et le
              mot de passe que tu viens de choisir.
            </p>

            <div className="mt-8">
              <Button type="button" onClick={enterPos} disabled={busy} fullWidth>
                {busy ? "Connexion…" : "Continuer la configuration →"}
              </Button>
            </div>
            {error && (
              <p className="mt-4 text-sm font-medium text-rose-fonce">{error}</p>
            )}
          </div>
        </main>
        {vitrine}
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* L'inscription.                                                     */
  /* ------------------------------------------------------------------ */
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <main className="flex items-center justify-center px-6 py-14 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex justify-center lg:justify-start">
            <Logo className="text-2xl" href={null} />
          </div>

          {/* Installee, l'application tourne en `standalone` : ni barre
              d'adresse, ni bouton retour du navigateur. Sans ce lien, cette
              page est un cul-de-sac — on ne peut plus qu'aller au bout de
              l'inscription ou fermer l'application. */}
          <Link
            href="/login"
            className="ds-focus mb-5 inline-block text-sm font-semibold text-prune-soft hover:text-prune"
          >
            ← Retour à la connexion
          </Link>

          <h1 className="ds-display text-[2rem] leading-[1.1] text-prune sm:text-4xl">
            Démarre ta caisse
            <br />
            en 5 minutes.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-prune-soft">
            Encaisse tes clientes, suis ton stock, fidélise ta clientèle.{" "}
            <strong className="font-semibold text-prune">
              Gratuit, sans carte bancaire.
            </strong>
          </p>

          <form onSubmit={handleSubmit} className="mt-9 space-y-5">
            <Input
              label="Nom de ton salon"
              id="salon-name"
              type="text"
              autoFocus
              value={salonName}
              onChange={(e) => setSalonName(e.target.value)}
              placeholder="Ex : Salon Fatma"
            />

            <Input
              label="Ton téléphone"
              id="phone"
              type="tel"
              required
              inputMode="numeric"
              autoComplete="tel-national"
              leading="+216"
              value={phone}
              /* Seuls les chiffres et les espaces passent : coller un
                 « +216 20 123 456 » depuis un contact ne doit pas produire
                 un indicatif en double avec celui deja affiche. */
              onChange={(e) =>
                setPhone(e.target.value.replace(/[^\d\s]/g, "").slice(0, 11))
              }
              placeholder="20 123 456"
            />

            <Input
              label="Ton email"
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@exemple.tn"
            />

            <div>
              <Input
                label="Ton mot de passe"
                id="password"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 caractères minimum"
                autoComplete="new-password"
              />
              <p className="mt-2 px-1 text-sm leading-relaxed text-prune-soft">
                Avec ton email, il t&apos;ouvre ton espace Salonista depuis
                n&apos;importe quel navigateur — tes rendez-vous, tes offres,
                ton profil.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-[var(--radius-panel)] border-2 border-rose bg-rose-soft px-4 py-3 text-sm text-prune"
              >
                <p>{error}</p>
                {dejaInscrit && (
                  <Link
                    href="/login"
                    className="ds-focus mt-2 inline-block font-semibold text-rose-fonce underline underline-offset-2"
                  >
                    Se connecter →
                  </Link>
                )}
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              disabled={
                busy ||
                !email.trim() ||
                !tryNormalizePhone(phone) ||
                password.length < MIN_PASSWORD_LENGTH
              }
            >
              {busy ? "Activation…" : "Activer ma caisse gratuite →"}
            </Button>
          </form>

          {/* « Fonctionne hors ligne » a ete retire : la caisse a besoin d'un
              reseau. Ne pas le remettre. */}
          <ul className="mt-8 space-y-2.5 text-sm text-prune-soft">
            {[
              "Aucune carte bancaire requise",
              "Sauvegarde automatique",
              "Sans engagement, résiliable à tout moment",
            ].map((ligne) => (
              <li key={ligne} className="flex items-center gap-2.5">
                <span aria-hidden="true" className="text-menthe-deep">
                  ✓
                </span>
                {ligne}
              </li>
            ))}
          </ul>

          <p className="mt-8 text-sm text-prune-soft">
            Tu as déjà un compte ?{" "}
            <Link
              href="/login"
              className="ds-focus font-semibold text-rose-fonce underline underline-offset-2"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </main>

      {vitrine}
    </div>
  );
}
