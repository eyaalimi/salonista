# Inscription autonome d'un salon — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour exécuter tâche par tâche. Les étapes
> utilisent des cases à cocher (`- [ ]`).

**But :** un salon qui découvre Salonista sur internet comprend la proposition,
s'inscrit seul, publie ses premières offres sans aide, et découvre la caisse
plus tard.

**Architecture :** trois ajouts indépendants. Une page publique `/pro`. Une
fonction pure qui calcule l'avancement du démarrage, plus la carte qui
l'affiche. Une page de demande d'activation de la caisse.

**Pile :** Next.js 16.2 (App Router, composants serveur), Prisma 7, React 19,
Tailwind v4.

**Spec :** `docs/superpowers/specs/2026-08-20-inscription-salon-autonome-design.md`

---

## À lire avant de commencer

### L'inscription autonome fonctionne déjà

Ne la « répare » pas : `/register` propose « Salon », `/api/register:59` crée le
`ProviderProfile`, et `getCurrentEmployee()` (`employee-session.ts:39`) crée le
compte propriétaire à la première visite. **Ce chantier n'ajoute que ce qui
manque autour** : un chemin pour y arriver, un guide une fois dedans, et une
porte vers la caisse.

### Ne touche pas à `/pos-start`

L'inscription commerciale est en production et fonctionne. Elle sert une autre
situation — un commercial dans le salon avec sa tablette. **Aucune tâche de ce
plan ne la modifie.**

### Un seul endroit est testable

Vitest tourne en `environment: "node"`, sans jsdom ni
`@testing-library/react` : **aucun composant React n'est testable ici, n'essaie
pas.** La tâche 1 ajoute de vrais tests sur la fonction qui calcule
l'avancement — c'est de la logique pure, et c'est là que se cachent les erreurs.

### Les repères chiffrés

| Contrôle | Valeur attendue | Commande |
|---|---|---|
| Erreurs `tsc` | **exactement 23** (préexistantes) | `npx tsc --noEmit 2>&1 \| grep -c "error TS"` |
| Problèmes ESLint | **51 au maximum** | `npm run lint` |
| Tests | **200 au vert**, plus ceux ajoutés | `npm test` |

**Les 23 erreurs `tsc` préexistent** (`wizard-client.tsx`, `rewards.test.ts`).
**Ne les corrige pas.** Le contrôle est que le total ne bouge pas.

`npm run build` **échoue au prérendu de `/` avec `ECONNREFUSED`** : la page
d'accueil interroge Postgres et aucune base ne tourne en local. `main` échoue
à l'identique. Ce qui compte est la ligne `✓ Compiled successfully`.

### Deux pièges repérés dans le code

**1. `onboardingDismissedAt` existe déjà** (`schema.prisma:221`). Aucune
migration n'est nécessaire — ne crée pas de champ en double.

**2. La page d'accueil de l'espace salon dépend du module.** Avec la caisse,
c'est `/pos` (l'encaissement) ; sans elle, `/pos` redirige vers
`/pos/calendar`. La carte du guide doit donc être posée **sur le calendrier**,
seul écran que les deux cas traversent.

---

## Structure des fichiers

| Fichier | Rôle | Tâche |
|---|---|---|
| `src/lib/onboarding-salon.ts` | **créé** — calcule les 3 étapes depuis les données | 1 |
| `src/lib/onboarding-salon.test.ts` | **créé** — tests de ce calcul | 1 |
| `src/components/pos/demarrage-card.tsx` | **créé** — la carte du guide | 2 |
| `src/app/(pos)/pos/calendar/page.tsx` | **modifié** — affiche la carte | 2 |
| `src/app/api/pos/onboarding/dismiss/route.ts` | **créé** — masquer le guide | 2 |
| `src/app/pro/page.tsx` | **créé** — page « Vous êtes un salon ? » | 3 |
| `src/app/page.tsx` | **modifié** — le CTA pointe vers `/pro` | 3 |
| `src/components/home-nav.tsx` | **modifié** — lien « Espace pro » | 3 |
| `src/app/(pos)/pos/caisse-offre/page.tsx` | **créé** — découvrir la caisse | 4 |
| `src/app/api/pos/caisse-interet/route.ts` | **créé** — enregistrer la demande | 4 |
| `src/components/pos/rail.tsx` | **modifié** — entrée « Activer la caisse » | 4 |

