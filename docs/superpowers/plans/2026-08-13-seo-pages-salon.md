# SEO des pages salon — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre chaque page salon correctement présentée dans Google et dans les partages : titre et description propres, présence au sitemap, balisage `LocalBusiness`.

**Architecture:** Un module pur `src/lib/salon-jsonld.ts` traduit un profil en objet Schema.org — testable, parce que la correspondance des jours (`mon` → `Monday`) est le seul endroit où une erreur passerait inaperçue. `page.tsx` gagne un `generateMetadata` calqué sur celui des offres et rend le balisage dans un `<script>` côté serveur. `sitemap.ts` liste les salons ayant au moins une offre publiée.

**Tech Stack:** Next.js 16.2 (App Router), Prisma 7, Vitest (environnement `node`), TypeScript.

**Spec:** [docs/superpowers/specs/2026-08-13-seo-pages-salon-design.md](../specs/2026-08-13-seo-pages-salon-design.md)

---

## Contexte pour l'ingénieur

**Salonista** est une marketplace beauté tunisienne (`salonista.tn`). Les clientes
consultent des fiches publiques `/salon/[id]` et `/offre/[id]` ; les salons gèrent
leur activité depuis une PWA de caisse (`/pos`).

**Le diagnostic qui a mené à ce lot.** `site:salonista.tn` renvoyait zéro
résultat : le site n'était indexé nulle part. Rien ne bloquait techniquement — le
domaine n'avait jamais été déclaré à Google. Search Console a été validé et le
sitemap soumis ; l'accueil est maintenant indexé. **Ce travail-là est fait, hors
code.** Ce plan traite ce qui reste et qui relève du code.

**Sept choses à savoir avant de toucher au code :**

1. **`page.tsx` charge le profil avec `include`, pas `select`.** Tous les champs
   sont donc déjà disponibles : `photos`, `address`, `phone`, `lat`, `lng`,
   `openingHours`. **Aucune requête à modifier** — vérifié.

2. **Le JSON-LD doit être rendu côté serveur.** `page.tsx` est un server
   component ; `salon-client.tsx` est un client component de ~600 lignes. Le
   balisage va dans `page.tsx`, sinon Google risque de ne pas le voir.

3. **`page.tsx` retourne `<SalonClient>` sans élément englobant.** Ajouter le
   `<script>` impose donc un fragment `<>…</>`.

4. **Vitest tourne en `environment: "node"`**, include `src/**/*.test.ts(x)`.
   **Ni jsdom ni @testing-library/react.** Seule la Task 1 est en TDD, sur de la
   logique pure. Le reste est vérifié par `tsc`, ESLint, le build et la
   checklist manuelle.

5. **`next.config.ts` porte `typescript: { ignoreBuildErrors: true }`.** Le build
   ne type-check pas : `npx tsc --noEmit` est le seul filet sur les types.

6. **L'UI est en français.** Titres, descriptions, commentaires de code.

7. **Les libellés de catégorie sont déjà dupliqués trois fois** dans le dépôt
   (`onboarding-presets.ts`, `service-edit-drawer.tsx`, `salon-form.tsx`), et la
   page publique affiche l'enum brut (`COIFFURE`). La Task 1 crée **une**
   fonction partagée ; n'en ajoute pas une quatrième copie.

**Commandes :**

```bash
npm test              # vitest run — 136 tests aujourd'hui
npx tsc --noEmit      # typecheck (seul filet, cf. point 5)
npm run lint          # ESLint
npm run build         # build de production
```

