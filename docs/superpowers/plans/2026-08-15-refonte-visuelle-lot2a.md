# Refonte visuelle lot 2a — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner le haut de l'accueil sur le design system et créer les trois primitifs `Chip`, `Badge` et `Card` que le reste du site réutilisera.

**Architecture:** Trois primitifs nouveaux dans `src/components/ui/`, un module pur testable pour la disponibilité (`salon-availability.ts`), puis le câblage dans `home-nav.tsx` et la moitié haute de `page.tsx`. Les requêtes de disponibilité et de note sont bornées aux salons affichés.

**Tech Stack:** Next.js 16.2 (App Router), Prisma 7, Tailwind v4, React 19, Vitest (environnement `node`).

**Spec:** [docs/superpowers/specs/2026-08-15-refonte-visuelle-lot2a-design.md](../specs/2026-08-15-refonte-visuelle-lot2a-design.md)

---

## Contexte pour l'ingénieur

**Salonista** est une marketplace beauté tunisienne. Les lots 1 et 1b ont installé
un design system et refait les pages de connexion et d'inscription, **toutes deux
validées par l'utilisateur et mergées dans `main`**.

L'accueil (`src/app/page.tsx`, 411 lignes, onze sections) garde l'ancienne charte
beige/doré. C'est la page que les visiteuses voient en premier, et celle dont
l'utilisateur a fourni une maquette.

**Ce lot ne traite que la moitié haute.** Le bas (bannière promo, « Salons près
de chez vous », CTA prestataire et influenceuse, FAQ, footer) reste pour le lot
2b : 411 lignes d'un coup produiraient un diff impossible à relire, et
incorrigible finement si le rendu déplaît.

**Neuf choses à savoir avant de toucher au code :**

1. **NE TOUCHE PAS aux trois blocs JSON-LD en bas de `page.tsx`** (`WebSite`,
   `Organization`, `FAQPage`). C'est le SEO livré la semaine dernière, et il
   fonctionne — le site est indexé grâce à lui.

2. **NE SUPPRIME AUCUN token `brand-*` ni `pos-*`.** 142 fichiers en dépendent,
   dont la caisse en production. Les sections non migrées de `page.tsx` les
   utilisent encore : c'est normal et temporaire.

3. **Le rail salon change de forme, pas seulement de style.** Aujourd'hui :
   vignettes carrées de 140px en défilement horizontal. La maquette montre des
   **cartes pleine largeur empilées verticalement**, bien plus grandes. C'est un
   changement de mise en page, pas un simple restylage.

4. **`home-nav.tsx` utilise `backdrop-blur-md`**, interdit par le design system
   (« no glass, no blur »). Il doit disparaître au profit d'un fond opaque.

5. **Les chips actuels sont des `<Link>`, pas des `<button>`.** Le primitif
   `Chip` doit donc pouvoir rendre un lien — sinon la navigation par catégorie
   casse.

6. **Deux données de la maquette n'existeront probablement pas à l'écran :**
   - le badge « LIBRE 14:00 » n'apparaît que si le salon a un créneau futur
     libre ; les salons de test n'en ont sans doute aucun ;
   - l'étoile n'apparaît que s'il y a au moins un avis ; il n'y en a aucun
     aujourd'hui.

   **C'est le comportement correct, pas une panne.** Ne « répare » pas leur
   absence en inventant des valeurs par défaut.

7. **Le champ « quartier » n'existe pas** dans `ProviderProfile` — seulement
   `address` (la rue) et `city`. La ligne de la maquette devient
   `{ville} · {catégories} · dès {N} TND`.

8. **Aucun test de composant n'est possible.** Vitest tourne en
   `environment: "node"` sans jsdom. Seule la Task 1 est en TDD, sur de la
   logique pure. Le reste : `tsc`, ESLint, `npm run build`, et le contrôle visuel
   de l'utilisateur.

9. **UI en français, tutoiement, sentence case.** Commentaires de code en
   français dans `src/lib/`.

**Le design system, en rappel :** tout ce qui est cliquable est une pill ;
**aucune ombre**, aucun dégradé, aucun flou ; survol = couleur seule ; appui
`scale(0.97)` ; focus = anneau rose (classes `.ds-press` et `.ds-focus`) ; une
seule action primaire rose par vue ; **menthe réservé** à la disponibilité, aux
économies, aux commissions et aux confirmations ; cibles tactiles ≥ 44px ; corps
≥ 16px.