**Jamais touchés :** `/pos-start` et `src/app/api/pos/signup/route.ts`
(inscription commerciale, en production) ; `src/app/api/register/route.ts`
(fonctionne déjà) ; `src/lib/employee-session.ts` ; le schéma Prisma.

---

## Tâche 1 : le calcul de l'avancement, avec ses tests

**Pourquoi d'abord :** c'est le seul code testable du chantier, et celui qui
porte le raisonnement. Tout le reste n'est que de l'affichage.

**Files:**
- Créer : `src/lib/onboarding-salon.ts`
- Créer : `src/lib/onboarding-salon.test.ts`

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `src/lib/onboarding-salon.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { etapesDemarrage, demarrageTermine } from "./onboarding-salon";

const PROFIL_VIDE = {
  address: null,
  city: null,
  photos: [],
  openingHours: null,
};

const PROFIL_COMPLET = {
  address: "12 rue de Marseille",
  city: "Tunis",
  photos: ["/uploads/a.jpg"],
  openingHours: { mon: { open: "09:00", close: "18:00" } },
};

describe("etapesDemarrage", () => {
  it("ne coche rien pour un salon qui vient de s'inscrire", () => {
    const e = etapesDemarrage(PROFIL_VIDE, 0);
    expect(e.map((x) => x.faite)).toEqual([false, false, false]);
  });

  it("coche le profil quand adresse, ville et photo sont la", () => {
    const e = etapesDemarrage(PROFIL_COMPLET, 0);
    expect(e[0].faite).toBe(true);
  });

  it("ne coche pas le profil s'il manque la photo", () => {
    const e = etapesDemarrage({ ...PROFIL_COMPLET, photos: [] }, 0);
    expect(e[0].faite).toBe(false);
  });

  it("ne coche pas le profil s'il manque la ville", () => {
    const e = etapesDemarrage({ ...PROFIL_COMPLET, city: null }, 0);
    expect(e[0].faite).toBe(false);
  });

  it("ignore une adresse faite d'espaces", () => {
    const e = etapesDemarrage({ ...PROFIL_COMPLET, address: "   " }, 0);
    expect(e[0].faite).toBe(false);
  });

  it("coche les services des la premiere offre publiee", () => {
    const e = etapesDemarrage(PROFIL_VIDE, 1);
    expect(e[1].faite).toBe(true);
  });

  it("coche les horaires quand openingHours est renseigne", () => {
    const e = etapesDemarrage(PROFIL_COMPLET, 0);
    expect(e[2].faite).toBe(true);
  });

  it("ne coche pas les horaires sur un objet vide", () => {
    const e = etapesDemarrage({ ...PROFIL_COMPLET, openingHours: {} }, 0);
    expect(e[2].faite).toBe(false);
  });

  it("donne a chaque etape un titre et un lien", () => {
    for (const etape of etapesDemarrage(PROFIL_VIDE, 0)) {
      expect(etape.titre.length).toBeGreaterThan(0);
      expect(etape.href.startsWith("/pos/")).toBe(true);
    }
  });
});

describe("demarrageTermine", () => {
  it("est faux tant qu'une etape manque", () => {
    expect(demarrageTermine(PROFIL_COMPLET, 0)).toBe(false);
  });

  it("est vrai quand les trois etapes sont faites", () => {
    expect(demarrageTermine(PROFIL_COMPLET, 2)).toBe(true);
  });

  it("est vrai pour un salon deja installe avant le guide", () => {
    expect(demarrageTermine(PROFIL_COMPLET, 12)).toBe(true);
  });
});
```

- [ ] **Étape 2 : vérifier qu'il échoue**

