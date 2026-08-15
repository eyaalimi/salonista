# SEO des pages service et contrôle d'indexation — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Baliser chaque page service en `Product` (prix, disponibilité, étoiles), poser les canoniques manquantes, et pouvoir sortir un salon de démonstration de l'index Google sans le supprimer.

**Architecture:** Un module pur `src/lib/offer-jsonld.ts` traduit une offre en objet Schema.org — testable, parce que le prix, la devise et la condition sur les avis sont exactement les endroits où une erreur passerait inaperçue et coûterait l'extrait enrichi. Un booléen `demo` sur `ProviderProfile` propage `noindex` au salon **et à ses offres**, et les retire du sitemap.

**Tech Stack:** Next.js 16.2 (App Router), Prisma 7 (**une migration**), Vitest (environnement `node`), TypeScript.

**Spec:** [docs/superpowers/specs/2026-08-15-seo-pages-service-design.md](../specs/2026-08-15-seo-pages-service-design.md)

---

## Contexte pour l'ingénieur

**Salonista** est une marketplace beauté tunisienne (`salonista.tn`), **en phase
de test** : aucun salon réel ne l'utilise encore. Les deux salons en ligne
(Fadwa Dhibi, Salon Ayou) sont des données de test.

Les pages publiques sont `/salon/[id]` (fiche salon) et `/offre/[id]` (fiche
service). Un lot précédent a livré `LocalBusiness`, les métadonnées et le sitemap
pour les salons. **Les pages offre n'ont aujourd'hui aucun balisage et aucune
canonique** — vérifié en production.

**Neuf choses à savoir avant de toucher au code :**

1. **Ce lot ajoute un champ en base**, donc **une migration Prisma**. C'est la
   première de cette série de lots. `npx prisma migrate dev --name …` en local,
   la migration est commitée, et `prisma migrate deploy` s'exécute au
   déploiement. **Ne jamais lancer `prisma migrate dev` contre la production.**

2. **`npm run db:push` existe mais ne doit PAS être utilisé ici** — il modifie le
   schéma sans créer de fichier de migration, et le déploiement n'aurait rien à
   appliquer.

3. **Le prix est `Decimal(10, 3)` en dinar tunisien** (3 décimales, millimes).
   Dans le JSON-LD, le prix part **en chaîne** (`"120.000"`), jamais en nombre :
   un flottant dériverait.

4. **Le prix balisé est `discountPrice`** (ce que la cliente paie), jamais
   `originalPrice`. Un écart entre le balisage et l'affichage est une violation
   Google qui coûte l'extrait enrichi.

5. **`aggregateRating` ne s'émet que s'il y a au moins un avis.** La page affiche
   les étoiles sous condition `reviews.length > 0` (`offer-client.tsx:272`) ; le
   balisage doit suivre la même condition. Une note de `0` sur zéro avis est une
   violation. Aujourd'hui aucune offre n'a d'avis.

6. **Vitest tourne en `environment: "node"`**, include `src/**/*.test.ts(x)`,
   **sans jsdom**. Seule la Task 2 est en TDD, sur de la logique pure ; le reste
   est vérifié par `tsc`, ESLint, le build et la checklist manuelle.

7. **`next.config.ts` porte `typescript: { ignoreBuildErrors: true }`** : le build
   ne type-check pas. `npx tsc --noEmit` est le seul filet sur les types.

8. **L'UI est en français**, commentaires de code compris dans `src/lib/`.

9. **La branche `seo-faq` est poussée mais pas mergée.** Ne t'appuie sur rien
   qu'elle contient ; pars de `main`.

**Commandes :**

```bash
npm test              # vitest run — 149 tests sur main
npx tsc --noEmit      # typecheck (seul filet, cf. point 7)
npm run lint          # ESLint
npm run build         # build de production
```

