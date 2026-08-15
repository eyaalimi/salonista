# Refonte visuelle lot 1 — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installer les tokens du nouveau design system (4 couleurs, 2 polices, pills, sans ombres) et refaire la page de connexion comme premier écran de référence.

**Architecture:** Les tokens vont dans `@theme inline` de `globals.css`, **à côté** des anciens `brand-*` et `pos-*` qui restent intacts — 142 fichiers en dépendent, dont la caisse en production. Trois primitifs seulement (`Button`, `Input`, `RoleTabs`), ceux que la page de connexion utilise réellement. Le sélecteur de rôle oriente l'inscription ; il ne filtre pas la connexion, qui ne prend aucun rôle.

**Tech Stack:** Next.js 16.2 (App Router), Tailwind v4 (`@theme inline`), React 19, TypeScript.

**Spec:** [docs/superpowers/specs/2026-08-15-refonte-visuelle-lot1-design.md](../specs/2026-08-15-refonte-visuelle-lot1-design.md)

---

## Contexte pour l'ingénieur

**Salonista** est une marketplace beauté tunisienne. Elle a deux surfaces : la
**marketplace publique** (accueil, fiches salon, fiches service, connexion) et
une **PWA de caisse** sur tablette (`/pos`) utilisée par des salons pilotes **en
production**.

Ce lot installe une nouvelle identité visuelle et refait **une seule page** : la
connexion. C'est volontairement petit — c'est un banc d'essai. Si le rendu
convient, les lots suivants étendront le système au feed puis au reste.

**Huit choses à savoir avant de toucher au code :**

1. **NE SUPPRIME AUCUN token `brand-*` ni `pos-*`.** 142 fichiers `.tsx` en
   dépendent, dont la caisse en production. Les nouveaux tokens s'**ajoutent**.
   Une suppression casserait le site entier.

2. **Tailwind v4**, pas v3. Les tokens se déclarent dans le bloc
   `@theme inline { … }` de `src/app/globals.css`. Un token
   `--color-rose: #FF5C8A;` y génère automatiquement les classes `bg-rose`,
   `text-rose`, `border-rose`.

3. **Aucun test de composant n'est possible.** Vitest tourne en
   `environment: "node"` **sans jsdom** et sans `@testing-library/react`. Ce plan
   n'ajoute aucun test — et n'installe pas jsdom pour l'occasion. La vérification
   est : build + `tsc` + ESLint + **contrôle visuel par l'utilisateur**.

4. **Le brief interdit trois choses**, présentes dans la page actuelle :
   `box-shadow` (et les classes `shadow-*`), les dégradés (`bg-gradient-*`), les
   flous (`blur-*`). Elles doivent disparaître **de la page de connexion**. On ne
   touche pas au reste du site dans ce lot.

5. **Bricolage Grotesque n'est PAS dans `next/font/google`** de cette version de
   Next — vérifié. Archivo si. Bricolage passe donc par `@import` CSS. Les deux
   répondent bien chez Google Fonts (HTTP 200).

6. **`signIn("credentials")` ne prend aucun rôle.** La redirection se fait
   **après** connexion via `/api/auth/redirect` selon `session.user.role`. Le
   sélecteur de rôle ne doit donc **jamais** filtrer ou bloquer la connexion.

7. **L'UI est en français, au tutoiement, en sentence case** (« Se connecter »,
   pas « SE CONNECTER » ni « Se Connecter »).

8. **ESLint signale une erreur pré-existante** dans
   `src/app/salon/[id]/salon-client.tsx` (`react-hooks/set-state-in-effect`).
   Elle n'est pas la tienne et tu ne touches pas ce fichier.

**Commandes :**

```bash
npm run build         # verification principale
npx tsc --noEmit      # seul filet sur les types (le build ne type-check pas)
npm run lint          # ESLint
npm test              # doit rester au nombre actuel — tu n'ajoutes aucun test
```

