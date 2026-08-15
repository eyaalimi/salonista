# SEO Salonista — état des lieux et suites

**Dernière mise à jour :** 2026-08-15

Notes à reprendre quand le sujet SEO revient. Écrites après la première phase de
travail, alors que Salonista est **en test** — aucun salon réel ne l'utilise
encore.

---

## Ce qui est fait

| Chantier | État |
|---|---|
| Google Search Console | Validé (fichier HTML), sitemap soumis |
| Indexation | **Effective** — l'accueil et `/offres` sortent dans Google |
| `LocalBusiness` sur les pages salon | Livré et déployé |
| Titres et descriptions par salon | Livré (`{nom}, {ville} — {catégorie}`) |
| Pages salon au sitemap | Livré |
| Favicon PNG pour les résultats | Déployé — en attente du cache Google |
| `FAQPage` sur l'accueil | Branche `seo-faq` |
| `Product` sur les pages service | Branche `seo-service` |
| Canonique sur les pages offre | Branche `seo-service` |
| Champ `demo` (désindexation) | Branche `seo-service` |

**Vérifier avant de repartir :** `seo-faq` et `seo-service` étaient poussées mais
pas encore mergées au 15/08.

---

## À faire le jour du lancement

Les deux salons de test doivent quitter l'index Google. Ils ne doivent **pas**
être supprimés — ça produirait des 404, ce qui nuit à la confiance accordée au
domaine.

```sql
UPDATE "ProviderProfile" SET demo = true
WHERE id IN ('cmoqyf4ge0001wrp6ygmmcdcb', 'cmsn2hrre00364unut7zzvrdj');
```

Effet : le salon **et ses offres** passent en `noindex` et sortent du sitemap,
tout en restant consultables. Google les retire sous quelques jours.

*(Nécessite la branche `seo-service` mergée.)*

---

## Le levier principal, et il n'est pas technique

**Google Business Profile pour chaque salon.** Gratuit, hors code, et de loin le
meilleur retour sur temps investi pour un commerce local. C'est ce qui fait
apparaître un salon dans Google Maps et dans les résultats « près de moi » —
beaucoup plus vite qu'un référencement classique.

Sur une requête comme « coiffeur La Marsa », une fiche Business Profile bien
remplie sortira avant le site.

**Le second levier : plus de vrais salons.** Chaque salon inscrit avec photos,
catégorie juste, horaires et adresse ajoute mécaniquement des pages indexables et
des mots-clés. Deux salons de test font peu de portes d'entrée.

---

## Idées techniques, par ordre d'utilité

### 1. Une page par ville

`/beaute/tunis`, `/beaute/sfax`, `/beaute/sousse`… listant les salons de la
ville. C'est ce qui permet de viser « salon de beauté Tunis » avec une page
dédiée plutôt qu'avec l'accueil.

**À faire seulement quand il y a plusieurs salons par ville** — une page de ville
avec un seul salon est plus faible qu'utile.

### 2. Une carte multi-salons `/carte`

Déjà envisagée puis écartée : elle serait vide aujourd'hui. Elle prend son sens
quand les salons ont des coordonnées (la fonctionnalité existe depuis le lot
carte).

### 3. `aggregateRating` sur les pages salon

Les avis sont attachés aux **offres**, pas aux salons. Deux options le jour où le
volume le justifie : agréger sur les offres du salon, ou introduire une note de
salon (plus propre, demande une migration).

Rappel de la règle : Google exige que toute note balisée soit **affichée sur la
page**. C'est déjà le cas sur les pages offre — d'où l'`aggregateRating` livré
dans `seo-service` — mais pas sur les pages salon.

### 4. Recherche par proximité

« Salons à moins de 5 km ». Demande une requête géospatiale. Utile côté produit
autant que côté SEO.

### 5. Contenu éditorial

Un blog aide au référencement par les mots-clés et les liens, **sur plusieurs
mois**. À ne pas confondre avec les résultats enrichis : le balisage `Article` ne
produit pas d'aperçu spécial pour un site comme Salonista.

À n'envisager que si quelqu'un s'engage à l'alimenter régulièrement. Un blog
abandonné ne sert à rien.

---

## Choses à ne pas refaire

**Ne pas tester le Rich Results Test sur l'accueil et conclure à un problème.**
`WebSite` et `Organization` sont valides mais ne figurent pas parmi les types que
l'outil sait prévisualiser. Tester une page **salon** ou **offre**.

**Ne pas confondre indexation et classement.** Le SEO technique rend un site
indexable ; le classement dépend de l'ancienneté du domaine, du contenu et des
liens entrants. Aucune ligne de code n'agit dessus.

**Ne pas attendre un effet immédiat du favicon.** Google maintient un cache de
favicons distinct de son index. Compter plusieurs jours à plusieurs semaines.
Redemander une indexation n'accélère pas ce cache.

**Vérifier en navigation privée.** L'historique et la localisation faussent les
résultats. Search Console → Performances est la seule source fiable sur les
positions réelles.

---

## Dette technique repérée en chemin

**Le schéma Prisma et la base divergent depuis juin.** La contrainte
`CashDrawerExpense_employeeId_fkey` a été créée en `ON DELETE NO ACTION` par la
migration du 12 juin, alors que le schéma Prisma implique `RESTRICT`.

Conséquence : `prisma migrate dev` veut joindre un `DROP`/`ADD` de cette
contrainte à **toute** nouvelle migration. La migration `provider_demo` a donc été
écrite à la main pour ne contenir que sa propre colonne.

À traiter dans un lot dédié — pas en douce dans un lot fonctionnel.

**Les libellés de catégorie sont dupliqués sept fois** dans le dépôt
(`page.tsx`, `offres/page.tsx`, `offre/[id]/page.tsx`, `admin/offres/page.tsx`,
`cliente/page.tsx`, `z-report-content.tsx`, et `salon-jsonld.ts` qui exporte
`categoryLabel()`). Les nouveaux modules réutilisent `categoryLabel` ; les
anciennes copies restent.

---

## Où retrouver le détail

- Spécifications : `docs/superpowers/specs/2026-08-1*-seo-*.md`
- Plans d'implémentation : `docs/superpowers/plans/2026-08-1*-seo-*.md`