**Erreurs `tsc` pré-existantes :** deux fichiers,
`src/components/pos/onboarding/wizard-client.tsx` et
`src/lib/rewards/rewards.test.ts`. Pas les tiennes. Vérifie qu'il ne s'en ajoute
pas en listant les sources distinctes :

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
```

**ESLint :** une erreur pré-existante vit dans
`src/app/salon/[id]/salon-client.tsx` (`react-hooks/set-state-in-effect`).
Confirmée présente sur `main` non modifié. Ne la corrige pas.

**Attention build :** `npm run build` prérend `/` et `/sitemap.xml`, qui
interrogent la base. Sans PostgreSQL il échoue sur `ECONNREFUSED localhost:5433`
**avant** d'atteindre tes pages, ce qui masquerait une vraie erreur. Voir la
Task 1 pour démarrer une base jetable — tu en auras besoin dès la migration.

---

## Structure des fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `prisma/schema.prisma` | Champ `demo` sur `ProviderProfile` | **Modifier** |
| `prisma/migrations/<ts>_provider_demo/migration.sql` | Migration générée | **Créer** |
| `src/lib/offer-jsonld.ts` | Offre → `Product` Schema.org | **Créer** |
| `src/lib/offer-jsonld.test.ts` | Tests : prix, devise, disponibilité, avis | **Créer** |
| `src/app/offre/[id]/page.tsx` | Canonique, `robots`, rendu du `<script>` | **Modifier** |
| `src/app/salon/[id]/page.tsx` | `robots` si le salon est `demo` | **Modifier** |
| `src/app/sitemap.ts` | Exclure les salons `demo` et leurs offres | **Modifier** |

Un seul module nouveau. Il porte les décisions vérifiables ; le reste est du
câblage.

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
git checkout -b seo-service
```

Attendu : `Switched to a new branch 'seo-service'`

---

## Task 1 : Le champ `demo` et sa migration

**Pourquoi d'abord.** Les tâches suivantes lisent ce champ. Sans lui, le client
Prisma généré ne le connaît pas et `tsc` échoue partout.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_provider_demo/migration.sql` (généré)

- [ ] **Step 1 : Démarrer une base jetable**

`prisma migrate dev` a besoin d'une base réelle pour générer et appliquer la
migration.

```bash
docker run -d --name seo-service-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=beaute_marketplace -p 5433:5432 postgres:16
docker exec seo-service-db pg_isready -U postgres
npx prisma migrate deploy
```

Attendu : `All migrations have been successfully applied.` Le `DATABASE_URL` du
`.env` pointe déjà sur `localhost:5433`.

- [ ] **Step 2 : Ajouter le champ au schéma**

Dans `prisma/schema.prisma`, modèle `ProviderProfile`, ajoute le champ juste
après `verified` :

```prisma
  verified        Boolean  @default(false)
  /// Salon de demonstration : exclu de l'index Google (noindex + absent du
  /// sitemap) mais parfaitement consultable. Permet de garder des donnees de
  /// test en ligne sans polluer les resultats de recherche, et de les retirer
  /// le jour du lancement sans produire de 404.
  demo            Boolean  @default(false)