**Erreurs `tsc` pré-existantes :** deux fichiers,
`src/components/pos/onboarding/wizard-client.tsx` et
`src/lib/rewards/rewards.test.ts`. Vérifie qu'il ne s'en ajoute pas :

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
```

**Attention build :** `npm run build` prérend `/` et `/sitemap.xml`, qui
interrogent la base. Sans PostgreSQL il échoue sur `ECONNREFUSED localhost:5433`
**avant** d'atteindre tes pages. Démarre une base jetable :

```bash
docker run -d --name design-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=beaute_marketplace -p 5433:5432 postgres:16
npx prisma migrate deploy
```

---

## La palette et les polices

| Token | Hex | Usage |
|---|---|---|
| Rose Gloss | `#FF5C8A` | Action primaire, accents |
| Prune | `#3A1024` | Texte, surfaces sombres |
| Menthe | `#A8E6CF` | Disponibilité, économies, commissions, confirmation |
| Crème | `#FFF6F1` | Fond |

- **Bricolage Grotesque** → titres, accroches, wordmark
- **Archivo** → interface, formulaires, montants

**Menthe ne sert jamais** à une action neutre ou destructrice. **Une seule action
primaire rose par vue.**

---

## Structure des fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/app/globals.css` | Tokens : couleurs, polices, rayons, transitions | **Modifier** |
| `src/app/layout.tsx` | Charger Archivo | **Modifier** |
| `src/components/ui/button.tsx` | Bouton pill, variantes `primary`/`secondary` | **Créer** |
| `src/components/ui/input.tsx` | Champ pill avec label | **Créer** |
| `src/components/ui/role-tabs.tsx` | Sélecteur à trois onglets | **Créer** |
| `src/app/(auth)/login/login-client.tsx` | Réécriture complète | **Modifier** |
| `src/app/(auth)/register/register-client.tsx` | Lire `?role=` dans l'URL | **Modifier** |

Trois primitifs, pas les douze du brief : seuls ceux que la page de connexion
emploie réellement. `Chip`, `Card`, `Badge` viendront au lot 2, avec le feed.

---

## Task 0 : Créer la branche

**Files:** aucun

- [ ] **Step 1 : Vérifier que l'arbre est propre et à jour**

```bash
git status --short
git checkout main
git pull
```

Attendu : `git status --short` ne renvoie rien. Si l'arbre est sale, arrête-toi
et signale-le.

- [ ] **Step 2 : Créer la branche**

```bash
git checkout -b design-lot1
```

Attendu : `Switched to a new branch 'design-lot1'`

---

## Task 1 : Les tokens dans globals.css

**Files:**
- Modify: `src/app/globals.css`

Le fichier commence par `@import "tailwindcss";` puis un bloc `@theme inline`
contenant déjà les tokens `brand-*` et `pos-*`. **Tu ajoutes dedans, tu ne
retires rien.**

- [ ] **Step 1 : Importer Bricolage Grotesque**

Tout en haut du fichier, **avant** `@import "tailwindcss";` — les `@import` CSS
doivent précéder toute autre règle :

```css
/* Bricolage Grotesque n'est pas au catalogue de next/font/google dans cette
   version de Next (verifie) ; Archivo si, et passe par le helper dans
   layout.tsx. D'ou cet import CSS pour la seule police de titres. */
@import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&display=swap");
@import "tailwindcss";
```

- [ ] **Step 2 : Ajouter les tokens du design system**

Dans le bloc `@theme inline`, **juste après** la ligne
`--font-heading: var(--font-playfair);`, insère :

```css
  /* ---- Design system 2026 : rose / prune / menthe / creme ----
     Ces tokens s'AJOUTENT aux brand-* ci-dessous, qui restent en place :
     142 fichiers en dependent, dont la caisse en production. Les anciens
     disparaitront lot par lot, quand plus rien ne les referencera. */
  --color-rose: #FF5C8A;
  --color-rose-soft: #FFE0E8;
  --color-prune: #3A1024;
  --color-prune-soft: #6B4157;
  --color-menthe: #A8E6CF;
  --color-menthe-deep: #1F7A5A;
  --color-creme: #FFF6F1;
  --color-hairline: #EFE2DC;

  --font-display: "Bricolage Grotesque", system-ui, sans-serif;
  --font-ui: var(--font-archivo), system-ui, sans-serif;

  --radius-pill: 999px;
  --radius-card: 36px;
  --radius-panel: 22px;
```

