# SEO des pages service et contrôle d'indexation

**Date :** 2026-08-15
**Statut :** validé, prêt pour le plan d'implémentation
**Précédents :** [SEO des pages salon](2026-08-13-seo-pages-salon-design.md) (livré) · FAQ sur l'accueil (branche `seo-faq`, poussée)

---

## Contexte

Salonista est **en phase de test**. Aucun salon réel ne l'utilise encore : les deux
salons indexés — Fadwa Dhibi (La Marsa) et Salon Ayou (Sfax) — sont des données
de test.

Le travail précédent a livré `LocalBusiness`, `generateMetadata` et l'entrée au
sitemap pour les pages `/salon/[id]`, plus un `FAQPage` sur l'accueil. Ce lot
traite les **pages service** et prépare le passage en production.

## Problème

Trois trous, vérifiés en production :

1. **`/offre/[id]` n'a aucun JSON-LD.** Ce sont pourtant les pages les plus
   nombreuses et les plus spécifiques — un service par salon, chacun avec son
   nom, son prix et sa remise.
2. **Aucun `canonical` sur les pages offre.** Les liens de tracking des
   influenceuses (`/offre/x?ref=abc`) sont donc vus par Google comme des pages
   distinctes : du contenu dupliqué qui dilue le référencement de la vraie page.
   Les pages salon ont ce canonical depuis le lot précédent ; les offres non.
3. **Rien ne permet de sortir un salon de l'index.** Au lancement, les salons de
   démonstration resteront dans Google, et les supprimer produirait des 404 —
   ce qui nuit à la confiance accordée au domaine.

## Objectif

Que chaque service de chaque salon soit correctement balisé et visible, et que
les données de test puissent quitter l'index proprement le jour du lancement.

## Non-objectifs

- **`aggregateRating`** sur les offres. Les avis existent en base
  (`Review.offerId`) mais ne sont pas affichés sur la page ; Google exige que
  toute note balisée soit visible. À traiter quand la page affichera les avis.
- **Le classement.** Ce lot rend les pages correctement présentées, pas mieux
  classées. Voir « Ce que ce lot ne fait pas ».

---

## Décisions

### `Product` avec `offers`, et non `Service`

Écarté : `Service`, sémantiquement plus juste pour une prestation, mais Google
**ne produit aucun résultat enrichi** pour ce type — le Rich Results Test
continuerait d'annoncer « aucun élément détecté ».

`Product` avec un nœud `offers` est le type qui affiche **prix, remise et
disponibilité** directement dans les résultats de recherche. Les pages ont
exactement cette matière : prix barré, prix remisé, pourcentage calculé. C'est
l'usage courant des marketplaces de services à prix fixe.

Écarté aussi : combiner `Product` et `Service`. Deux balisages sur une même page
se contredisent parfois, et Google recommande un type principal clair.

**La contrainte que ça impose :** le prix du balisage doit être exactement celui
affiché sur la page, et la disponibilité doit être juste. Un écart est une
violation qui coûte l'extrait enrichi.

### Le prix balisé est le prix payé

`discountPrice`, pas `originalPrice`. C'est la règle de Google et c'est ce que la
page affiche en gros. Le prix barré n'apparaît pas dans le balisage.

Devise `TND`. Le dinar a trois décimales, donc `"120.000"`, transmis **en
chaîne** pour éviter toute dérive de virgule flottante.

`priceValidUntil` à 30 jours — la fenêtre des créneaux générés. Sans ce champ,
Google finit par considérer le prix comme périmé et cesse de l'afficher.

### La disponibilité vient des créneaux

`InStock` s'il reste au moins un créneau libre dans les 30 jours,
`OutOfStock` sinon. Annoncer disponible un service sans créneau serait faux, et
Google pénalise l'écart.

### Un booléen `demo` par salon

```prisma
/// Salon de demonstration : exclu de l'index Google, mais parfaitement
/// consultable.
demo Boolean @default(false)
```

Écarté : une variable d'environnement globale, qui bascule tout le site — donc
impossible d'avoir un vrai salon indexé et un salon de test masqué en même temps,
ce qui est précisément la situation du lancement.

Écarté aussi : réutiliser `verified`. Ce champ sert à la modération ; un vrai
salon non encore vérifié deviendrait invisible sans raison.

**Marquer un salon `demo` désindexe aussi ses offres.** Sinon les pages
`/offre/[id]` du salon resteraient dans Google alors que le salon en est sorti —
la demi-mesure qui laisse des pages fantômes.

**Par défaut `false`** : rien ne change tant qu'on n'agit pas. Les salons de test
restent indexés, ce qui permet de continuer à vérifier le SEO avec de vrais
outils.