```bash
npx vitest run src/lib/onboarding-salon.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./onboarding-salon"`.

- [ ] **Étape 3 : écrire l'implémentation**

Créer `src/lib/onboarding-salon.ts` :

```ts
/**
 * Avancement du demarrage d'un salon inscrit seul.
 *
 * Chaque etape est calculee depuis les DONNEES REELLES, jamais depuis un
 * drapeau pose a la main : un salon qui a rempli son profil avant de lire le
 * guide doit voir l'etape deja cochee. Un drapeau se desynchronise, une
 * donnee non.
 */

export type ProfilSalon = {
  address: string | null;
  city: string | null;
  photos: string[];
  openingHours: unknown;
};

export type EtapeDemarrage = {
  titre: string;
  aide: string;
  href: string;
  faite: boolean;
};

function rempli(valeur: string | null): boolean {
  return typeof valeur === "string" && valeur.trim().length > 0;
}

function horairesRenseignes(openingHours: unknown): boolean {
  if (!openingHours || typeof openingHours !== "object") return false;
  return Object.keys(openingHours as Record<string, unknown>).length > 0;
}

export function etapesDemarrage(
  profil: ProfilSalon,
  nombreOffres: number,
): EtapeDemarrage[] {
  return [
    {
      titre: "Complète ton profil",
      aide: "Ton adresse, ta ville et une photo : c'est ce que voient les clientes.",
      href: "/pos/settings",
      faite:
        rempli(profil.address) && rempli(profil.city) && profil.photos.length > 0,
    },
    {
      titre: "Ajoute ton premier service",
      aide: "Une coupe, un soin, un massage — avec son prix et sa durée.",
      href: "/pos/services",
      faite: nombreOffres > 0,
    },
    {
      // Sans horaires, aucun creneau n'est genere : le salon se croit en ligne
      // alors que personne ne peut reserver. C'est le piege le plus couteux du
      // parcours, d'ou sa presence comme etape a part entiere.
      titre: "Définis tes horaires",
      aide: "Sans eux, aucune cliente ne peut réserver.",
      href: "/pos/settings",
      faite: horairesRenseignes(profil.openingHours),
    },
  ];
}

export function demarrageTermine(
  profil: ProfilSalon,
  nombreOffres: number,
): boolean {
  return etapesDemarrage(profil, nombreOffres).every((e) => e.faite);
}
```

- [ ] **Étape 4 : vérifier que les tests passent**

```bash
npx vitest run src/lib/onboarding-salon.test.ts
```

Attendu : 12 tests au vert.

- [ ] **Étape 5 : vérifier les repères**

```bash
npm test 2>&1 | tail -5
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Attendu : tous les tests au vert (200 + 12) ; `tsc` à **exactement 23**.

- [ ] **Étape 6 : commit**

```bash
git add src/lib/onboarding-salon.ts src/lib/onboarding-salon.test.ts
git commit -m "feat(salon): calcul de l'avancement du demarrage"
```

---

## Tâche 2 : la carte de démarrage

**Files:**
- Créer : `src/components/pos/demarrage-card.tsx`
- Créer : `src/app/api/pos/onboarding/dismiss/route.ts`
- Modifier : `src/app/(pos)/pos/calendar/page.tsx`

- [ ] **Étape 1 : la route qui masque le guide**

Créer `src/app/api/pos/onboarding/dismiss/route.ts` :

```ts
import { requireEmployee, toResponse } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";

/**
 * Masque la carte de demarrage pour ce salon.
 *
 * `onboardingDismissedAt` existait deja dans le schema (schema.prisma:221) :
 * aucune migration n'est necessaire.
 */