**Erreurs `tsc` pré-existantes :** deux fichiers,
`src/components/pos/onboarding/wizard-client.tsx` et
`src/lib/rewards/rewards.test.ts`. Pas les tiennes. Pour vérifier qu'il ne s'en
ajoute pas, liste les sources distinctes plutôt que de lire tout le flot :

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
```

Seuls ces deux chemins doivent apparaître.

**Attention build :** `npm run build` prérend `/` et `/sitemap.xml`, qui
interrogent la base. Sans PostgreSQL, il échoue sur `ECONNREFUSED localhost:5433`
**avant** d'atteindre tes pages, ce qui masquerait une vraie erreur. Voir la
Task 5 pour démarrer une base jetable.

---

## Structure des fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/lib/salon-jsonld.ts` | Profil → objet Schema.org + libellé de catégorie | **Créer** |
| `src/lib/salon-jsonld.test.ts` | Tests de la traduction | **Créer** |
| `src/app/salon/[id]/page.tsx` | `generateMetadata` + rendu du `<script>` | **Modifier** |
| `src/app/sitemap.ts` | Ajouter les pages salon | **Modifier** |

Un seul module nouveau. Il porte deux choses qui vont ensemble : la traduction
Schema.org et le libellé français de catégorie, tous deux dérivés du profil et
tous deux utilisés par `generateMetadata`.

---

## Task 0 : Créer la branche

**Files:** aucun

- [ ] **Step 1 : Vérifier que l'arbre est propre et à jour**

```bash
git status --short
git checkout main
git pull
```

Attendu : `git status --short` ne renvoie rien. Si l'arbre est sale, arrête-toi et
signale-le.

- [ ] **Step 2 : Créer la branche**

```bash
git checkout -b seo-salon
```

Attendu : `Switched to a new branch 'seo-salon'`

---

## Task 1 : Le module JSON-LD (TDD)

**Pourquoi cette tâche existe.** Schema.org attend `Monday`, on stocke `mon`. Une
correspondance décalée d'un jour annoncerait à Google que le salon ouvre le
dimanche — invisible à l'œil, détectable en trois lignes de test. C'est aussi le
seul morceau de ce lot que Vitest puisse tester (environnement `node`, pas de
jsdom).

Précédents dans le dépôt : `src/lib/offer-publish.ts`,
`src/lib/booking-conflicts.ts`, `src/lib/coords.ts`. **Aucun import Prisma** dans
ce module — il doit rester chargeable par Vitest.

**Files:**
- Create: `src/lib/salon-jsonld.ts`
- Create: `src/lib/salon-jsonld.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Crée `src/lib/salon-jsonld.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { buildSalonJsonLd, categoryLabel } from "./salon-jsonld";
import { emptyOpeningHours, type OpeningHours } from "./opening-hours";

const BASE = "https://salonista.tn";

const salonComplet = {
  id: "salon1",
  salonName: "Salon Amira",
  category: "COIFFURE",
  description: "Coiffure et soins a Tunis.",
  address: "12 rue de la Liberte",
  city: "Tunis",
  phone: "+21622000000",
  photos: ["/uploads/a.jpg", "/uploads/b.jpg"],
  lat: 36.8065,
  lng: 10.1815,
  openingHours: {
    ...emptyOpeningHours(),
    mon: [{ start: "09:00", end: "18:00" }],
  } as OpeningHours,
};

describe("categoryLabel", () => {
  it("traduit les six categories", () => {
    expect(categoryLabel("COIFFURE")).toBe("Coiffure");
    expect(categoryLabel("ESTHETIQUE")).toBe("Esthétique");
    expect(categoryLabel("ONGLERIE")).toBe("Onglerie");
    expect(categoryLabel("MASSAGE")).toBe("Massage");
    expect(categoryLabel("PARFUMERIE")).toBe("Parfumerie");
    expect(categoryLabel("AUTRE")).toBe("Autre");
  });

  it("renvoie la valeur brute pour une categorie inconnue", () => {
    expect(categoryLabel("NOUVEAU")).toBe("NOUVEAU");
  });
});