```

- [ ] **Step 3 : Générer la migration**

```bash
npx prisma migrate dev --name provider_demo
```

Attendu : un dossier `prisma/migrations/<timestamp>_provider_demo/` contenant un
`migration.sql`, et le client Prisma régénéré.

Vérifie le SQL produit :

```bash
cat prisma/migrations/*_provider_demo/migration.sql
```

Attendu — une seule instruction, avec un défaut, donc sans risque sur les lignes
existantes :

```sql
ALTER TABLE "ProviderProfile" ADD COLUMN "demo" BOOLEAN NOT NULL DEFAULT false;
```

Si le SQL contient autre chose (un `DROP`, une autre table), **arrête-toi et
signale-le** : le schéma aurait divergé.

- [ ] **Step 4 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npm test
```

Attendu : seuls les deux fichiers pré-existants, 149 tests passants.

- [ ] **Step 5 : Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(seo): champ demo pour exclure un salon de l'index

Permet de retirer les salons de demonstration des resultats Google le jour
du lancement sans les supprimer — donc sans produire de 404."
```

---

## Task 2 : Le module JSON-LD des offres (TDD)

**Pourquoi cette tâche existe.** Trois décisions doivent être exactes, et une
erreur sur chacune est invisible à l'œil mais coûte l'extrait enrichi :

- le prix balisé doit être celui **payé**, pas le prix barré ;
- le format doit rester une **chaîne à trois décimales** (le dinar a des
  millimes ; un flottant dériverait) ;
- `aggregateRating` ne doit **jamais** être émis sans avis — une note de `0` est
  une violation.

Précédents dans le dépôt : `src/lib/offer-publish.ts`,
`src/lib/booking-conflicts.ts`, `src/lib/coords.ts`, `src/lib/salon-jsonld.ts`.
**Aucun import Prisma** dans ce module.

**Files:**
- Create: `src/lib/offer-jsonld.ts`
- Create: `src/lib/offer-jsonld.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Crée `src/lib/offer-jsonld.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { buildOfferJsonLd, type OfferForJsonLd } from "./offer-jsonld";

const BASE = "https://salonista.tn";

const offreComplete: OfferForJsonLd = {
  id: "offre1",
  title: "Balayage / Mèches",
  description: "Balayage sur cheveux longs.",
  discountPrice: "120.000",
  originalPrice: "160.000",
  category: "COIFFURE",
  photos: ["/uploads/a.jpg"],
  salonName: "Salon Ayou",
  freeSlotCount: 12,
  reviewCount: 0,
  avgRating: 0,
};

describe("buildOfferJsonLd", () => {
  it("produit un Product avec le nom et la marque du salon", () => {
    const ld = buildOfferJsonLd(offreComplete, BASE);
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Product");
    expect(ld.name).toBe("Balayage / Mèches");
    expect(ld.brand).toEqual({ "@type": "Brand", name: "Salon Ayou" });
  });

  it("balise le prix PAYE, pas le prix barre", () => {
    const ld = buildOfferJsonLd(offreComplete, BASE);
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.price).toBe("120.000");
    expect(JSON.stringify(ld)).not.toContain("160.000");
  });

  it("transmet le prix en chaine, pas en nombre", () => {
    // Le dinar a 3 decimales : un flottant deriverait a l'affichage.
    const ld = buildOfferJsonLd(offreComplete, BASE);
    const offers = ld.offers as Record<string, unknown>;
    expect(typeof offers.price).toBe("string");
  });

  it("utilise la devise TND", () => {
    const ld = buildOfferJsonLd(offreComplete, BASE);
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.priceCurrency).toBe("TND");
  });

  it("annonce InStock quand il reste des creneaux", () => {
    const ld = buildOfferJsonLd(offreComplete, BASE);
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.availability).toBe("https://schema.org/InStock");
  });

  it("annonce OutOfStock sans creneau libre", () => {
    const ld = buildOfferJsonLd({ ...offreComplete, freeSlotCount: 0 }, BASE);
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("absolutise l'URL de l'offre et les photos", () => {
    const ld = buildOfferJsonLd(offreComplete, BASE);
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.url).toBe(`${BASE}/offre/offre1`);
    expect(ld.image).toEqual([`${BASE}/uploads/a.jpg`]);
  });

  it("traduit la categorie en libelle francais", () => {
    const ld = buildOfferJsonLd(offreComplete, BASE);
    expect(ld.category).toBe("Coiffure");
  });

  it("n'emet PAS aggregateRating sans avis", () => {
    // Une note de 0 sur zero avis est une violation des regles Google.
    const ld = buildOfferJsonLd(offreComplete, BASE);
    expect(ld.aggregateRating).toBeUndefined();
  });

  it("emet aggregateRating des qu'il y a un avis", () => {
    const ld = buildOfferJsonLd(
      { ...offreComplete, reviewCount: 3, avgRating: 4.5 },
      BASE,
    );
    expect(ld.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: "4.5",
      reviewCount: 3,
      bestRating: "5",
      worstRating: "1",
    });
  });

  it("n'emet pas les champs absents", () => {
    const minimal: OfferForJsonLd = {
      id: "offre2",
      title: "Coupe",
      description: null,
      discountPrice: "30.000",
      originalPrice: null,
      category: "AUTRE",
      photos: [],
      salonName: "Salon Minimal",
      freeSlotCount: 0,
      reviewCount: 0,
      avgRating: 0,
    };
    const ld = buildOfferJsonLd(minimal, BASE);
    expect(ld.description).toBeUndefined();
    expect(ld.image).toBeUndefined();
    expect(ld.aggregateRating).toBeUndefined();
    expect(ld.name).toBe("Coupe");
  });

  it("pose une date de validite du prix dans le futur", () => {
    const ld = buildOfferJsonLd(offreComplete, BASE);
    const offers = ld.offers as Record<string, unknown>;
    const validite = new Date(offers.priceValidUntil as string);
    expect(validite.getTime()).toBeGreaterThan(Date.now());
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
npx vitest run src/lib/offer-jsonld.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./offer-jsonld"`. Reporte le message
exact.

- [ ] **Step 3 : Écrire l'implémentation**

Crée `src/lib/offer-jsonld.ts` :

```ts
/**
 * Traduction d'une offre en Product Schema.org.
 *
 * Pas d'import Prisma ici — le module doit rester chargeable par vitest
 * (cf. src/lib/verify-authz.ts, meme contrainte).
 */