export async function POST() {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  await prisma.providerProfile.update({
    where: { id: employee.providerId },
    data: { onboardingDismissedAt: new Date() } as never,
  });

  return Response.json({ ok: true });
}
```

- [ ] **Étape 2 : la carte**

Créer `src/components/pos/demarrage-card.tsx` :

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { EtapeDemarrage } from "@/lib/onboarding-salon";

/**
 * Guide de demarrage, affiche tant que les trois etapes ne sont pas faites.
 *
 * Sans lui, un salon inscrit seul reste devant un ecran de caisse sans savoir
 * par ou commencer — il s'inscrit et ne publie jamais rien.
 */
export function DemarrageCard({ etapes }: { etapes: EtapeDemarrage[] }) {
  const [masquee, setMasquee] = useState(false);
  if (masquee) return null;

  const faites = etapes.filter((e) => e.faite).length;

  async function masquer() {
    setMasquee(true);
    await fetch("/api/pos/onboarding/dismiss", { method: "POST" }).catch(() => {
      // Sans reseau la carte reste masquee pour cette visite seulement :
      // acceptable, et mieux que de la faire reapparaitre sous le doigt.
    });
  }

  return (
    <div className="m-4 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="ds-display text-lg text-prune">Bienvenue sur Salonista</h2>
          <p className="mt-1 text-sm text-prune-soft">
            Encore {3 - faites} étape{3 - faites > 1 ? "s" : ""} avant que les
            clientes puissent réserver chez toi.
          </p>
        </div>
        <button
          type="button"
          onClick={masquer}
          className="ds-focus shrink-0 text-sm text-prune-soft underline"
        >
          Masquer
        </button>
      </div>

      <ol className="mt-4 space-y-2">
        {etapes.map((etape) => (
          <li key={etape.titre}>
            <Link
              href={etape.href}
              className="ds-press ds-focus flex items-start gap-3 rounded-[var(--radius-panel)] border-2 border-hairline p-3 hover:border-rose"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  etape.faite ? "bg-menthe text-prune" : "bg-rose-soft text-prune"
                }`}
                aria-hidden="true"
              >
                {etape.faite ? "✓" : ""}
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold text-prune">
                  {etape.titre}
                  <span className="sr-only">{etape.faite ? " — fait" : " — à faire"}</span>
                </span>
                <span className="block text-sm text-prune-soft">{etape.aide}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Étape 3 : afficher la carte sur le calendrier**

**Pourquoi le calendrier :** c'est le seul écran que traversent les deux cas —
avec la caisse, l'accueil est `/pos` ; sans elle, `/pos` redirige ici.

Remplacer le corps de `src/app/(pos)/pos/calendar/page.tsx` par :

```tsx
import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { etapesDemarrage, demarrageTermine } from "@/lib/onboarding-salon";
import { DemarrageCard } from "@/components/pos/demarrage-card";
import { PosCalendarClient } from "./calendar-client";

export default async function PosCalendarPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["bookings.view"]) {
    return (
      <div className="p-6">
        <p className="text-sm text-pos-ink-3">Permission insuffisante.</p>
      </div>
    );
  }

  const profil = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
    select: {
      address: true,
      city: true,
      photos: true,
      openingHours: true,
      onboardingDismissedAt: true,
    },
  });

  const nombreOffres = await prisma.offer.count({
    where: { providerId: employee.providerId, publishedToMarketplace: true },
  });

  // La carte ne s'affiche ni pour un salon qui l'a masquee, ni pour un salon
  // deja installe : le calcul vient des donnees, donc un salon arrive avant
  // ce guide voit ses etapes deja cochees et la carte disparait d'elle-meme.
  const afficherGuide =
    profil !== null &&
    profil.onboardingDismissedAt === null &&
    !demarrageTermine(profil, nombreOffres);

  return (
    <>
      {afficherGuide && profil && (
        <DemarrageCard etapes={etapesDemarrage(profil, nombreOffres)} />
      )}
      <PosCalendarClient defaultEmployeeId={employee.id} />
    </>
  );
}
```