describe("buildSalonJsonLd", () => {
  it("produit un LocalBusiness avec le nom et l'URL", () => {
    const ld = buildSalonJsonLd(salonComplet, BASE);
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("LocalBusiness");
    expect(ld.name).toBe("Salon Amira");
    expect(ld.url).toBe(`${BASE}/salon/salon1`);
  });

  it("absolutise les photos", () => {
    const ld = buildSalonJsonLd(salonComplet, BASE);
    expect(ld.image).toEqual([`${BASE}/uploads/a.jpg`, `${BASE}/uploads/b.jpg`]);
  });

  it("emet l'adresse avec le code pays TN", () => {
    const ld = buildSalonJsonLd(salonComplet, BASE);
    expect(ld.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "12 rue de la Liberte",
      addressLocality: "Tunis",
      addressCountry: "TN",
    });
  });

  it("emet les coordonnees geographiques", () => {
    const ld = buildSalonJsonLd(salonComplet, BASE);
    expect(ld.geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: 36.8065,
      longitude: 10.1815,
    });
  });

  it("traduit lundi en Monday", () => {
    const ld = buildSalonJsonLd(salonComplet, BASE);
    expect(ld.openingHoursSpecification).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Monday",
        opens: "09:00",
        closes: "18:00",
      },
    ]);
  });

  it("traduit les sept jours dans le bon ordre", () => {
    const tousLesJours: OpeningHours = {
      mon: [{ start: "09:00", end: "10:00" }],
      tue: [{ start: "09:00", end: "10:00" }],
      wed: [{ start: "09:00", end: "10:00" }],
      thu: [{ start: "09:00", end: "10:00" }],
      fri: [{ start: "09:00", end: "10:00" }],
      sat: [{ start: "09:00", end: "10:00" }],
      sun: [{ start: "09:00", end: "10:00" }],
    };
    const ld = buildSalonJsonLd({ ...salonComplet, openingHours: tousLesJours }, BASE);
    expect(
      (ld.openingHoursSpecification as Array<{ dayOfWeek: string }>).map((s) => s.dayOfWeek),
    ).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
  });

  it("produit deux entrees pour un jour a deux plages (pause dejeuner)", () => {
    const avecPause: OpeningHours = {
      ...emptyOpeningHours(),
      mon: [
        { start: "09:00", end: "12:00" },
        { start: "14:00", end: "18:00" },
      ],
    };
    const ld = buildSalonJsonLd({ ...salonComplet, openingHours: avecPause }, BASE);
    expect(ld.openingHoursSpecification).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Monday",
        opens: "09:00",
        closes: "12:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Monday",
        opens: "14:00",
        closes: "18:00",
      },
    ]);
  });

  it("n'emet pas les champs absents", () => {
    const minimal = {
      id: "salon2",
      salonName: "Salon Minimal",
      category: "AUTRE",
      description: null,
      address: null,
      city: null,
      phone: null,
      photos: [],
      lat: null,
      lng: null,
      openingHours: null,
    };
    const ld = buildSalonJsonLd(minimal, BASE);
    expect(ld.name).toBe("Salon Minimal");
    expect(ld.address).toBeUndefined();
    expect(ld.geo).toBeUndefined();
    expect(ld.telephone).toBeUndefined();
    expect(ld.image).toBeUndefined();
    expect(ld.description).toBeUndefined();
    expect(ld.openingHoursSpecification).toBeUndefined();
  });

  it("emet l'adresse meme sans rue, si la ville est connue", () => {
    const ld = buildSalonJsonLd({ ...salonComplet, address: null }, BASE);
    expect(ld.address).toEqual({
      "@type": "PostalAddress",
      addressLocality: "Tunis",
      addressCountry: "TN",
    });
  });

  it("n'emet pas geo pour des coordonnees invalides", () => {
    // (0,0) est rejete par isValidCoords : Null Island, symptome d'un
    // parsing rate. Aucun salon tunisien ne s'y trouve.
    const ld = buildSalonJsonLd({ ...salonComplet, lat: 0, lng: 0 }, BASE);
    expect(ld.geo).toBeUndefined();
  });

  it("n'emet pas de plage horaire pour un jour ferme", () => {
    const fermeSaufMardi: OpeningHours = {
      ...emptyOpeningHours(),
      tue: [{ start: "09:00", end: "18:00" }],
    };
    const ld = buildSalonJsonLd({ ...salonComplet, openingHours: fermeSaufMardi }, BASE);
    expect(ld.openingHoursSpecification).toHaveLength(1);
    expect(
      (ld.openingHoursSpecification as Array<{ dayOfWeek: string }>)[0].dayOfWeek,
    ).toBe("Tuesday");
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
npx vitest run src/lib/salon-jsonld.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./salon-jsonld"`. Reporte le message
exact.

- [ ] **Step 3 : Écrire l'implémentation**

Crée `src/lib/salon-jsonld.ts` :

```ts
import { DAY_KEYS, type DayKey, type OpeningHours } from "@/lib/opening-hours";
import { isValidCoords } from "@/lib/coords";

/**
 * Traduction d'un profil salon vers Schema.org LocalBusiness.
 *
 * Pas d'import Prisma ici — le module doit rester chargeable par vitest
 * (cf. src/lib/verify-authz.ts, meme contrainte).
 */

/** Profil reduit a ce qui sert au balisage. */
export type SalonForJsonLd = {
  id: string;
  salonName: string;
  category: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  photos: string[];
  lat: number | null;
  lng: number | null;
  openingHours: OpeningHours | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  COIFFURE: "Coiffure",
  ESTHETIQUE: "Esthétique",
  ONGLERIE: "Onglerie",
  MASSAGE: "Massage",
  PARFUMERIE: "Parfumerie",
  AUTRE: "Autre",
};

/**
 * Libelle francais d'une categorie.
 *
 * Une categorie inconnue est renvoyee telle quelle plutot que remplacee par
 * "Autre" : si l'enum gagne une valeur, mieux vaut un libelle brut visible
 * qu'un mensonge silencieux.
 */
export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** Schema.org attend les jours en anglais ; on stocke des cles courtes. */
const DAY_SCHEMA: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

type OpeningSpec = {
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string;
  opens: string;
  closes: string;
};

/**
 * Objet JSON-LD LocalBusiness pour un salon.
 *
 * Chaque champ est conditionnel : un balisage qui decrit des donnees absentes
 * est penalise par Google, pas recompense. Un salon sans adresse n'emet pas
 * d'address vide.
 *
 * `baseUrl` sert a absolutiser les URLs : Schema.org veut des URLs completes,
 * or les photos sont stockees en chemins relatifs (/uploads/...).
 */
export function buildSalonJsonLd(
  salon: SalonForJsonLd,
  baseUrl: string,
): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: salon.salonName,
    url: `${baseUrl}/salon/${salon.id}`,
  };

  if (salon.description?.trim()) {
    ld.description = salon.description.trim();
  }

  if (salon.photos.length > 0) {
    ld.image = salon.photos.map((p) => (p.startsWith("http") ? p : `${baseUrl}${p}`));
  }

  if (salon.phone?.trim()) {
    ld.telephone = salon.phone.trim();
  }

  // La ville suffit a produire une adresse utile : un salon sans numero de rue
  // reste localisable, et Google accepte une PostalAddress partielle.
  if (salon.city?.trim() || salon.address?.trim()) {
    const addr: Record<string, string> = { "@type": "PostalAddress" };
    if (salon.address?.trim()) addr.streetAddress = salon.address.trim();
    if (salon.city?.trim()) addr.addressLocality = salon.city.trim();
    addr.addressCountry = "TN";
    ld.address = addr;
  }

  if (
    salon.lat !== null &&
    salon.lng !== null &&
    isValidCoords(salon.lat, salon.lng)
  ) {
    ld.geo = {
      "@type": "GeoCoordinates",
      latitude: salon.lat,
      longitude: salon.lng,
    };
  }

  if (salon.openingHours) {
    const specs: OpeningSpec[] = [];
    // DAY_KEYS garantit l'ordre lundi -> dimanche ; iterer sur les cles de
    // l'objet donnerait un ordre dependant de l'insertion.
    for (const day of DAY_KEYS) {
      for (const range of salon.openingHours[day] ?? []) {
        specs.push({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: DAY_SCHEMA[day],
          opens: range.start,
          closes: range.end,
        });
      }
    }
    if (specs.length > 0) {
      ld.openingHoursSpecification = specs;
    }
  }

  return ld;
}
```

- [ ] **Step 4 : Lancer le test — 13 passants attendus**

```bash
npx vitest run src/lib/salon-jsonld.test.ts
```

Attendu : PASS, **13 tests** (2 pour `categoryLabel`, 11 pour
`buildSalonJsonLd`). Si le compte diffère, compte les blocs `it()` du fichier et
signale l'écart plutôt que d'inventer un test.

- [ ] **Step 5 : Lancer la suite complète**

```bash
npm test
```

Attendu : **149 tests** passants en 10 fichiers (136 + 13). Si le compte diffère,
arrête-toi et signale-le ; ne « répare » pas d'autres tests.

- [ ] **Step 6 : Vérifier et commiter**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint src/lib/salon-jsonld.ts src/lib/salon-jsonld.test.ts
git add src/lib/salon-jsonld.ts src/lib/salon-jsonld.test.ts
git commit -m "feat(seo): traduction d'un salon en LocalBusiness Schema.org

Module pur teste : Schema.org attend Monday la ou on stocke mon, et un
decalage d'un jour annoncerait a Google que le salon ouvre le dimanche."
```

---

## Task 2 : Les métadonnées de la page salon

**Files:**
- Modify: `src/app/salon/[id]/page.tsx`

Le modèle est `generateMetadata` de `src/app/offre/[id]/page.tsx` — lis-le
d'abord, il fait exactement ce qu'on veut pour une offre.

- [ ] **Step 1 : Ajouter les imports**

En haut de `src/app/salon/[id]/page.tsx`, remplace le bloc d'imports par :

```tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SalonClient } from "./salon-client";
import { isValidOpeningHours, type OpeningHours } from "@/lib/opening-hours";
import { buildSalonJsonLd, categoryLabel } from "@/lib/salon-jsonld";
```

- [ ] **Step 2 : Ajouter `generateMetadata`**

Juste après l'interface `Props` et **avant** `export default async function
SalonPage`, insère :

```tsx
const BASE_URL = process.env.NEXTAUTH_URL || "https://salonista.tn";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const provider = await prisma.providerProfile.findUnique({
    where: { id },
    select: {
      salonName: true,
      category: true,
      description: true,
      city: true,
      address: true,
      photos: true,
      offers: {
        where: { active: true, publishedToMarketplace: true, photos: { isEmpty: false } } as never,
        select: { title: true },
        take: 3,
      },
    },
  });

  if (!provider) {
    return { title: "Salon introuvable" };
  }

  const cat = categoryLabel(provider.category);
  const titre = provider.city
    ? `${provider.salonName}, ${provider.city} — ${cat}`
    : `${provider.salonName} — ${cat}`;

  // Description du salon si elle existe ; sinon on la compose a partir des
  // faits (ville, services publies). On n'invente rien : une description
  // absente vaut mieux qu'une description fausse.
  const services = provider.offers.map((o) => o.title).join(", ");
  const description =
    provider.description?.trim() ||
    [
      `${provider.salonName}${provider.city ? ` à ${provider.city}` : ""}`,
      services ? ` : ${services}.` : ".",
      " Réservez en ligne sur Salonista.",
      provider.address ? ` ${provider.address}.` : "",
    ].join("");

  const image = provider.photos[0]
    ? `${BASE_URL}${provider.photos[0]}`
    : undefined;

  return {
    title: titre,
    description,
    alternates: { canonical: `${BASE_URL}/salon/${id}` },
    openGraph: {
      title: `${titre} | Salonista`,
      description,
      type: "website",
      url: `${BASE_URL}/salon/${id}`,
      ...(image ? { images: [image] } : {}),
    },
  };
}
```

Note le `alternates.canonical` : il évite qu'une même fiche indexée via des URLs
différentes (paramètres de tracking, par exemple) soit vue comme du contenu
dupliqué.

- [ ] **Step 3 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint "src/app/salon/[id]/page.tsx"
npm test
```

