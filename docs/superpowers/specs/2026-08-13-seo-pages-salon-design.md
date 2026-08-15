# SEO des pages salon

**Date :** 2026-08-13
**Statut :** validé, prêt pour le plan d'implémentation
**Précédent :** [carte des salons](2026-08-13-carte-salons-design.md) (livré)

---

## Contexte : le diagnostic d'abord

La demande initiale était « travailler le SEO pour apparaître dans les
recherches ». Le diagnostic a montré autre chose que ce qu'on attendait.

**`site:salonista.tn` renvoyait zéro résultat : le site n'était indexé nulle
part.** Vérification faite contre la production, rien ne bloquait techniquement :

- `robots.txt` autorise l'exploration ;
- `sitemap.xml` répond, 12 URLs ;
- `index, follow` sur l'accueil ;
- pages prérendues, réponses 200.

La cause était hors code : **le domaine n'avait jamais été déclaré à Google.**
Search Console a été créé et validé par fichier HTML (`public/googlec27b7e0ef91f88b6.html`,
commit `751c3e9`, déployé). Le sitemap a été soumis — 12 pages découvertes — et
l'accueil est désormais **indexé**.

Ce spec traite ce qui reste, et qui relève réellement du code.

## Problème

Trois trous, tous sur les pages salon :

1. **`/salon/[id]` n'a aucun `generateMetadata`.** Dans Google, chaque salon
   s'afficherait avec le titre générique « Salonista » et la description de
   l'accueil. Un salon ne peut pas sortir sur son propre nom.
2. **Les pages salon sont absentes du sitemap.** Seules les offres y figurent.
   Google ne sait pas que ces pages existent.
3. **Aucun JSON-LD `LocalBusiness`.** L'accueil porte `WebSite` et
   `Organization` ; les salons n'ont rien. C'est le format que Google attend
   pour un commerce local.

La matière existe désormais : le lot C a rendu le profil et les horaires
éditables, la carte a ajouté `lat`/`lng`.

## Objectif

Que chaque page salon soit correctement présentée et découvrable — pas seulement
la marketplace.

## Non-objectifs

- **`aggregateRating`** (les étoiles). Voir la décision ci-dessous.
- **JSON-LD sur `/offre/[id]`.** Ces pages ont déjà leurs métadonnées ; un
  balisage `Product`/`Offer` est un chantier distinct, avec ses propres
  contraintes (Google est strict sur les prix et la disponibilité).
- **Contenu éditorial, pages par ville, maillage interne.** Ce sont les leviers
  qui font vraiment classer, mais ils relèvent d'une stratégie de contenu, pas
  d'un lot de code.

## Ce que ce lot ne fera pas, et qu'il faut dire

Le SEO technique rend un site **indexable**, pas **bien classé**. Le classement
dépend du contenu, de l'ancienneté du domaine et des liens entrants — aucune
ligne de code n'agit dessus.

Pour des recherches comme « coiffeur Tunis », ce qui déplacera l'aiguille est
**Google Business Profile** de chaque salon pilote : gratuit, hors code, effet
rapide sur les recherches locales. Ce lot garantit que lorsque Google regarde, il
trouve des pages propres.

---

## Décisions

### `LocalBusiness` sans `aggregateRating`

Écarté : ajouter la note moyenne pour obtenir les étoiles dans les résultats.
Deux obstacles concrets.

Les avis sont attachés aux **offres** (`Review.offerId`), pas aux salons : il
faudrait les agréger sur toutes les offres du salon. Surtout, Google exige que
toute note présente dans le balisage soit **également affichée sur la page** ;
la page salon n'en affiche aucune. Baliser une note invisible est une violation
qui peut coûter la fiche enrichie entière.

Les salons pilotes ont par ailleurs peu ou pas d'avis, et des étoiles calculées
sur deux notes n'apportent rien. À ajouter quand il y aura du volume — ce sera
une dizaine de lignes.

Écarté aussi : `HealthAndBeautyBusiness`, sous-type plus précis que Google ne
traite pas différemment pour les fiches enrichies. Gain nul, typage plus strict.

### Au sitemap : les salons ayant au moins une offre publiée

Le filtre reflète celui déjà appliqué aux offres (`active`,
`publishedToMarketplace`, au moins une photo). Si un salon a au moins une offre
visible sur le feed, sa page a du contenu réel.

Écarté : lister tous les salons. Un salon fraîchement inscrit produirait une page
quasi vide, et faire découvrir des pages vides sur un domaine neuf envoie
exactement le mauvais signal.

Écarté aussi : filtrer sur `verified`. Ce champ sert à la modération interne, pas
à la qualité du contenu ; un salon complet mais non vérifié serait exclu sans
raison.

Les salons non listés restent accessibles et indexables si Google les trouve
autrement. On ne les cache pas, on ne les met pas en avant.

### Le JSON-LD passe par une fonction pure