**Tokens disponibles :** `rose`, `rose-soft`, `prune`, `prune-soft`, `menthe`,
`menthe-deep`, `creme`, `hairline`. Rayons `--radius-pill`, `--radius-card`
(36px), `--radius-panel` (22px).

**Primitifs déjà livrés :** `Button` (`variant`, `fullWidth`), `Input` (`label`,
`id`, `trailing`), `RoleTabs`.

**Commandes :**

```bash
npm run build         # verification principale
npx tsc --noEmit      # seul filet sur les types (le build ne type-check pas)
npm run lint
npm test
```

**Erreurs `tsc` pré-existantes :** deux fichiers,
`src/components/pos/onboarding/wizard-client.tsx` et
`src/lib/rewards/rewards.test.ts`. Vérifie qu'il ne s'en ajoute pas :

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
```

**Base requise pour le build :** `npm run build` prérend `/` et `/sitemap.xml`,
qui interrogent PostgreSQL :

```bash
docker run -d --name lot2a-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=beaute_marketplace -p 5433:5432 postgres:16
npx prisma migrate deploy
```

---

## Structure des fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/components/ui/chip.tsx` | Chip de catégorie (rend un `<Link>`) | **Créer** |
| `src/components/ui/badge.tsx` | Badge menthe (dispo) et rose (remise) | **Créer** |
| `src/components/ui/card.tsx` | Conteneur de carte, 36px, sans ombre | **Créer** |
| `src/lib/salon-availability.ts` | Choix et formatage du prochain créneau | **Créer** |
| `src/lib/salon-availability.test.ts` | Tests de la règle | **Créer** |
| `src/components/home-nav.tsx` | En-tête au nouveau style, sans flou | **Modifier** |
| `src/app/page.tsx` | Requêtes + moitié haute uniquement | **Modifier** |

---

## Task 0 : Créer la branche

**Files:** aucun

- [ ] **Step 1 : Vérifier que l'arbre est propre et à jour**

```bash
git status --short
git checkout main
git pull
```

- [ ] **Step 2 : Confirmer que les lots 1 et 1b sont bien dans `main`**

```bash
ls src/components/ui/
grep -c "color-rose\|color-prune\|color-creme" src/app/globals.css
grep -c "Salonista<span" "src/app/(auth)/login/login-client.tsx"
```

Attendu : `button.tsx`, `input.tsx`, `role-tabs.tsx` présents ; un compte > 0
pour les tokens ; et `1` pour le S majuscule. Si l'un manque, **arrête-toi** et
signale-le.

- [ ] **Step 3 : Créer la branche**

```bash
git checkout -b design-lot2a
```

---

## Task 1 : Le module de disponibilité (TDD)

**Pourquoi cette tâche existe.** Deux décisions doivent être exactes et sont
invisibles à l'œil : **quel** créneau retenir parmi tous ceux des offres d'un
salon, et **comment** le formater (« LIBRE 14:00 » aujourd'hui,
« LIBRE DEMAIN 9:00 » sinon). C'est aussi le seul morceau de ce lot que Vitest
puisse tester.

Précédents : `offer-publish.ts`, `booking-conflicts.ts`, `coords.ts`,
`salon-jsonld.ts`, `offer-jsonld.ts`. **Aucun import Prisma.**

**Files:**
- Create: `src/lib/salon-availability.ts`
- Create: `src/lib/salon-availability.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Crée `src/lib/salon-availability.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { pickNextSlot, formatAvailability } from "./salon-availability";

// Reference fixe pour que les tests ne dependent pas de l'heure reelle.
const MAINTENANT = new Date(2026, 7, 15, 10, 0, 0, 0); // samedi 15 aout, 10h00