`--color-rose-soft` sert aux fonds d'onglet inactif, `--color-menthe-deep` au
texte sur menthe (le menthe pur n'a pas assez de contraste pour du texte), et
`--color-hairline` aux bordures fines.

**`menthe` et `menthe-deep` ne sont utilisés nulle part dans ce lot** — ce n'est
pas un oubli. Le menthe est réservé à la disponibilité, aux économies, aux
commissions et aux confirmations, qui n'apparaissent qu'au lot 2 (le feed, avec
ses badges « LIBRE 14:00 »). Les déclarer maintenant évite de rouvrir ce fichier.

- [ ] **Step 3 : Ajouter les classes d'interaction**

À la **fin** du fichier, ajoute :

```css
/* ---- Interactions du design system 2026 ----
   Survol = couleur seule. Appui = 0.97. Focus = anneau rose 2px.
   Desactive = opacite 0.4. Rien ne rebondit. */
.ds-press {
  transition: transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
              background-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
              color 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
              border-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.ds-press:active:not(:disabled) {
  transform: scale(0.97);
}
.ds-press:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.ds-focus:focus-visible {
  outline: none;
  border-color: var(--color-rose);
  box-shadow: 0 0 0 2px var(--color-rose);
}

/* Le titre du design system 2026. N'affecte que les elements qui l'utilisent
   explicitement — .luxury-heading reste en place pour les pages non migrees. */
.ds-display {
  font-family: var(--font-display);
  font-weight: 800;
  letter-spacing: -0.02em;
}
```

Note : `.ds-focus` utilise `box-shadow` — c'est la seule exception à la règle
« aucune ombre », parce que c'est un anneau de focus, pas une élévation. Le brief
le demande explicitement (« focus is a 2px rose ring »).

- [ ] **Step 4 : Vérifier que rien n'est cassé**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npm test
```

Attendu : seuls les deux fichiers pré-existants ; le nombre de tests inchangé.

- [ ] **Step 5 : Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): tokens du design system 2026

Rose, prune, menthe, creme, plus les rayons et les interactions. Ajoutes
a cote des brand-* et pos-*, qui restent : 142 fichiers en dependent."
```

---

## Task 2 : Charger la police Archivo

**Files:**
- Modify: `src/app/layout.tsx`

Le fichier charge déjà `Geist` et `Playfair_Display` via `next/font/google`. On
ajoute Archivo **sans retirer** les deux autres — les pages non migrées les
utilisent encore.

- [ ] **Step 1 : Importer Archivo**

Ligne 2-3, à la suite des imports de polices existants :

```tsx
import { Geist } from "next/font/google";
import { Playfair_Display } from "next/font/google";
import { Archivo } from "next/font/google";
```

- [ ] **Step 2 : Instancier la police**

Après la déclaration de `playfair` (autour de la ligne 14), ajoute :

```tsx
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
```

- [ ] **Step 3 : Ajouter la variable au `<body>`**

Trouve l'élément `<body>` et sa `className` — elle contient déjà
`${geistSans.variable}` et `${playfair.variable}`. Ajoute `${archivo.variable}` à
la suite, en gardant les autres.

- [ ] **Step 4 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint src/app/layout.tsx
```

Attendu : aucune erreur nouvelle, ESLint silencieux.

- [ ] **Step 5 : Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(design): charger la police Archivo

Geist et Playfair restent : les pages non migrees les utilisent encore."
```

---

## Task 3 : Le bouton

**Files:**
- Create: `src/components/ui/button.tsx`

- [ ] **Step 1 : Créer le fichier**

```tsx
"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Bouton du design system 2026.
 *
 * Tout ce qui est cliquable est une pill. Aucune ombre : la hierarchie passe
 * par la couleur. Une seule action `primary` (rose) par vue — au-dela, l'oeil
 * ne sait plus ou aller.
 */
export function Button({
  variant = "primary",
  fullWidth = false,
  children,
  className = "",
  ...props
}: {
  variant?: "primary" | "secondary" | "ghost";
  fullWidth?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "ds-press ds-focus inline-flex items-center justify-center gap-2 " +
    // 44px minimum : cible tactile confortable au doigt.
    "min-h-[48px] px-6 rounded-[var(--radius-pill)] " +
    "text-base font-semibold border-2 border-transparent";

  const variants: Record<string, string> = {
    primary: "bg-rose text-white hover:bg-[#F04A79]",
    secondary: "bg-prune text-white hover:bg-[#4E1832]",
    ghost: "bg-transparent text-prune border-hairline hover:bg-creme",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

Les couleurs de survol sont des variantes plus sombres du rose et du prune,
écrites en dur : ce sont des états dérivés, pas des tokens du design system.

- [ ] **Step 2 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint src/components/ui/button.tsx
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat(design): bouton pill sans ombre"
```

---

## Task 4 : Le champ de saisie

**Files:**
- Create: `src/components/ui/input.tsx`

- [ ] **Step 1 : Créer le fichier**

```tsx
"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * Champ de saisie du design system 2026.
 *
 * Pill, bordure fine, focus en anneau rose. Le corps fait 16px : en dessous,
 * iOS zoome automatiquement au focus, ce qui casse la mise en page.
 */
export function Input({
  label,
  id,
  trailing,
  className = "",
  ...props
}: {
  label: string;
  id: string;
  trailing?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={id}
          className={
            "ds-focus w-full min-h-[52px] px-5 text-base text-prune " +
            "rounded-[var(--radius-pill)] border-2 border-hairline bg-white " +
            "placeholder:text-prune-soft/50 " +
            (trailing ? "pr-14 " : "") +
            className
          }
          {...props}
        />
        {trailing && (
          <div className="absolute right-4 flex items-center">{trailing}</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint src/components/ui/input.tsx
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/ui/input.tsx
git commit -m "feat(design): champ de saisie pill

Corps a 16px : en dessous, iOS zoome au focus et casse la mise en page."
```

---

## Task 5 : Le sélecteur de rôle

**Files:**
- Create: `src/components/ui/role-tabs.tsx`

- [ ] **Step 1 : Créer le fichier**

```tsx
"use client";

/**
 * Selecteur de role de la page de connexion.
 *
 * IMPORTANT : il n'agit PAS sur l'authentification. signIn("credentials") ne
 * prend aucun role, et /api/auth/redirect oriente APRES coup selon
 * session.user.role. Ce selecteur change l'accroche et la destination
 * d'inscription — rien d'autre. Le faire filtrer la connexion ajouterait une
 * facon d'echouer pour une information que le systeme connait deja.
 */

export type RoleKey = "CLIENT" | "PROVIDER" | "INFLUENCER";

export const ROLE_OPTIONS: Array<{
  key: RoleKey;
  label: string;
  tagline: string;
  registerHref: string;
}> = [
  {
    key: "CLIENT",
    label: "Cliente",
    tagline: "Réserve ton prochain soin.",
    registerHref: "/register?role=CLIENT",
  },
  {
    key: "PROVIDER",
    label: "Salon",
    tagline: "Gère tes rendez-vous et ta caisse.",
    registerHref: "/register?role=PROVIDER",
  },
  {
    key: "INFLUENCER",
    label: "Influenceuse",
    tagline: "Monétise ton audience.",
    registerHref: "/register?role=INFLUENCER",
  },
];

export function RoleTabs({
  value,
  onChange,
}: {
  value: RoleKey;
  onChange: (next: RoleKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Je suis"
      className="flex gap-1 rounded-[var(--radius-pill)] bg-rose-soft p-1"
    >
      {ROLE_OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className={
              "ds-press ds-focus flex-1 min-h-[44px] px-3 " +
              "rounded-[var(--radius-pill)] text-sm font-semibold " +
              (active
                ? "bg-rose text-white"
                : "bg-transparent text-prune hover:bg-white/60")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint src/components/ui/role-tabs.tsx
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/ui/role-tabs.tsx
git commit -m "feat(design): selecteur de role

Oriente l'inscription, ne filtre pas la connexion : le role vient du
compte, pas d'un choix a l'ecran."
```

---

## Task 6 : Réécrire la page de connexion

**Files:**
- Modify: `src/app/(auth)/login/login-client.tsx`

La logique d'authentification (`handleSubmit`, `signIn`, `callbackUrl`) **ne
change pas**. Seuls la présentation et l'ajout du sélecteur changent.

- [ ] **Step 1 : Remplacer tout le contenu du fichier**

```tsx
"use client";

import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoleTabs, ROLE_OPTIONS, type RoleKey } from "@/components/ui/role-tabs";

export default function LoginClient() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-creme" />}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/api/auth/redirect";
  const [role, setRole] = useState<RoleKey>("CLIENT");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const current = ROLE_OPTIONS.find((o) => o.key === role) ?? ROLE_OPTIONS[0];

  // Inchange : signIn ne prend aucun role, la redirection se fait apres coup
  // selon session.user.role.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email ou mot de passe incorrect");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-creme flex flex-col items-center justify-center px-5 py-10 gap-8">
      <div className="flex flex-col items-center gap-3">
        <Link href="/" className="ds-display text-4xl text-prune">
          salonista<span className="text-rose">.</span>
        </Link>
        <p className="text-base text-prune-soft">{current.tagline}</p>
      </div>

      <div className="w-full max-w-[420px] rounded-[var(--radius-card)] bg-white p-6 sm:p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">
            Je suis
          </span>
          <RoleTabs value={role} onChange={setRole} />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-[var(--radius-panel)] bg-rose-soft px-4 py-3 text-sm text-prune"
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input
            id="email"
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="toi@exemple.com"
          />

          <Input
            id="password"
            label="Mot de passe"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                }
                className="ds-focus text-sm font-semibold text-prune-soft px-2 py-1 rounded-[var(--radius-pill)]"
              >
                {showPassword ? "Masquer" : "Voir"}
              </button>
            }
          />

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Connexion…" : "Se connecter"}
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-hairline" />
          <span className="text-sm text-prune-soft">ou</span>
          <span className="h-px flex-1 bg-hairline" />
        </div>

        <Button
          type="button"
          variant="ghost"
          fullWidth
          onClick={() => signIn("google", { callbackUrl })}
        >
          Continuer avec Google
        </Button>
      </div>

      <div className="flex flex-col items-center gap-2 text-sm">
        <Link href="/forgot-password" className="text-prune-soft underline underline-offset-4">
          Mot de passe oublié ?
        </Link>
        <p className="text-prune-soft">
          Pas encore de compte ?{" "}
          <Link href={current.registerHref} className="font-semibold text-rose">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier qu'aucun interdit ne subsiste**

```bash
grep -nE "shadow|gradient|blur" "src/app/(auth)/login/login-client.tsx" || echo "AUCUN interdit — correct"
```

Attendu : `AUCUN interdit — correct`. La page actuelle contenait
`bg-gradient-to-br` et deux `blur-3xl` ; ils doivent avoir disparu.

- [ ] **Step 3 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint "src/app/(auth)/login/login-client.tsx"
npm test
```

Attendu : seuls les deux fichiers pré-existants, ESLint silencieux, tests
inchangés.

- [ ] **Step 4 : Commit**

```bash
git add "src/app/(auth)/login/login-client.tsx"
git commit -m "feat(design): page de connexion refaite

Une seule mise en page adaptative au lieu de l'ecran scinde dont la moitie
gauche disparaissait sous lg. Plus de degrade ni de flou, interdits par le
design system."
```

---

## Task 7 : L'inscription lit le rôle de l'URL

**Files:**
- Modify: `src/app/(auth)/register/register-client.tsx`

Sans ça, l'onglet « Salon » mène à un formulaire où il faut re-sélectionner
« Prestataire » — une friction inutile.

- [ ] **Step 1 : Pré-sélectionner le rôle**

Le composant déclare `const [role, setRole] = useState("");` (autour de la ligne
40) et lit déjà `searchParams` juste au-dessus. Remplace cette ligne par :

```tsx
  // Pre-selection depuis /register?role=… (les onglets de la page de
  // connexion). Une valeur inconnue est ignoree : on retombe sur le
  // comportement actuel, l'utilisateur choisit lui-meme.
  const roleParam = searchParams.get("role");
  const [role, setRole] = useState(
    roleParam === "CLIENT" || roleParam === "PROVIDER" || roleParam === "INFLUENCER"
      ? roleParam
      : "",
  );
```

Les valeurs sont en **majuscules** — c'est ce que le tableau `roles` du fichier
utilise (`CLIENT`, `PROVIDER`, `INFLUENCER`).

- [ ] **Step 2 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint "src/app/(auth)/register/register-client.tsx"
```

- [ ] **Step 3 : Commit**

```bash
git add "src/app/(auth)/register/register-client.tsx"
git commit -m "feat(design): l'inscription accepte ?role= dans l'URL

Sans ca, l'onglet Salon menait a un formulaire ou il fallait re-choisir
Prestataire."
```

---

## Task 8 : Vérification

**Files:** aucun

Aucun test automatisé ne juge une page. Cette vérification est la seule qui
compte, et **une partie revient à l'utilisateur**.

- [ ] **Step 1 : Construire**

```bash
docker start design-db 2>/dev/null || docker run -d --name design-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=beaute_marketplace \
  -p 5433:5432 postgres:16
npx prisma migrate deploy
npm run build
```

Attendu : **build réussi**.

Si le build échoue sur `caniuse-lite` ou `jose` manquants :
`rm -rf node_modules && npm install`. Corruption connue, pas ton code.

- [ ] **Step 2 : Servir et contrôler le HTML**

```bash
npx next start -p 3510
```

Utilise un port peu commun : un serveur oublié sur 3000 ou 3100 servirait un
ancien build et fausserait tout.

- [ ] Les deux polices sont chargées :
      `curl -s http://localhost:3510/login | grep -oE "Bricolage|archivo" | sort -u`
      → les deux apparaissent.
- [ ] Aucun interdit sur la page :
      `curl -s http://localhost:3510/login | grep -cE "gradient-to|blur-3xl"` → `0`.
- [ ] La page répond : `curl -s -o /dev/null -w "%{http_code}" http://localhost:3510/login` → `200`.

- [ ] **Step 3 : Non-régression — le point qui protège la production**

- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:3510/` → `200`.
- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:3510/offres` → `200`.
- [ ] Les tokens `brand-*` et `pos-*` sont **toujours** dans `globals.css` :
      `grep -c "color-brand-\|color-pos-" src/app/globals.css` → un nombre > 20.

- [ ] **Step 4 : Contrôle visuel — c'est l'utilisateur qui tranche**

Ouvrir `http://localhost:3510/login` dans un navigateur et vérifier :

- [ ] Sur **mobile** (DevTools, iPhone SE 375px) : tout tient, rien ne déborde,
      les champs sont confortables au doigt.
- [ ] Sur **desktop** : la carte est centrée, ni étirée ni collée en haut.
- [ ] Les trois onglets basculent, l'accroche change à chaque fois.
- [ ] « Créer un compte » mène à `/register?role=…` avec le bon rôle
      **pré-sélectionné** dans le formulaire.
- [ ] Le bouton « Voir / Masquer » affiche bien le mot de passe.
- [ ] Une connexion réelle fonctionne toujours, et redirige selon le compte.
- [ ] Aucune ombre visible ; la carte se détache par sa couleur seule.

- [ ] **Step 5 : Nettoyer**

```bash
docker rm -f design-db
git status --short
```

Attendu : arbre propre.

---

## Task 9 : Pousser et préparer la pull request

**Files:** aucun

- [ ] **Step 1 : Vérification finale**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

- [ ] **Step 2 : Pousser**

```bash
git push -u origin design-lot1
```

- [ ] **Step 3 : Ouvrir la PR**

`gh` n'est pas installé. Après le push, GitHub affiche une URL
`https://github.com/eyaalimi/salonista/pull/new/design-lot1` — ouvre-la et
utilise ce corps :

```markdown
Premier lot de la refonte visuelle : les fondations du design system, et la page de connexion comme écran de référence.

## Le design system

Rose `#FF5C8A`, prune `#3A1024`, menthe `#A8E6CF`, crème `#FFF6F1`. Deux polices aux rôles stricts — **Bricolage Grotesque** pour les titres, **Archivo** pour l'interface — ce qui règle l'incohérence typographique signalée.

Tout ce qui est cliquable est une pill. **Aucune ombre** : la hiérarchie passe par la couleur. Survol = couleur seule, appui = 0.97, focus = anneau rose.

## La page de connexion

Une seule mise en page adaptative remplace l'écran scindé, dont la moitié gauche disparaissait sous `lg` — d'où le rendu médiocre sur mobile comme sur desktop. Le dégradé et les deux flous, interdits par le design system, ont disparu.

Un sélecteur à trois rôles (Cliente / Salon / Influenceuse) change l'accroche et la destination d'inscription.

**Ce qu'il ne fait pas, et pourquoi :** il ne filtre pas la connexion. `signIn("credentials")` ne prend aucun rôle et `/api/auth/redirect` oriente après coup selon `session.user.role`. Un filtre ajouterait une façon d'échouer pour une information que le système connaît déjà — une cliente cliquant sur « Salon » serait bloquée sans comprendre.

## Non-régression

**Aucun token `brand-*` ni `pos-*` n'est supprimé.** 142 fichiers en dépendent, dont la caisse en production. Les nouveaux tokens s'ajoutent à côté ; les anciens disparaîtront lot par lot.

Le feed, les fiches salon et la caisse sont inchangés.

## Vérification

`npm run build` réussi · `tsc --noEmit` (seules restent les erreurs pré-existantes) · `eslint` propre · aucun `gradient`/`blur`/`shadow` sur la page de connexion · `/` et `/offres` répondent toujours 200.

Contrôle visuel effectué sur mobile et desktop.

## Suite

Lot 2 : le feed d'accueil, avec les cartes salon de la maquette — badge menthe « LIBRE 14:00 », note en étoile, ligne « quartier · catégories · dès N TND ». Les primitifs `Chip`, `Card` et `Badge` y seront créés.
```

**Ne merge pas toi-même** — un push sur `main` déclenche le déploiement vers
Lightsail. Le merge est la décision du propriétaire.

---

## Notes de conception

**Pourquoi garder les anciens tokens ?** Les supprimer casserait 142 fichiers
d'un coup, dont la caisse que des salons pilotes utilisent en production. Un
design system se migre écran par écran ; le mélange est temporaire et visible
uniquement pour qui lit le CSS.

**Pourquoi trois primitifs et pas douze ?** Le brief en liste douze, mais la page
de connexion en emploie trois. Un `SlotPicker` que rien n'affiche serait du code
mort à maintenir. Les autres naîtront avec les écrans qui les utilisent.

**Pourquoi `.ds-focus` a-t-il un `box-shadow` alors que les ombres sont
interdites ?** Parce que c'est un anneau de focus, pas une élévation — et le
brief le demande explicitement. C'est la seule exception, et elle est commentée
dans le CSS.

**Pourquoi le corps des champs à 16px ?** En dessous, iOS zoome automatiquement
au focus et casse la mise en page. C'est aussi la règle du brief (« body text
≥ 16px »).