- [ ] **Étape 4 : vérifier les repères**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx tsc --noEmit 2>&1 | grep -E "demarrage-card|onboarding|calendar/page"
npm run lint 2>&1 | tail -3
npm test 2>&1 | tail -5
```

Attendu : **exactement 23** ; **aucune sortie** sur le second filtre ; ESLint
**≤ 51** ; tests au vert.

Si `tsc` se plaint du type de `openingHours` (Prisma renvoie `JsonValue`),
c'est attendu : `ProfilSalon.openingHours` est typé `unknown`, ce qui
l'accepte. N'ajoute ni `as never` ni `as any` pour contourner autre chose.

- [ ] **Étape 5 : commit**

```bash
git add src/components/pos/demarrage-card.tsx \
  src/app/api/pos/onboarding/dismiss/route.ts \
  "src/app/(pos)/pos/calendar/page.tsx"
git commit -m "feat(salon): carte de demarrage en trois etapes"
```

---

## Tâche 3 : la page « Vous êtes un salon ? »

**Files:**
- Créer : `src/app/pro/page.tsx`
- Modifier : `src/app/page.tsx` (le CTA prune, vers la ligne 353)
- Modifier : `src/components/home-nav.tsx`

- [ ] **Étape 1 : la page**

Créer `src/app/pro/page.tsx` :

```tsx
import Link from "next/link";
import { HomeNav } from "@/components/home-nav";

export const metadata = {
  title: "Votre salon sur Salonista — inscription gratuite",
  description:
    "Publiez vos offres, recevez des réservations en ligne et faites-vous découvrir par de nouvelles clientes. L'inscription est gratuite.",
};

const ETAPES = [
  {
    titre: "Créez votre compte",
    texte: "Quelques minutes, sans carte bancaire.",
  },
  {
    titre: "Publiez vos offres",
    texte: "Vos prestations, vos prix, vos horaires.",
  },
  {
    titre: "Recevez des réservations",
    texte: "Les clientes réservent et paient en ligne.",
  },
];