describe("pickNextSlot", () => {
  it("retient le creneau futur le plus proche", () => {
    const slots = [
      { startTime: new Date(2026, 7, 15, 16, 0), capacity: 1, bookedCount: 0 },
      { startTime: new Date(2026, 7, 15, 14, 0), capacity: 1, bookedCount: 0 },
    ];
    expect(pickNextSlot(slots, MAINTENANT)?.getHours()).toBe(14);
  });

  it("ignore les creneaux passes", () => {
    const slots = [
      { startTime: new Date(2026, 7, 15, 8, 0), capacity: 1, bookedCount: 0 },
      { startTime: new Date(2026, 7, 15, 14, 0), capacity: 1, bookedCount: 0 },
    ];
    expect(pickNextSlot(slots, MAINTENANT)?.getHours()).toBe(14);
  });

  it("ignore les creneaux complets", () => {
    const slots = [
      { startTime: new Date(2026, 7, 15, 12, 0), capacity: 1, bookedCount: 1 },
      { startTime: new Date(2026, 7, 15, 14, 0), capacity: 1, bookedCount: 0 },
    ];
    expect(pickNextSlot(slots, MAINTENANT)?.getHours()).toBe(14);
  });

  it("accepte un creneau partiellement reserve", () => {
    const slots = [
      { startTime: new Date(2026, 7, 15, 12, 0), capacity: 3, bookedCount: 2 },
    ];
    expect(pickNextSlot(slots, MAINTENANT)?.getHours()).toBe(12);
  });

  it("renvoie null quand aucun creneau ne convient", () => {
    const slots = [
      { startTime: new Date(2026, 7, 15, 8, 0), capacity: 1, bookedCount: 0 },
    ];
    expect(pickNextSlot(slots, MAINTENANT)).toBeNull();
  });

  it("renvoie null sur une liste vide", () => {
    expect(pickNextSlot([], MAINTENANT)).toBeNull();
  });
});