/** Offre reduite a ce qui sert au balisage. */
export type OfferForJsonLd = {
  id: string;
  title: string;
  description: string | null;
  /** Prix reellement paye, en chaine a 3 decimales. */
  discountPrice: string;
  originalPrice: string | null;
  category: string;
  photos: string[];
  salonName: string;
  /** Nombre de creneaux futurs encore libres. */
  freeSlotCount: number;
  reviewCount: number;
  avgRating: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  COIFFURE: "Coiffure",
  ESTHETIQUE: "Esthétique",
  ONGLERIE: "Onglerie",
  MASSAGE: "Massage",
  PARFUMERIE: "Parfumerie",
  AUTRE: "Autre",
};

/** Fenetre de generation des creneaux, en jours. */
const SLOT_WINDOW_DAYS = 30;

/**
 * Objet JSON-LD Product pour une offre.
 *
 * Le prix balise est celui que la cliente PAIE (discountPrice), jamais le prix
 * barre : Google compare le balisage a ce que la page affiche, et un ecart
 * coute l'extrait enrichi.
 *
 * Le prix reste une CHAINE : le dinar tunisien a 3 decimales (millimes), et un
 * flottant deriverait.
 */
export function buildOfferJsonLd(
  offer: OfferForJsonLd,
  baseUrl: string,
): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: offer.title,
    category: CATEGORY_LABELS[offer.category] ?? offer.category,
    brand: { "@type": "Brand", name: offer.salonName },
  };

  if (offer.description?.trim()) {
    ld.description = offer.description.trim();
  }

  if (offer.photos.length > 0) {
    ld.image = offer.photos.map((p) => (p.startsWith("http") ? p : `${baseUrl}${p}`));
  }

  // priceValidUntil : sans ce champ, Google finit par considerer le prix comme
  // perime et cesse de l'afficher. On l'aligne sur la fenetre des creneaux.
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + SLOT_WINDOW_DAYS);

  ld.offers = {
    "@type": "Offer",
    price: offer.discountPrice,
    priceCurrency: "TND",
    availability:
      offer.freeSlotCount > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    url: `${baseUrl}/offre/${offer.id}`,
    priceValidUntil: validUntil.toISOString().slice(0, 10),
    seller: { "@type": "LocalBusiness", name: offer.salonName },
  };

  // aggregateRating UNIQUEMENT s'il y a au moins un avis : une note de 0 sur
  // zero avis est une violation. La page affiche les etoiles sous la meme
  // condition (reviews.length > 0), donc balisage et affichage restent
  // alignes par construction.
  if (offer.reviewCount > 0) {
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: String(offer.avgRating),
      reviewCount: offer.reviewCount,
      bestRating: "5",
      worstRating: "1",
    };
  }

  return ld;
}
```

- [ ] **Step 4 : Lancer le test — 12 passants attendus**

```bash
npx vitest run src/lib/offer-jsonld.test.ts
```

Attendu : PASS, **12 tests**. Si le compte diffère, compte les blocs `it()` du
fichier et signale l'écart — n'invente pas de test pour atteindre un chiffre.

- [ ] **Step 5 : Lancer la suite complète**

```bash
npm test
```

Attendu : **161 tests** passants en 11 fichiers (149 + 12). Si le compte diffère,
arrête-toi et signale-le.

- [ ] **Step 6 : Vérifier et commiter**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint src/lib/offer-jsonld.ts src/lib/offer-jsonld.test.ts
git add src/lib/offer-jsonld.ts src/lib/offer-jsonld.test.ts
git commit -m "feat(seo): traduction d'une offre en Product Schema.org

Prix paye et non barre, en chaine a 3 decimales (le dinar a des millimes),
et aggregateRating seulement s'il existe au moins un avis — une note de 0
serait une violation."
```