Attendu : seuls les deux fichiers pré-existants dans `tsc`, ESLint silencieux,
149 tests.

- [ ] **Step 4 : Commit**

```bash
git add "src/app/salon/[id]/page.tsx"
git commit -m "feat(seo): titre et description propres sur les pages salon

Sans ca, chaque salon s'affichait dans Google avec le titre generique
Salonista et la description de l'accueil."
```

---

## Task 3 : Rendre le JSON-LD dans la page

**Files:**
- Modify: `src/app/salon/[id]/page.tsx`

**Attention à la structure :** `SalonPage` retourne `<SalonClient …/>` sans
élément englobant. Ajouter le `<script>` impose donc un fragment.

- [ ] **Step 1 : Construire l'objet et l'insérer**

Dans `SalonPage`, après la ligne qui calcule `openingHours` et **avant** le
`return`, ajoute :

```tsx
  const jsonLd = buildSalonJsonLd(
    {
      id: provider.id,
      salonName: provider.salonName,
      category: provider.category,
      description: provider.description,
      address: provider.address,
      city: provider.city,
      phone: provider.phone,
      photos: provider.photos,
      lat: provider.lat,
      lng: provider.lng,
      openingHours,
    },
    BASE_URL,
  );
```

Puis transforme le `return` en fragment. Il commence par `return (` et
`<SalonClient` ; remplace **l'ouverture** :