describe("formatAvailability", () => {
  it("affiche l'heure seule quand c'est aujourd'hui", () => {
    const slot = new Date(2026, 7, 15, 14, 0);
    expect(formatAvailability(slot, MAINTENANT)).toBe("Libre 14:00");
  });

  it("prefixe DEMAIN quand c'est le lendemain", () => {
    const slot = new Date(2026, 7, 16, 9, 0);
    expect(formatAvailability(slot, MAINTENANT)).toBe("Libre demain 9:00");
  });

  it("affiche le jour de la semaine au-dela de demain", () => {
    // mardi 18 aout 2026
    const slot = new Date(2026, 7, 18, 11, 30);
    expect(formatAvailability(slot, MAINTENANT)).toBe("Libre mardi 11:30");
  });

  it("complete les minutes sur deux chiffres", () => {
    const slot = new Date(2026, 7, 15, 9, 5);
    expect(formatAvailability(slot, MAINTENANT)).toBe("Libre 9:05");
  });

  it("renvoie null pour un creneau absent", () => {
    expect(formatAvailability(null, MAINTENANT)).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
npx vitest run src/lib/salon-availability.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./salon-availability"`. Reporte le
message exact.

- [ ] **Step 3 : Écrire l'implémentation**

Crée `src/lib/salon-availability.ts` :

```ts
/**
 * Prochaine disponibilite d'un salon, pour le badge menthe du feed.
 *
 * Pas d'import Prisma ici — le module doit rester chargeable par vitest
 * (cf. src/lib/verify-authz.ts, meme contrainte).
 */

/** Creneau reduit a ce qui sert au calcul. */
export type SlotLike = {
  startTime: Date;
  capacity: number;
  bookedCount: number;
};

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/**
 * Le prochain creneau reellement reservable, ou null.
 *
 * « Reservable » veut dire : dans le futur ET avec de la capacite restante.
 * Un creneau complet n'interesse personne, et un creneau passe non plus.
 */
export function pickNextSlot(slots: SlotLike[], now: Date): Date | null {
  const futurs = slots
    .filter((s) => s.startTime.getTime() > now.getTime())
    .filter((s) => s.bookedCount < s.capacity)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return futurs.length > 0 ? futurs[0].startTime : null;
}

/** Meme jour calendaire ? (pas « moins de 24 h ») */
function memeJour(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Libelle du badge : « Libre 14:00 », « Libre demain 9:00 »,
 * « Libre mardi 11:30 ».
 *
 * On compare des jours calendaires, pas des ecarts en heures : un creneau a
 * 23h et un autre a 1h du matin sont a deux heures d'intervalle mais pas le
 * meme jour, et « demain » est ce que la cliente comprend.
 */
export function formatAvailability(slot: Date | null, now: Date): string | null {
  if (!slot) return null;

  const heure = `${slot.getHours()}:${String(slot.getMinutes()).padStart(2, "0")}`;

  if (memeJour(slot, now)) return `Libre ${heure}`;

  const demain = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (memeJour(slot, demain)) return `Libre demain ${heure}`;

  return `Libre ${JOURS[slot.getDay()]} ${heure}`;
}
```

- [ ] **Step 4 : Lancer le test — 11 passants attendus**

```bash
npx vitest run src/lib/salon-availability.test.ts
```

Attendu : PASS, **11 tests** (6 pour `pickNextSlot`, 5 pour
`formatAvailability`). Si le compte diffère, compte les blocs `it()` et signale
l'écart — n'invente pas de test pour atteindre un chiffre.

- [ ] **Step 5 : Lancer la suite complète**

```bash
npm test
```

Attendu : **180 tests** passants en 13 fichiers (169 + 11). Si le compte diffère,
arrête-toi et signale-le.

- [ ] **Step 6 : Vérifier et commiter**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint src/lib/salon-availability.ts src/lib/salon-availability.test.ts
git add src/lib/salon-availability.ts src/lib/salon-availability.test.ts
git commit -m "feat(design): prochaine disponibilite d'un salon, en fonction pure

Compare des jours calendaires et non des ecarts en heures : « demain » est
ce que la cliente comprend, meme si le creneau est dans deux heures."
```

---

## Task 2 : Les trois primitifs

**Files:**
- Create: `src/components/ui/chip.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/card.tsx`

- [ ] **Step 1 : Créer le Chip**

Les chips de l'accueil sont des `<Link>` de navigation, **pas** des boutons —
c'est pour ça que le composant rend un lien.

Crée `src/components/ui/chip.tsx` :

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Chip de categorie du feed.
 *
 * Rend un <Link> et non un <button> : ce sont des liens de navigation vers
 * /offres?category=…, et un bouton casserait l'ouverture dans un nouvel
 * onglet comme l'indexation.
 */
export function Chip({
  href,
  active = false,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "ds-press ds-focus shrink-0 inline-flex items-center gap-1.5 " +
        // 44px de cible tactile : la regle du design system.
        "min-h-[44px] px-4 rounded-[var(--radius-pill)] text-sm font-semibold " +
        (active
          ? "bg-rose text-white"
          : "bg-white text-prune border-2 border-hairline hover:border-rose")
      }
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 2 : Créer le Badge**

Crée `src/components/ui/badge.tsx` :

```tsx
import type { ReactNode } from "react";

/**
 * Pastille d'information.
 *
 * `menthe` est reserve a la disponibilite, aux economies, aux commissions et
 * aux confirmations — jamais a une action neutre ou destructrice.
 * `rose` sert aux remises.
 *
 * Le texte sur menthe utilise menthe-deep : le menthe pur n'a pas assez de
 * contraste pour etre lisible.
 */
export function Badge({
  tone = "menthe",
  children,
}: {
  tone?: "menthe" | "rose" | "prune";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    menthe: "bg-menthe text-menthe-deep",
    rose: "bg-rose text-white",
    prune: "bg-prune text-white",
  };

  return (
    <span
      className={
        "inline-flex items-center rounded-[var(--radius-pill)] px-3 py-1 " +
        "text-xs font-bold uppercase tracking-wide " +
        tones[tone]
      }
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 3 : Créer la Card**

Crée `src/components/ui/card.tsx` :

```tsx
import type { ReactNode } from "react";

/**
 * Conteneur de carte du design system.
 *
 * AUCUNE ombre : la carte se detache par sa couleur (blanc sur creme), pas
 * par une elevation. C'est la regle du design system, et elle vaut aussi
 * pour les cartes cliquables.
 */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[var(--radius-card)] bg-white ${className}`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint src/components/ui/chip.tsx src/components/ui/badge.tsx src/components/ui/card.tsx
grep -nE "shadow|gradient|blur" src/components/ui/*.tsx || echo "AUCUN interdit — correct"
```

Attendu : aucune erreur nouvelle, ESLint silencieux, `AUCUN interdit — correct`.

- [ ] **Step 5 : Commit**

```bash
git add src/components/ui/chip.tsx src/components/ui/badge.tsx src/components/ui/card.tsx
git commit -m "feat(design): primitifs Chip, Badge et Card

Chip rend un <Link> : les categories sont de la navigation, pas des
boutons. Badge reserve le menthe a la disponibilite."
```

---

## Task 3 : L'en-tête

**Files:**
- Modify: `src/components/home-nav.tsx`

Le fichier a déjà la structure de la maquette — wordmark à gauche, avatar à
droite. Deux problèmes : `backdrop-blur-md` est **interdit** par le design
system, et les couleurs sont celles de l'ancienne charte.

**Ne touche pas** à la logique de session (`useSession`, les trois états
`loading` / connecté / anonyme).

- [ ] **Step 1 : Remplacer la barre de navigation**

Remplace l'élément `<nav>` et sa `className` :

```tsx
    <nav className="fixed top-0 left-0 right-0 z-50 bg-creme border-b border-hairline">
```

Le `bg-white/95 backdrop-blur-md` disparaît : « no glass, no blur » est une règle
du design system. Un fond crème opaque le remplace.

- [ ] **Step 2 : Restyler les liens de bureau**

Remplace les deux liens « Offres » et « Salons » :

```tsx
          <Link
            href="/offres"
            className="ds-focus text-base text-prune-soft hover:text-rose rounded-[var(--radius-pill)] px-2 py-1"
          >
            Offres
          </Link>
          <a
            href="#salons"
            className="ds-focus text-base text-prune-soft hover:text-rose rounded-[var(--radius-pill)] px-2 py-1"
          >
            Salons
          </a>
```

- [ ] **Step 3 : Restyler l'état de chargement et le bouton Connexion**

Remplace le `<span>` de chargement :

```tsx
            <span className="block h-9 w-9 rounded-full bg-rose-soft animate-pulse" />
```

et le lien « Connexion » :

```tsx
            <Link
              href="/login"
              className="ds-press ds-focus inline-flex items-center min-h-[44px] px-4 rounded-[var(--radius-pill)] border-2 border-hairline text-base font-semibold text-prune hover:border-rose"
            >
              Connexion
            </Link>
```

- [ ] **Step 4 : Vérifier**

```bash
grep -nE "backdrop-blur|shadow|gradient" src/components/home-nav.tsx || echo "AUCUN interdit — correct"
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint src/components/home-nav.tsx
```

Attendu : `AUCUN interdit — correct`, aucune erreur nouvelle.

- [ ] **Step 5 : Commit**

```bash
git add src/components/home-nav.tsx
git commit -m "feat(design): en-tete au nouveau design system

backdrop-blur-md retire : « no glass, no blur » est une regle du design
system."
```

---

## Task 4 : Les requêtes de disponibilité et de note

**Pourquoi séparément.** Ce sont les seules modifications de **données** du lot.
Les isoler dans leur propre commit permet de les annuler sans défaire le style si
elles s'avéraient trop coûteuses.

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1 : Ajouter les imports**

En haut de `src/app/page.tsx`, à la suite des imports existants :

```tsx
import { Chip } from "@/components/ui/chip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { pickNextSlot, formatAvailability } from "@/lib/salon-availability";
```

- [ ] **Step 2 : Charger les créneaux avec les salons**

Dans le `Promise.all`, la requête `prisma.providerProfile.findMany` charge déjà
`_count` et une offre pour la photo. Remplace **tout** son bloc `include` par :

```tsx
      include: {
        _count: { select: { offers: true } },
        offers: {
          where: { active: true, photos: { isEmpty: false } },
          select: {
            photos: true,
            discountPrice: true,
            category: true,
            // Bornage volontaire : on ne remonte que les creneaux futurs, et
            // TimeSlot est indexe sur [offerId, startTime], donc ce filtre
            // utilise l'index. Sans borne, un salon actif remonterait des
            // milliers de lignes.
            slots: {
              where: { startTime: { gte: new Date() } },
              orderBy: { startTime: "asc" },
              take: 1,
              select: { startTime: true, capacity: true, bookedCount: true },
            },
            reviews: { select: { rating: true } },
          },
        },
      },
```

Note le `take: 1` **par offre** : on ne veut que le prochain créneau de chacune,
et `pickNextSlot` choisira le meilleur parmi ceux-là.

Retire aussi le `take: 1` qui limitait `offers` à une seule offre — on a
désormais besoin de toutes les offres publiées du salon pour calculer le prix
minimum et la note.

- [ ] **Step 3 : Calculer les données dérivées**

Après le `Promise.all` et **avant** le `return`, ajoute :

```tsx
  // Donnees derivees des salons, calculees une fois pour l'affichage.
  //
  // Le badge et l'etoile n'apparaissent que si la donnee existe reellement :
  // un salon sans creneau libre n'affiche pas de badge, un salon sans avis
  // n'affiche pas d'etoile. Aucune valeur par defaut inventee.
  const now = new Date();
  const salonExtras = new Map(
    topSalons.map((salon) => {
      const slots = salon.offers.flatMap((o) => o.slots);
      const ratings = salon.offers.flatMap((o) => o.reviews.map((r) => r.rating));
      const prices = salon.offers.map((o) => Number(o.discountPrice));

      return [
        salon.id,
        {
          availability: formatAvailability(pickNextSlot(slots, now), now),
          rating:
            ratings.length > 0
              ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
              : null,
          minPrice: prices.length > 0 ? Math.min(...prices) : null,
          categories: [...new Set(salon.offers.map((o) => categoryLabels[o.category]))]
            .filter(Boolean)
            .slice(0, 2),
        },
      ];
    }),
  );
```

- [ ] **Step 4 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npm test
```

Attendu : seuls les deux fichiers pré-existants ; 180 tests.

À ce stade `salonExtras` n'est pas encore utilisé — ESLint peut le signaler.
C'est normal, la Task 5 le consomme.

- [ ] **Step 5 : Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(design): disponibilite, note et prix minimum par salon

Requetes bornees aux salons affichés et aux creneaux futurs : TimeSlot
est indexe sur [offerId, startTime], le filtre utilise donc l'index."
```

---

## Task 5 : La moitié haute de la page

**Files:**
- Modify: `src/app/page.tsx`

**Ne touche qu'aux sections `SEARCH`, `CATEGORY CHIPS`, `OFFERS` et `SALONS`.**
Tout ce qui vient après (`SALONS NEAR YOU CTA`, `PRO CTA`, `FAQ`, `FOOTER`, et
surtout les trois blocs **JSON-LD**) reste **intact** — c'est le lot 2b.

- [ ] **Step 1 : Le conteneur racine**

Remplace la `className` du `<div>` racine :

```tsx
    <div className="min-h-screen bg-creme">
```

- [ ] **Step 2 : La recherche**

Remplace toute la section `{/* SEARCH … */}` par :

```tsx
      {/* SEARCH */}
      <section className="px-4 pt-4">
        <form action="/offres" method="GET" className="relative">
          <svg
            className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-prune-soft"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            name="q"
            placeholder="Salon, ville, prestation…"
            aria-label="Rechercher"
            className="ds-focus w-full min-h-[52px] rounded-[var(--radius-pill)] border-2 border-hairline bg-white pl-[52px] pr-5 text-base text-prune placeholder:text-prune-soft/60"
          />
        </form>
      </section>
```

Le `pl-[52px]` est une valeur arbitraire volontaire : il laisse exactement la
place de l'icône de recherche positionnée en absolu à `left-5`. `pl-13` n'existe
pas dans l'échelle Tailwind par défaut.

- [ ] **Step 3 : Les chips**

Remplace le contenu de la section `{/* CATEGORY CHIPS … */}` par :

```tsx
      {/* CATEGORY CHIPS */}
      {categoryData.length > 0 && (
        <section className="mt-5">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip href="/offres" active>
              Tout
            </Chip>
            {categoryData.map((cat) => (
              <Chip key={cat.key} href={`/offres?category=${cat.key}`}>
                {categoryEmoji[cat.key]} {cat.label}
              </Chip>
            ))}
          </div>
        </section>
      )}
```

- [ ] **Step 4 : Le rail d'offres**

Dans la section `{/* OFFERS … */}`, remplace le titre et le lien :

```tsx
          <div className="flex items-center justify-between px-4 mb-3">
            <h2 className="ds-display text-lg text-prune">Offres du jour</h2>
            <Link href="/offres" className="text-sm font-semibold text-rose">
              Voir tout
            </Link>
          </div>
```

Puis la carte de chaque offre — remplace le `<Link>` de la boucle et son contenu
par :

```tsx
                <Link
                  key={offer.id}
                  href={`/offre/${offer.id}`}
                  className="ds-press w-[170px] shrink-0"
                >
                  <Card>
                    <div className="relative h-[110px] w-full bg-rose-soft">
                      {offer.photos.length > 0 ? (
                        <UploadedImage
                          src={offer.photos[0]}
                          alt={offer.title}
                          fill
                          sizes="170px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl">
                          {categoryEmoji[offer.category]}
                        </div>
                      )}
                      {discount > 0 && (
                        <span className="absolute right-2 top-2">
                          <Badge tone="rose">-{discount}%</Badge>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 p-3">
                      <p className="line-clamp-1 text-xs text-prune-soft">
                        {offer.provider.salonName}
                        {offer.provider.city && ` · ${offer.provider.city}`}
                      </p>
                      <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-prune">
                        {offer.title}
                      </h3>
                      <div className="flex items-baseline gap-1.5 pt-1">
                        <span className="text-base font-bold text-rose">
                          {discounted.toFixed(0)} TND
                        </span>
                        {original > discounted && (
                          <span className="text-xs text-prune-soft line-through">
                            {original.toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
```

Note « TND » et non « DT » : c'est la notation de la maquette.

- [ ] **Step 5 : Le rail salon devient une pile de cartes**

C'est le changement de **mise en page**, pas seulement de style : les vignettes
carrées de 140px en défilement horizontal deviennent des cartes pleine largeur
empilées, comme dans la maquette.

Remplace toute la section `{/* SALONS … */}` par :

```tsx
      {/* SALONS */}
      {topSalons.length > 0 && (
        <section id="salons" className="mt-8 px-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="ds-display text-lg text-prune">Salons populaires</h2>
            <Link href="/offres" className="text-sm font-semibold text-rose">
              Voir tout
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            {topSalons.map((salon) => {
              const cover = salon.offers[0]?.photos[0];
              const extras = salonExtras.get(salon.id);

              return (
                <Link key={salon.id} href={`/salon/${salon.id}`} className="ds-press block">
                  <Card>
                    <div className="relative h-[180px] w-full bg-rose-soft">
                      {cover ? (
                        <UploadedImage
                          src={cover}
                          alt={salon.salonName}
                          fill
                          sizes="(max-width: 640px) 100vw, 420px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-5xl text-prune/30">
                          {salon.salonName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {/* Le badge n'apparait QUE si un creneau libre existe.
                          Sur des salons sans creneau, son absence est le
                          comportement correct. */}
                      {extras?.availability && (
                        <span className="absolute bottom-3 left-3">
                          <Badge tone="menthe">{extras.availability}</Badge>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="line-clamp-1 text-base font-bold text-prune">
                          {salon.salonName}
                        </h3>
                        {/* Idem : pas d'avis, pas d'etoile. */}
                        {extras?.rating !== null && extras?.rating !== undefined && (
                          <span className="shrink-0 text-sm text-prune-soft">
                            ★ {extras.rating.toFixed(1).replace(".", ",")}
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-1 text-sm text-prune-soft">
                        {[
                          salon.city || "Tunisie",
                          ...(extras?.categories ?? []),
                          extras?.minPrice != null ? `dès ${extras.minPrice.toFixed(0)} TND` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}
```

- [ ] **Step 6 : Vérifier qu'on n'a pas débordé sur le bas de page**

```bash
grep -c "application/ld+json" src/app/page.tsx
```

Attendu : **3** — les blocs `WebSite`, `Organization` et `FAQPage` sont intacts.
Si le compte a changé, tu as touché au SEO : rétablis-le.

```bash
grep -c "Questions fréquentes" src/app/page.tsx
```

Attendu : **1** — la FAQ est toujours là.

- [ ] **Step 7 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint src/app/page.tsx
npm test
```

Attendu : seuls les deux fichiers pré-existants, ESLint silencieux, 180 tests.

- [ ] **Step 8 : Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(design): haut du feed au nouveau design system

Le rail salon devient une pile de cartes pleine largeur, comme la
maquette — c'est un changement de mise en page, pas un restylage.
Le bas de page et les trois blocs JSON-LD restent intacts."
```

---

## Task 6 : Vérification

**Files:** aucun

- [ ] **Step 1 : Construire**

```bash
docker start lot2a-db 2>/dev/null || docker run -d --name lot2a-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=beaute_marketplace \
  -p 5433:5432 postgres:16
npx prisma migrate deploy
npm run build
```

Attendu : **build réussi**.

- [ ] **Step 2 : Servir et contrôler**

```bash
npx next start -p 3710
```

Port peu commun volontairement : un serveur oublié servirait un ancien build.

- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:3710/` → `200`.
- [ ] `curl -s http://localhost:3710/ | grep -cE "gradient-to|blur-3xl|backdrop-blur"` → `0`.
- [ ] `curl -s http://localhost:3710/ | grep -c "application/ld+json"` → `3`
      (le SEO est intact).
- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:3710/login` → `200`
      (non-régression des lots précédents).

- [ ] **Step 3 : Contrôle visuel — c'est l'utilisateur qui tranche**

Ouvrir `http://localhost:3710/` et vérifier :

- [ ] Sur **mobile** (DevTools, iPhone SE 375px) : l'en-tête, la recherche, les
      chips et les cartes salon tiennent sans débordement horizontal.
- [ ] Sur **desktop** : la mise en page reste lisible.
- [ ] Les chips défilent horizontalement et mènent aux bonnes catégories.
- [ ] Les cartes salon sont **empilées verticalement**, pleine largeur.
- [ ] **Le badge « Libre … » est probablement absent** — c'est correct s'il n'y a
      aucun créneau futur libre en base. Pour le voir, créer un créneau futur.
- [ ] **L'étoile est probablement absente** — correct s'il n'y a aucun avis.
- [ ] Aucune ombre visible ; les cartes se détachent par leur couleur.
- [ ] Le bas de page (CTA, FAQ, footer) est encore à l'ancienne charte — **c'est
      attendu**, c'est le lot 2b.

- [ ] **Step 4 : Nettoyer**

```bash
docker rm -f lot2a-db
git status --short
```

---

## Task 7 : Pousser et préparer la pull request

**Files:** aucun

- [ ] **Step 1 : Vérification finale**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

- [ ] **Step 2 : Pousser**

```bash
git push -u origin design-lot2a
```

- [ ] **Step 3 : Ouvrir la PR**

`gh` n'est pas installé. Après le push, GitHub affiche une URL
`https://github.com/eyaalimi/salonista/pull/new/design-lot2a` — utilise ce corps :

```markdown
Aligne le haut de l'accueil sur le design system, et crée les trois primitifs que le reste du site réutilisera.

## Ce qui change

- **Trois primitifs** : `Chip` (qui rend un `<Link>` — les catégories sont de la navigation), `Badge` (menthe pour la disponibilité, rose pour les remises), `Card` (36px, sans ombre).
- **Un module pur testé** (`salon-availability.ts`, 11 tests) : quel créneau retenir et comment le formater. Il compare des jours calendaires et non des écarts en heures — « demain » est ce que la cliente comprend.
- **L'en-tête** perd son `backdrop-blur-md`, interdit par le design system.
- **Le rail salon devient une pile de cartes pleine largeur**, comme la maquette. C'est un changement de mise en page, pas un restylage.

## Ce qu'il faut savoir avant de tester

**Le badge « Libre 14:00 » et l'étoile n'apparaîtront probablement pas.** Le badge exige un créneau futur libre, l'étoile au moins un avis — et la base n'en a ni l'un ni l'autre aujourd'hui. C'est le comportement voulu : aucune valeur inventée, aucun badge mensonger. Ils s'activeront seuls quand les données arriveront.

**Le « quartier » de la maquette n'existe pas** dans `ProviderProfile` — seulement `address` et `city`. La ligne affiche donc `{ville} · {catégories} · dès {N} TND`.

## Périmètre

Seule la moitié haute de l'accueil. Le bas (CTA, FAQ, footer) reste à l'ancienne charte pour le lot 2b : 411 lignes d'un coup auraient donné un diff impossible à relire.

**Les trois blocs JSON-LD sont intacts** — c'est le SEO grâce auquel le site est indexé.

## Vérification

`npm run build` réussi · `tsc --noEmit` (seules restent les erreurs pré-existantes) · `eslint` propre · `npm test` 180/180 · aucun `gradient`/`blur`/`shadow` sur la page · les 3 blocs JSON-LD présents.

Contrôle visuel sur mobile et desktop.
```

**Ne merge pas toi-même** — un push sur `main` déclenche le déploiement.

---

## Notes de conception

**Pourquoi `Chip` rend-il un `<Link>` et non un `<button>` ?** Les chips de
catégorie naviguent vers `/offres?category=…`. Un bouton casserait l'ouverture
dans un nouvel onglet, le clic milieu et l'indexation par les moteurs.

**Pourquoi comparer des jours calendaires dans `formatAvailability` ?** Un
créneau à 1h du matin est à deux heures d'un créneau à 23h, mais ce n'est pas le
même jour. « Demain » est ce que la cliente comprend, pas « dans 26 heures ».

**Pourquoi les requêtes sont-elles bornées ?** `TimeSlot` est indexé sur
`[offerId, startTime]`, pas sur le salon. Le filtre `startTime: { gte: now }` et
le `take: 1` par offre utilisent cet index ; sans eux, un salon actif remonterait
des milliers de créneaux à chaque chargement de l'accueil.

**Pourquoi aucune valeur par défaut pour le badge et l'étoile ?** Un badge
« Libre bientôt » sur un salon sans créneau serait un mensonge, et une note « 5,0 »
sans avis une tromperie. L'absence est la seule réponse honnête.