### La bascule se fait en SQL, pas par une interface

Écarté : une case dans `/admin/users`, et à plus forte raison dans
`/pos/settings` — un salon ne doit pas pouvoir se désindexer lui-même par erreur.

C'est une opération qu'on fera **une fois**, sur deux salons. Construire une
interface pour un geste unique serait disproportionné ; si le besoin devient
récurrent, ajouter la case à l'admin sera trivial puisque le champ existera.

---

## Architecture

### Fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/lib/offer-jsonld.ts` | Offre → `Product` Schema.org | **Créer** |
| `src/lib/offer-jsonld.test.ts` | Tests : prix, devise, disponibilité | **Créer** |
| `prisma/schema.prisma` | Champ `demo` sur `ProviderProfile` | **Modifier** |
| `prisma/migrations/…` | Migration générée | **Créer** |
| `src/app/offre/[id]/page.tsx` | Canonical, `robots`, rendu du `<script>` | **Modifier** |
| `src/app/salon/[id]/page.tsx` | `robots` si le salon est `demo` | **Modifier** |
| `src/app/sitemap.ts` | Exclure les salons `demo` et leurs offres | **Modifier** |

### Le module pur

Cinquième de cette forme dans le dépôt, après `offer-publish.ts`,
`booking-conflicts.ts`, `coords.ts` et `salon-jsonld.ts`. Même raison : Vitest
tourne en `environment: "node"` sans jsdom, donc les composants ne sont pas
testables, mais une règle l'est. **Aucun import Prisma.**

Il porte les décisions vérifiables : prix payé et non barré, format à trois
décimales en chaîne, disponibilité déduite du nombre de créneaux libres, et
omission des champs non renseignés.

### Le balisage émis

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Balayage / Mèches",
  "description": "…",
  "image": ["https://salonista.tn/uploads/xxx.jpg"],
  "category": "Coiffure",
  "brand": { "@type": "Brand", "name": "Salon Ayou" },
  "offers": {
    "@type": "Offer",
    "price": "120.000",
    "priceCurrency": "TND",
    "availability": "https://schema.org/InStock",
    "url": "https://salonista.tn/offre/<id>",
    "priceValidUntil": "2026-09-14",
    "seller": { "@type": "LocalBusiness", "name": "Salon Ayou" }
  }
}
```

Chaque champ optionnel est conditionnel : pas de description renseignée, pas de
clé `description` ; pas de photo, pas d'`image`.

### La bascule du jour du lancement

```sql
UPDATE "ProviderProfile" SET demo = true
WHERE id IN ('cmoqyf4ge0001wrp6ygmmcdcb', 'cmsn2hrre00364unut7zzvrdj');
```

Les pages continuent de répondre normalement — aucune 404, aucun lien cassé.
Google les retire de son index à sa prochaine visite.

---

## Vérification

**Automatique :** `npm test` (149 aujourd'hui sur `main` + ceux du module),
`npx tsc --noEmit`, `npm run lint`, `npm run build`.

**Manuelle**, sur PostgreSQL jetable, en lisant le HTML réellement servi :

1. Page offre → le `<script>` contient un `Product` avec le **prix payé**, la
   devise `TND`, `availability` et `priceValidUntil`.
2. Le prix du balisage est **identique** à celui affiché sur la page.
3. Offre sans créneau libre → `OutOfStock`.
4. Page offre → `<link rel="canonical">` présent et sans paramètre de requête.
5. Salon marqué `demo` → sa page et **toutes ses pages offre** portent
   `noindex`, et disparaissent du sitemap.
6. Salon marqué `demo` → ses pages restent **consultables** (HTTP 200), aucune
   404.
7. Salon non `demo` → rien ne change par rapport à aujourd'hui.

**Après déploiement :** Rich Results Test sur une page offre → un **extrait de
produit** valide avec le prix.

---

## Ce que ce lot ne fait pas

Le SEO technique rend les pages correctement présentées ; il ne les fait pas
mieux classer. Sur « coiffeur Tunis », ce qui décide reste l'ancienneté du
domaine et les liens entrants.

Le vrai levier est le **nombre de vrais salons avec des fiches complètes**. Deux
salons de test et huit offres font peu de portes d'entrée ; chaque salon réel qui
s'inscrit avec photos, catégorie juste et horaires ajoute mécaniquement des pages
indexables.

Point de contenu constaté à la rédaction : Salon Ayou est bien passé en
« Esthétique », mais **Fadwa Dhibi affiche encore « Autre »** dans son titre. À
corriger depuis `/pos/settings` — c'est du contenu, pas du code.