`src/lib/salon-jsonld.ts` transforme un profil en objet Schema.org ; `page.tsx`
le rend dans une balise `<script type="application/ld+json">`, côté serveur, pour
que Google le voie sans exécuter de JavaScript.

La raison d'en faire un module isolé est précise : **Schema.org attend `Monday`,
on stocke `mon`.** Une correspondance décalée d'un jour annoncerait à Google que
le salon ouvre le dimanche — invisible à l'œil, détectable en trois lignes de
test.

C'est le quatrième module pur de cette série, après `offer-publish.ts`,
`booking-conflicts.ts` et `coords.ts`, tous extraits pour la même raison : Vitest
tourne en `environment: "node"` sans jsdom, donc les composants ne sont pas
testables ici, mais une règle l'est.

Écarté : tout écrire dans `salon-client.tsx`. C'est un composant client (~600
lignes), le balisage n'apparaîtrait pas de façon fiable dans le HTML initial.

---

## Architecture

### Fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/lib/salon-jsonld.ts` | Profil → objet Schema.org | **Créer** |
| `src/lib/salon-jsonld.test.ts` | Tests, dont la correspondance des jours | **Créer** |
| `src/app/salon/[id]/page.tsx` | `generateMetadata` + rendu du `<script>` | **Modifier** |
| `src/app/sitemap.ts` | Ajouter les pages salon | **Modifier** |

**Vérifié : aucun champ à ajouter à la requête.** `page.tsx` charge le profil
avec `include` et non `select`, donc `photos`, `address`, `phone`, `lat`, `lng`
et `openingHours` sont déjà disponibles.

### Les métadonnées

Calquées sur `generateMetadata` de `/offre/[id]`, qui existe déjà et sert de
modèle.

**Titre** : `{nom}, {ville} — {catégorie} | Salonista`. La ville y figure parce
que c'est ce que les gens tapent (« coiffeur Tunis ») ; la catégorie qualifie
l'activité. Sans ville : `{nom} — {catégorie}`.

**Description** : celle du salon si elle existe. Sinon, composée à partir des
faits — nom, ville, et les noms des trois premiers services publiés. Rien
d'inventé.

**Open Graph** : mêmes valeurs, plus la première photo du salon. C'est ce qui
s'affiche quand un salon partage son lien sur WhatsApp ou Facebook — usage
courant en Tunisie, et aujourd'hui le partage ne montre qu'un bloc générique.

### Le JSON-LD émis

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Salon Amira",
  "description": "…",
  "url": "https://salonista.tn/salon/<id>",
  "image": ["https://salonista.tn/uploads/xxx.jpg"],
  "telephone": "+21622000000",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "12 rue de la Liberté",
    "addressLocality": "Tunis",
    "addressCountry": "TN"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": 36.8, "longitude": 10.18 },
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Monday", "opens": "09:00", "closes": "18:00" }
  ]
}
```

**Chaque champ est conditionnel.** Pas d'adresse renseignée → pas de clé
`address`. Coordonnées absentes ou invalides (via `isValidCoords`, déjà testé) →
pas de `geo`. Un balisage qui décrit des données absentes est pénalisé, pas
récompensé.

Les horaires multiples le même jour (pause déjeuner) produisent deux entrées pour
ce jour, ce que le format prévoit.

---

## Vérification

**Automatique :** `npm test` (136 aujourd'hui + ceux du JSON-LD), `npx tsc
--noEmit`, `npm run lint`, `npm run build`.

Les tests couvrent la fonction pure : correspondance des sept jours, horaires
multiples, champs absents non émis, coordonnées invalides rejetées.

**Manuelle** — et c'est ici que se joue le vrai résultat :

1. Passer une URL de salon dans le [Rich Results Test de
   Google](https://search.google.com/test/rich-results) → le balisage doit être
   reconnu sans erreur. Aucun test automatisé ne remplace ça : un JSON-LD
   syntaxiquement valide peut être rejeté sémantiquement.
2. Vérifier le titre et la description dans le HTML servi (`curl` + `grep
   "<title>"`).
3. Coller une URL de salon dans WhatsApp → le titre et la photo doivent
   apparaître à la place du bloc générique.
4. Vérifier que `/sitemap.xml` contient bien les URLs `/salon/<id>` des salons
   ayant une offre publiée, et **pas** celles des salons sans offre.
5. Salon sans adresse ni coordonnées → le JSON-LD ne contient ni `address` ni
   `geo`, et reste valide au Rich Results Test.
6. Après déploiement : soumettre une URL de salon à l'indexation dans Search
   Console.

---

## Dette assumée

**Les avis restent attachés aux offres.** Le jour où `aggregateRating` deviendra
utile, il faudra soit agréger sur les offres, soit introduire une note de salon.
La seconde option est plus propre mais demande une migration.

**Aucun test ne vérifie que Google accepte le balisage.** Le Rich Results Test
est manuel et dépend d'un service externe. C'est une limite acceptable : le seul
substitut serait de figer une réponse de l'outil, qui deviendrait obsolète.