```tsx
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SalonClient
```

et **la fermeture** — les trois dernières lignes du fichier, `    />`, `  );`,
`}` — par :

```tsx
      />
    </>
  );
}
```

Le `dangerouslySetInnerHTML` est la façon standard d'émettre du JSON-LD en
React ; c'est ce que fait déjà `src/app/page.tsx` pour les balisages `WebSite` et
`Organization`.

- [ ] **Step 2 : Vérifier que le JSON-LD est bien dans le HTML servi**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint "src/app/salon/[id]/page.tsx"
```

Attendu : aucune erreur nouvelle.

- [ ] **Step 3 : Commit**

```bash
git add "src/app/salon/[id]/page.tsx"
git commit -m "feat(seo): balisage LocalBusiness sur les pages salon"
```

---

## Task 4 : Les salons au sitemap

**Files:**
- Modify: `src/app/sitemap.ts`

Le sitemap ne contient aujourd'hui que les offres, avec un filtre strict. On
applique le miroir de ce filtre aux salons.

- [ ] **Step 1 : Ajouter la requête et les entrées**

Dans `src/app/sitemap.ts`, après le bloc `offerPages` et **avant** le `return`,
insère :

```ts
  // Meme exigence que pour les offres : une page sans contenu ne doit pas etre
  // annoncee a Google. Un salon sans offre publiee produirait une fiche quasi
  // vide, et faire decouvrir des pages vides sur un domaine neuf envoie
  // exactement le mauvais signal.
  const providers = await prisma.providerProfile.findMany({
    where: {
      offers: {
        some: {
          active: true,
          publishedToMarketplace: true,
          photos: { isEmpty: false },
        },
      },
    } as never,
    select: { id: true, createdAt: true },
  });

  const salonPages: MetadataRoute.Sitemap = providers.map((p) => ({
    url: `${baseUrl}/salon/${p.id}`,
    lastModified: p.createdAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
```

Puis remplace la ligne de retour :

```ts
  return [...staticPages, ...offerPages];
```

par :

```ts
  return [...staticPages, ...offerPages, ...salonPages];
```

- [ ] **Step 2 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint src/app/sitemap.ts
npm test
```

Attendu : aucune erreur nouvelle, 149 tests.

- [ ] **Step 3 : Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(seo): les pages salon entrent au sitemap

Filtre miroir de celui des offres : un salon sans offre publiee produirait
une fiche vide, mauvais signal sur un domaine neuf."
```

---

## Task 5 : Vérification sur base réelle

**Files:** aucun

- [ ] **Step 1 : Préparer une base et construire**

```bash
docker ps --format "{{.Names}} {{.Ports}}"
```

Si un conteneur occupe le port 3000 (souvent `users-service`), arrête-le. Puis :

```bash
docker run -d --name seo-check -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=beaute_marketplace -p 5433:5432 postgres:16
npx prisma migrate deploy
npm run build
```

Attendu : **build réussi**. Si le build échoue sur `caniuse-lite` ou `jose`
manquants : `rm -rf node_modules && npm install`, corruption connue.

- [ ] **Step 2 : Créer un salon avec du contenu**

Il te faut un salon avec au moins une offre publiée **avec photo**, une adresse,
une ville, un téléphone, des horaires et des coordonnées. Crée-le par
l'inscription prestataire puis `/pos/settings`, ou par un script `npx tsx`.

Crée aussi un **second salon sans aucune offre publiée** — il sert à vérifier
qu'il n'entre pas au sitemap.

- [ ] **Step 3 : Lancer le serveur et dérouler la checklist**

```bash
npm run dev
```

Toute ligne qui échoue = la tâche n'est pas finie.

- [ ] `curl -s http://localhost:3000/salon/<id> | grep -o "<title>[^<]*"` →
      affiche `{nom}, {ville} — {catégorie} — Salonista`. Le suffixe vient du
      `title.template` du layout racine (`src/app/layout.tsx:24`), commun à tout
      le site : c'est normal. Ce qui compte est que le titre ne soit **pas** le
      générique « Salonista » seul.
- [ ] `curl -s http://localhost:3000/salon/<id> | grep -o 'name="description"[^>]*'` →
      description spécifique au salon.
- [ ] `curl -s http://localhost:3000/salon/<id> | grep -c "application/ld+json"` →
      au moins 1.
- [ ] Extraire le JSON-LD et vérifier à l'œil qu'il contient `LocalBusiness`,
      `address` avec `addressCountry: "TN"`, `geo`, et
      `openingHoursSpecification` avec les jours **en anglais**.
- [ ] `curl -s http://localhost:3000/sitemap.xml | grep -c "/salon/"` → le nombre
      de salons **ayant une offre publiée**, et le salon sans offre **n'y est
      pas**.
- [ ] Salon sans adresse ni coordonnées → le JSON-LD ne contient ni `address` ni
      `geo`, et reste du JSON valide.

- [ ] **Step 4 : Le test qui compte — Rich Results de Google**

Ce test ne peut pas être automatisé et **il ne peut pas se faire en local** :
l'outil de Google doit accéder à l'URL publiquement.

Après le déploiement de cette branche, passer une URL de salon dans
[https://search.google.com/test/rich-results](https://search.google.com/test/rich-results).
Attendu : le balisage est reconnu, aucune erreur. Un JSON-LD syntaxiquement
valide peut être rejeté sémantiquement — c'est le seul moyen de le savoir.

Vérifier aussi le partage : coller une URL de salon dans WhatsApp et voir si le
titre et la photo remplacent le bloc générique Salonista.

- [ ] **Step 5 : Nettoyer**

```bash
docker rm -f seo-check
git status --short
```

Attendu : arbre propre, aucun fichier temporaire.

---

## Task 6 : Pousser et préparer la pull request

**Files:** aucun

- [ ] **Step 1 : Vérification finale**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

Attendu : 149 tests, aucune nouvelle erreur `tsc`, lint propre sur les fichiers
touchés, build réussi.

- [ ] **Step 2 : Pousser**

```bash
git push -u origin seo-salon
```

- [ ] **Step 3 : Ouvrir la PR**

`gh` n'est pas installé. Après le push, GitHub affiche une URL
`https://github.com/eyaalimi/salonista/pull/new/seo-salon` — ouvre-la et utilise
ce corps :

```markdown
Rend chaque page salon correctement présentée dans Google et dans les partages.

## Contexte

`site:salonista.tn` renvoyait zéro résultat : le site n'était indexé nulle part. Rien ne bloquait techniquement — le domaine n'avait jamais été déclaré à Google. **Search Console a été validé et le sitemap soumis ; l'accueil est maintenant indexé.** Ce travail-là était hors code. Cette PR traite ce qui restait.

## Changements

- **`generateMetadata` sur `/salon/[id]`** — titre `{nom}, {ville} — {catégorie}`, description issue du salon ou composée à partir des faits, Open Graph avec la première photo. Sans ça, chaque salon s'affichait dans Google avec le titre générique « Salonista » et la description de l'accueil, et un partage WhatsApp ne montrait qu'un bloc générique.
- **Balisage `LocalBusiness`** via un module pur testé (`src/lib/salon-jsonld.ts`, 13 tests). Chaque champ est conditionnel : pas d'adresse renseignée, pas de clé `address` — un balisage qui décrit des données absentes est pénalisé, pas récompensé.
- **Les pages salon entrent au sitemap**, avec le filtre miroir de celui des offres : au moins une offre publiée avec photo.
- **Un libellé de catégorie partagé** — les libellés étaient dupliqués trois fois dans le dépôt et la page publique affichait l'enum brut (`COIFFURE`).

## Le piège que les tests couvrent

Schema.org attend `Monday`, on stocke `mon`. Un décalage d'un jour annoncerait à Google que le salon ouvre le dimanche — invisible à l'œil. Les tests vérifient les sept jours dans l'ordre, les plages multiples (pause déjeuner), et les jours fermés.

## Non inclus, volontairement

- **`aggregateRating`** (les étoiles). Les avis sont attachés aux offres, pas aux salons, et Google exige que la note du balisage soit aussi affichée sur la page — ce qui n'est pas le cas. À ajouter quand il y aura du volume.
- **JSON-LD sur `/offre/[id]`** — chantier distinct, Google est strict sur les prix et la disponibilité.

## Ce que cette PR ne fait pas

Le SEO technique rend un site indexable, pas bien classé. Pour « coiffeur Tunis », ce qui décidera est l'ancienneté du domaine et **Google Business Profile** de chaque salon — gratuit, hors code.

## Vérification

`npm test` 149/149 · `tsc --noEmit` (seules restent les erreurs pré-existantes, dans deux fichiers non touchés) · `eslint` propre · `npm run build` réussi.

Checklist manuelle : titre et description servis dans le HTML, JSON-LD présent avec les jours en anglais, sitemap contenant les salons avec offres et pas les autres.

**À faire après déploiement :** passer une URL de salon dans le [Rich Results Test](https://search.google.com/test/rich-results) — l'outil doit accéder à l'URL publiquement, donc c'est impossible en local.
```

**Ne merge pas toi-même** — un push sur `main` déclenche le déploiement vers
Lightsail. Le merge est la décision du propriétaire.

---

## Notes de conception

**Pourquoi un module pur pour du JSON-LD ?** Parce que la correspondance des
jours est le seul endroit de ce lot où une erreur serait silencieuse. Un titre
mal formé se voit ; `mon` traduit en `Sunday` ne se voit pas, et annonce des
horaires faux à Google. C'est aussi le quatrième module de cette forme dans le
dépôt, après `offer-publish.ts`, `booking-conflicts.ts` et `coords.ts`.

**Pourquoi émettre l'adresse même sans numéro de rue ?** Un salon qui n'a
renseigné que sa ville reste localisable, et Google accepte une `PostalAddress`
partielle. Exiger les deux priverait de balisage les salons les moins complets,
qui en ont le plus besoin.

**Pourquoi `categoryLabel` renvoie la valeur brute pour une catégorie inconnue ?**
Si l'enum `Category` gagne une valeur et qu'on oublie ce fichier, un libellé brut
visible (`NOUVEAU`) est préférable à un « Autre » silencieux qui masquerait
l'oubli.

**Pourquoi itérer sur `DAY_KEYS` plutôt que sur les clés de l'objet ?** L'ordre
des clés d'un objet JavaScript dépend de l'insertion ; `DAY_KEYS` garantit
lundi → dimanche, ce que le test des sept jours vérifie.