export default function ProPage() {
  return (
    <div className="min-h-screen bg-creme">
      <HomeNav />
      <div className="h-14 md:h-20" />

      <section className="mx-auto max-w-6xl px-4 pt-8">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">
          Espace professionnel
        </p>
        <h1 className="ds-display mt-2 text-3xl text-prune md:text-4xl">
          Faites découvrir votre salon
        </h1>
        <p className="mt-3 max-w-xl text-base text-prune-soft">
          Salonista met votre salon devant des clientes qui cherchent une
          coiffeuse, une esthéticienne ou un institut près de chez elles.
          L&apos;inscription est gratuite.
        </p>

        <Link
          href="/register?role=PROVIDER"
          className="ds-press ds-focus mt-6 inline-flex min-h-[52px] items-center rounded-[var(--radius-pill)] bg-rose px-8 text-base font-semibold text-prune"
        >
          Inscrire mon salon
        </Link>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4">
        <h2 className="ds-display text-xl text-prune">Comment ça marche</h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {ETAPES.map((etape, i) => (
            <li
              key={etape.titre}
              className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-soft text-sm font-bold text-prune">
                {i + 1}
              </span>
              <p className="mt-3 text-base font-semibold text-prune">{etape.titre}</p>
              <p className="mt-1 text-sm text-prune-soft">{etape.texte}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 pb-16">
        <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5 md:p-6">
          <h2 className="ds-display text-xl text-prune">Combien ça coûte</h2>
          <p className="mt-2 text-base text-prune-soft">
            Publier vos offres et recevoir des réservations est{" "}
            <span className="font-semibold text-prune">gratuit</span>.
          </p>
          <p className="mt-3 text-base text-prune-soft">
            Notre caisse — encaissement, stock, fidélité — est un module séparé,
            que vous pourrez activer depuis votre espace si elle vous intéresse.
            Rien ne vous y oblige.
          </p>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Étape 2 : le CTA de l'accueil pointe vers `/pro`**

Dans `src/app/page.tsx`, le premier lien de la section prune (vers la ligne
353) : remplacer `href="/register"` par `href="/pro"`.

**Pourquoi :** un salon a besoin de comprendre l'offre avant de créer un
compte. L'envoyer droit au formulaire lui demande de s'engager avant d'avoir lu
quoi que ce soit.

Vérifier qu'il s'agit bien du lien « Tu as un salon ? » et non du second lien
de la même section :

```bash
grep -n 'href="/pro"' src/app/page.tsx
sed -n '350,362p' src/app/page.tsx
```

- [ ] **Étape 3 : le lien dans la navigation**

Dans `src/components/home-nav.tsx`, après le lien « Offres » (vers la ligne
52), ajouter :

```tsx
          <Link
            href="/pro"
            className="ds-focus text-base text-prune-soft hover:text-rose rounded-[var(--radius-pill)] px-2 py-1"
          >
            Espace pro
          </Link>
```

- [ ] **Étape 4 : vérifier les repères**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx tsc --noEmit 2>&1 | grep -E "app/pro|home-nav|app/page"
npm run lint 2>&1 | tail -3
npm run build 2>&1 | grep -E "✓ Compiled|Failed to compile"
```

Attendu : **exactement 23** ; **aucune sortie** sur le second filtre ; ESLint
**≤ 51** ; `✓ Compiled successfully`.

Rappel : le build échoue ensuite au prérendu de `/` avec `ECONNREFUSED`, comme
sur `main`. Seule la ligne `✓ Compiled` compte.

- [ ] **Étape 5 : commit**

```bash
git add src/app/pro/page.tsx src/app/page.tsx src/components/home-nav.tsx
git commit -m "feat(pro): page d'atterrissage pour les salons"
```

---

## Tâche 4 : découvrir la caisse depuis son espace

**Files:**
- Créer : `src/app/(pos)/pos/caisse-offre/page.tsx`
- Créer : `src/app/api/pos/caisse-interet/route.ts`
- Modifier : `src/components/pos/rail.tsx`

- [ ] **Étape 1 : la route qui enregistre la demande**

Le modèle `FeatureInterest` existe déjà — vérifié dans le schéma :

```prisma
model FeatureInterest {
  id         String   @id @default(cuid())
  providerId String
  feature    String
  createdAt  DateTime @default(now())
  @@unique([providerId, feature])
}
```

**Il porte `@@unique([providerId, feature])`** : un salon qui clique deux fois
ferait échouer un `create`. On utilise donc `upsert`, qui absorbe le second
clic sans erreur.

Créer `src/app/api/pos/caisse-interet/route.ts` :

```ts
import { requireEmployee, toResponse } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";

/**
 * Enregistre l'interet d'un salon pour le module caisse.
 *
 * N'active RIEN : l'activation reste une decision commerciale, prise depuis
 * l'espace admin. Cette route ne fait que laisser une trace.
 */
export async function POST() {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  // `upsert` et non `create` : la contrainte @@unique([providerId, feature])
  // ferait echouer un second clic. Ici il ne se passe simplement rien.
  await prisma.featureInterest.upsert({
    where: {
      providerId_feature: { providerId: employee.providerId, feature: "POS" },
    },
    create: { providerId: employee.providerId, feature: "POS" },
    update: {},
  });

  return Response.json({ ok: true });
}
```

- [ ] **Étape 2 : la page**

Créer `src/app/(pos)/pos/caisse-offre/page.tsx`. Elle doit :

1. Récupérer l'employé (`getCurrentEmployee`), rediriger vers `/salon-pin` s'il
   est absent.
2. Si le module POS est **déjà actif** (`hasModule(providerId, "POS")`),
   rediriger vers `/pos` — inutile de vendre ce qui est déjà là.
3. Sinon afficher ce que la caisse apporte — encaisser, suivre le stock,
   fidéliser — et un bouton qui appelle `POST /api/pos/caisse-interet`, puis
   affiche « Nous vous recontactons ».

Reprends la mise en forme de la page `/pro` (tâche 3) : `ds-display` pour les
titres, cartes `border-2 border-hairline bg-white`, une seule action rose.

- [ ] **Étape 3 : l'entrée dans le rail**

Dans `src/components/pos/rail.tsx`, le groupe `groupLocked` contient déjà les
entrées « teaser » (`collab`, `store`) qui ignorent volontairement le filtre de
permission. Ajouter, **uniquement quand le module POS est absent** :

```tsx
    ...(activeModules.includes("POS")
      ? []
      : [
          {
            href: "/pos/caisse-offre",
            label: "Caisse",
            shortcut: "",
            icon: <Wallet size={20} />,
            locked: true,
          } as RailItem,
        ]),
```

**Ne remplace pas** les entrées existantes du groupe.

- [ ] **Étape 4 : vérifier les repères**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx tsc --noEmit 2>&1 | grep -E "caisse-offre|caisse-interet|rail"
npm run lint 2>&1 | tail -3
npm test 2>&1 | tail -5
```

Attendu : **exactement 23** ; **aucune sortie** sur le second filtre ; ESLint
**≤ 51** ; tests au vert.

- [ ] **Étape 5 : vérifier qu'un salon avec la caisse ne voit rien de neuf**

```bash
grep -n "activeModules.includes(\"POS\")" src/components/pos/rail.tsx
```

Attendu : l'entrée « Caisse » n'apparaît que dans la branche sans module.
C'est le contrôle de non-régression : un salon qui paie ne doit pas voir une
publicité pour ce qu'il a déjà.

- [ ] **Étape 6 : commit**

```bash
git add "src/app/(pos)/pos/caisse-offre/page.tsx" \
  src/app/api/pos/caisse-interet/route.ts \
  src/components/pos/rail.tsx
git commit -m "feat(pos): decouvrir et demander le module caisse"
```

---

## Tâche 5 : vérification d'ensemble

**Files:** aucun.

- [ ] **Étape 1 : les repères, une dernière fois**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -3
npm test 2>&1 | tail -5
npm run build 2>&1 | grep -E "✓ Compiled|Failed to compile"
```

Attendu : **23** ; **≤ 51** ; tests au vert ; `✓ Compiled successfully`.

- [ ] **Étape 2 : relire le diff**

```bash
git diff main --stat
```

Vérifier qu'aucun fichier hors du tableau « Structure des fichiers » n'apparaît
— en particulier **ni `pos-start`, ni `api/pos/signup`, ni `api/register`**.

- [ ] **Étape 3 : la liste du contrôle manuel**

Écrire dans le message de la PR :

```
Parcours d'un salon qui s'inscrit seul :
- [ ] /pro s'affiche et explique l'offre
- [ ] « Inscrire mon salon » mène au formulaire avec « Salon » présélectionné
- [ ] Après inscription, le guide s'affiche avec zéro étape cochée
- [ ] Remplir le profil coche la première étape
- [ ] Créer une offre la fait apparaître sur la marketplace publique
- [ ] Définir les horaires génère des créneaux, une cliente peut réserver
- [ ] Les trois étapes faites, la carte disparaît
- [ ] « Masquer » la fait disparaître et elle ne revient pas

Non-régression :
- [ ] Un salon inscrit via /pos-start ne voit AUCUN changement
- [ ] Un salon AVEC la caisse ne voit pas l'entrée « Activer la caisse »
- [ ] Un salon déjà installé (profil rempli, offres publiées) ne voit pas le guide
```

- [ ] **Étape 4 : pousser**

```bash
git push -u origin <branche>
```

`gh` n'est pas installé : ouvrir la PR depuis l'interface GitHub.

---

## Ce que ce plan ne fait pas

- **Il ne touche pas à `/pos-start`** ni à `api/pos/signup` : l'inscription
  commerciale est en production et fonctionne.
- **Il ne modifie pas `/api/register`** : l'inscription autonome fonctionne
  déjà.
- **Il n'active aucun module automatiquement.**
- **Il ne fusionne pas les deux inscriptions** : elles servent deux situations
  différentes.
- **Il ne corrige pas** les 23 erreurs `tsc` ni les 51 problèmes ESLint
  préexistants.