---

## Task 3 : Câbler le balisage et la canonique sur la page offre

**Files:**
- Modify: `src/app/offre/[id]/page.tsx`

Trois choses en même temps, parce qu'elles touchent le même fichier : la
canonique (absente aujourd'hui), le `robots` conditionnel au `demo` du salon, et
le rendu du `<script>`.

**Contexte du fichier :** `OffrePage` charge déjà l'offre avec ses `slots`
futurs, calcule `avgRating` depuis les avis, et retourne `<OfferClient …/>` sans
élément englobant. Le `<script>` impose donc un fragment.

- [ ] **Step 1 : Ajouter les imports et la constante**

En haut de `src/app/offre/[id]/page.tsx`, ajoute à la suite des imports
existants :

```tsx
import { buildOfferJsonLd } from "@/lib/offer-jsonld";
```

Puis, juste avant `export async function generateMetadata`, ajoute :

```tsx
const BASE_URL = process.env.NEXTAUTH_URL || "https://salonista.tn";
```

- [ ] **Step 2 : Charger le champ `demo` dans `generateMetadata`**

Dans `generateMetadata`, le `include` du provider sélectionne déjà
`salonName` et `city`. Ajoute `demo` :

```tsx
    include: { provider: { select: { salonName: true, city: true, demo: true } } },
```

- [ ] **Step 3 : Ajouter la canonique et le `robots` au retour de `generateMetadata`**

Le `return` de `generateMetadata` se termine par le bloc `openGraph`. Ajoute deux
clés à l'objet retourné, après `description` :

```tsx
    alternates: { canonical: `${BASE_URL}/offre/${id}` },
    // Un salon de demonstration ne doit pas polluer l'index : ses offres
    // sortent des resultats avec lui.
    ...(offer.provider.demo ? { robots: { index: false, follow: false } } : {}),
```

La canonique compte : les liens de tracking des influenceuses
(`/offre/<id>?ref=abc`) sont sinon vus par Google comme des pages distinctes —
du contenu dupliqué qui dilue le référencement de la vraie page.

- [ ] **Step 4 : Charger `demo` dans la requête de la page**

Dans `OffrePage`, le `include` du provider sélectionne
`{ id, salonName, city, category, description }`. Ajoute `demo` :

```tsx
      provider: {
        select: {
          id: true,
          salonName: true,
          city: true,
          category: true,
          description: true,
          demo: true,
        },
      },
```

- [ ] **Step 5 : Construire l'objet JSON-LD**

Dans `OffrePage`, juste après le calcul de `avgRating` et **avant** le `return`,
ajoute :

```tsx
  // Un creneau est libre s'il reste de la capacite. La requete ne charge que
  // les creneaux futurs (startTime >= maintenant).
  const freeSlotCount = offer.slots.filter((s) => s.bookedCount < s.capacity).length;

  const jsonLd = buildOfferJsonLd(
    {
      id: offer.id,
      title: offer.title,
      description: offer.description,
      discountPrice: offer.discountPrice.toString(),
      originalPrice: offer.originalPrice ? offer.originalPrice.toString() : null,
      category: offer.category,
      photos: offer.photos,
      salonName: offer.provider.salonName,
      freeSlotCount,
      reviewCount: reviews.length,
      avgRating,
    },
    BASE_URL,
  );
```

Note `.toString()` sur les prix : ce sont des `Decimal` Prisma, et leur
`toString()` préserve les trois décimales — contrairement à `Number()`.

- [ ] **Step 6 : Rendre le `<script>` dans un fragment**

`OffrePage` retourne `<OfferClient …/>` sans élément englobant. Remplace
l'ouverture du `return` :

```tsx
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <OfferClient
```

et la fermeture — les trois dernières lignes du fichier, `    />`, `  );`, `}` —
par :

```tsx
      />
    </>
  );
}
```

- [ ] **Step 7 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint "src/app/offre/[id]/page.tsx"
npm test
```

Attendu : seuls les deux fichiers pré-existants dans `tsc`, ESLint silencieux,
161 tests.

- [ ] **Step 8 : Commit**

```bash
git add "src/app/offre/[id]/page.tsx"
git commit -m "feat(seo): balisage Product et canonique sur les pages service

La canonique manquait : les liens de tracking ?ref= etaient vus comme des
pages distinctes, du contenu duplique qui diluait chaque service."
```

---

## Task 4 : Propager `demo` au salon et au sitemap

**Files:**
- Modify: `src/app/salon/[id]/page.tsx`
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1 : Charger `demo` dans `generateMetadata` du salon**

Dans `src/app/salon/[id]/page.tsx`, `generateMetadata` fait un `select` qui liste
`salonName`, `category`, `description`, `city`, `address`, `photos`, `offers`.
Ajoute `demo: true` à ce `select`.

- [ ] **Step 2 : Ajouter le `robots` au retour**

Dans l'objet retourné par `generateMetadata` du salon, après la ligne
`alternates: { canonical: ... },`, ajoute :

```tsx
    ...(provider.demo ? { robots: { index: false, follow: false } } : {}),
```

- [ ] **Step 3 : Exclure les salons `demo` du sitemap**

Dans `src/app/sitemap.ts`, la requête `providers` filtre sur les salons ayant au
moins une offre publiée. Ajoute la condition `demo: false` au `where` :

```ts
  const providers = await prisma.providerProfile.findMany({
    where: {
      demo: false,
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
```

- [ ] **Step 4 : Exclure leurs offres du sitemap**

Toujours dans `src/app/sitemap.ts`, la requête `offers` filtre sur
`{ active, publishedToMarketplace, photos }`. Ajoute la contrainte sur le salon
propriétaire :

```ts
  const offers = await prisma.offer.findMany({
    where: {
      active: true,
      publishedToMarketplace: true,
      photos: { isEmpty: false },
      // Les offres d'un salon de demonstration sortent de l'index avec lui :
      // sinon elles resteraient dans Google alors que leur salon en est parti.
      provider: { demo: false },
    } as never,
    select: { id: true, createdAt: true },
  });
```

- [ ] **Step 5 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint "src/app/salon/[id]/page.tsx" src/app/sitemap.ts
npm test
npm run build
```

Attendu : seuls les deux fichiers pré-existants, ESLint silencieux sur ces deux
fichiers, 161 tests, **build réussi**.

Si le build échoue sur `ECONNREFUSED localhost:5433`, c'est que le conteneur de
la Task 1 n'est plus démarré : `docker start seo-service-db`.

- [ ] **Step 6 : Commit**

```bash
git add "src/app/salon/[id]/page.tsx" src/app/sitemap.ts
git commit -m "feat(seo): un salon demo et ses offres quittent l'index

Marquer le salon seul aurait laisse ses pages offre dans Google — la
demi-mesure qui produit des pages fantomes."
```

---

## Task 5 : Vérification sur base réelle

Aucun test automatisé ne lit le HTML servi. Cette vérification est la seule qui
prouve que le balisage arrive vraiment jusqu'à Google.

**Files:** aucun

- [ ] **Step 1 : Préparer les données**

Le conteneur `seo-service-db` de la Task 1 doit tourner :

```bash
docker start seo-service-db
docker ps --format "{{.Names}} {{.Ports}}"
```

Vérifie aussi qu'aucun conteneur n'occupe le port 3000 (souvent `users-service`).

Il te faut, dans cette base :
- un **salon normal** (`demo = false`) avec une offre publiée, une photo, un prix
  barré et des créneaux futurs ;
- un **salon de démonstration** (`demo = true`) avec une offre publiée et une
  photo.

Crée-les par un script `npx tsx` ou par l'interface. Pour basculer un salon en
démonstration :

```sql
UPDATE "ProviderProfile" SET demo = true WHERE id = '<id>';
```

- [ ] **Step 2 : Construire et servir**

```bash
npm run build
npx next start -p 3210
```

Le port 3210 évite les serveurs fantômes qui traînent sur 3000 et 3100 — un
serveur déjà lancé sur le port sert un ancien build et fausse toute la
vérification.

- [ ] **Step 3 : Dérouler la checklist**

Toute ligne qui échoue = la tâche n'est pas finie.

- [ ] `curl -s http://localhost:3210/offre/<id> | grep -c "application/ld+json"`
      → au moins 1.
- [ ] Extraire le balisage et vérifier : `"@type": "Product"`, `price` égal au
      **prix remisé**, `priceCurrency: "TND"`, `availability` en `InStock`.
- [ ] Le prix du balisage est **identique** à celui affiché sur la page (le
      comparer visuellement dans le HTML).
- [ ] `grep -o 'rel="canonical"[^>]*'` sur la page offre → présent, et l'URL
      **ne contient pas** de paramètre de requête.
- [ ] Ouvrir `/offre/<id>?ref=test123` → la canonique pointe toujours vers l'URL
      **sans** `?ref=`.
- [ ] Offre dont tous les créneaux sont pris (ou sans créneau) → `OutOfStock`.
- [ ] Offre sans avis → **aucun** `aggregateRating` dans le balisage.
- [ ] Page du salon de démonstration → contient
      `<meta name="robots" content="noindex, nofollow">`.
- [ ] Page d'une **offre** de ce salon de démonstration → contient aussi
      `noindex`.
- [ ] `curl -s http://localhost:3210/sitemap.xml` → ni le salon de démonstration
      ni ses offres n'y figurent ; le salon normal et ses offres y sont.
- [ ] Les pages du salon de démonstration répondent **HTTP 200** — elles restent
      consultables, aucune 404.

- [ ] **Step 4 : Nettoyer**

```bash
docker rm -f seo-service-db
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

Attendu : 161 tests, aucune nouvelle erreur `tsc`, lint propre sur les fichiers
touchés, build réussi.

- [ ] **Step 2 : Pousser**

```bash
git push -u origin seo-service
```

- [ ] **Step 3 : Ouvrir la PR**

`gh` n'est pas installé. Après le push, GitHub affiche une URL
`https://github.com/eyaalimi/salonista/pull/new/seo-service` — ouvre-la et
utilise ce corps :

```markdown
Balise chaque page service et permet de sortir les salons de démonstration de l'index Google.

## Changements

- **Balisage `Product` sur `/offre/[id]`** via un module pur testé (`src/lib/offer-jsonld.ts`, 12 tests). Ces pages n'avaient **aucun** balisage. Le type `Product` affiche prix, remise et disponibilité directement dans les résultats de recherche — `Service`, sémantiquement plus juste, ne produit aucun résultat enrichi.
- **Canonique sur les pages offre.** Elle manquait : les liens de tracking des influenceuses (`?ref=…`) étaient vus par Google comme des pages distinctes, du contenu dupliqué qui diluait le référencement de chaque service.
- **`aggregateRating`** émis dès qu'il existe au moins un avis. La page affiche déjà les étoiles sous cette condition, donc balisage et affichage restent alignés. Une note de `0` sur zéro avis serait une violation — le module l'interdit et un test le verrouille.
- **Champ `demo` sur `ProviderProfile`** (migration incluse) : un salon marqué de démonstration passe en `noindex` **avec ses offres**, et disparaît du sitemap. Ses pages restent consultables — aucune 404.

## Décisions notables

Le prix balisé est celui **payé** (`discountPrice`), jamais le prix barré, et il part **en chaîne** : le dinar a trois décimales et un flottant dériverait. Un écart entre balisage et affichage coûte l'extrait enrichi.

`availability` vient du nombre de créneaux libres — annoncer disponible un service sans créneau serait faux.

## Le jour du lancement

```sql
UPDATE "ProviderProfile" SET demo = true
WHERE id IN ('cmoqyf4ge0001wrp6ygmmcdcb', 'cmsn2hrre00364unut7zzvrdj');
```

Les deux salons de test quittent l'index à la prochaine visite de Google, sans 404.

## Vérification

`npm test` 161/161 · `tsc --noEmit` (seules restent les erreurs pré-existantes, dans deux fichiers non touchés) · `eslint` propre · `npm run build` réussi.

Checklist manuelle sur base réelle : balisage présent avec le bon prix et la bonne devise, canonique sans paramètre même sur `?ref=`, `OutOfStock` sans créneau, pas d'`aggregateRating` sans avis, salon `demo` en `noindex` avec ses offres et absent du sitemap tout en répondant 200.

**Après déploiement :** Rich Results Test sur une page offre → un extrait de produit valide avec le prix.
```

**Ne merge pas toi-même** — un push sur `main` déclenche le déploiement vers
Lightsail. Le merge est la décision du propriétaire.

---

## Notes de conception

**Pourquoi `Product` et non `Service` ?** `Service` est sémantiquement plus juste
pour une prestation, mais Google ne produit aucun résultat enrichi pour ce type :
le Rich Results Test continuerait d'annoncer « aucun élément détecté ».
`Product` avec un nœud `offers` affiche le prix dans les résultats, ce qui change
réellement le taux de clic. C'est l'usage courant des marketplaces de services à
prix fixe.

**Pourquoi le prix en chaîne ?** Le dinar tunisien a trois décimales (millimes).
`Number("120.000")` vaut `120`, et le balisage annoncerait `120` là où la page
affiche `120.000` — un écart que Google peut lire comme une incohérence. Le
`.toString()` d'un `Decimal` Prisma préserve la précision.

**Pourquoi `aggregateRating` conditionnel plutôt qu'omis ?** La première version
du spec l'écartait, sur l'idée que la note n'était pas affichée. Vérification
faite, `offer-client.tsx` affiche bien les étoiles dès qu'il y a un avis. La règle
de Google est donc satisfaite — à condition de ne rien émettre à zéro avis, ce que
le module garantit et qu'un test verrouille.

**Pourquoi propager `demo` aux offres ?** Marquer le salon seul laisserait ses
pages `/offre/[id]` dans l'index alors que le salon en est sorti. C'est la
demi-mesure qui produit des pages fantômes — exactement ce que le champ existe
pour éviter.
