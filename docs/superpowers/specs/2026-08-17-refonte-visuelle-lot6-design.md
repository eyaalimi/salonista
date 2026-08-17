# Refonte visuelle — lot 6 : le bas de l'accueil

**Date :** 2026-08-17
**Statut :** validé, prêt pour le plan d'implémentation
**Précédents :** [lot 1](2026-08-15-refonte-visuelle-lot1-design.md) · [lot 1b](2026-08-15-refonte-visuelle-lot1b-design.md) · [lot 2a](2026-08-15-refonte-visuelle-lot2a-design.md) · [lot 3](2026-08-15-refonte-visuelle-lot3-design.md) · [lot 4](2026-08-15-refonte-visuelle-lot4-design.md) · [lot 5](2026-08-17-refonte-visuelle-lot5-design.md)

---

## Problème

Le lot 2a a refait le haut de l'accueil — en-tête, recherche, chips, cartes
salon et cartes offre — en laissant volontairement le bas pour plus tard, afin
que le diff reste relisable.

Ce bas de page garde l'ancienne charte : bannière promo, « Salons près de toi »,
CTA prestataire/influenceuse, FAQ et pied de page.

## Objectif

Terminer la série : plus aucune classe `brand-*` ni `luxury-*` sur l'accueil.

---

## Périmètre

| Fichier | État de départ |
|---|---|
| `src/app/page.tsx` | 467 lignes, **18** `brand-*`, **3** `luxury-*` |
| `src/components/promo-banner.tsx` | 19 lignes, **4** `brand-*` |

**`PromoBanner` est un fichier séparé**, non compté dans les 18. Vérifié : il
n'est utilisé que par l'accueil.

Les sections concernées : bannière promo, « Salons près de toi », CTA
prestataire/influenceuse, FAQ, pied de page. Tout le haut de page est déjà fait.

---

## Décisions

### Le CTA professionnel passe au tutoiement

Il dit aujourd'hui « Vous avez un salon ? », « Recevez des réservations »,
« Monétisez votre audience » — seul bloc du site à vouvoyer, parce qu'il
s'adresse aux professionnels et non aux clientes.

Retenu : **tutoiement**, comme le reste. L'argument décisif n'est pas la
cohérence de principe mais la destination : ces deux liens mènent à
`/register`, **refaite au lot 1b et qui tutoie déjà**. Vouvoyer sur l'accueil
pour tutoyer à l'étape suivante est une rupture au milieu d'un parcours.

### La bannière promo est restylée, pas touchée sur le fond

Elle annonce « Offres du weekend · Jusqu'à -50% sur hammam & coiffure » — un
texte **en dur**, qui ne correspond à aucune promotion en base.

Retenu : la restyler, sans toucher au texte. Qu'elle soit fictive est un sujet
produit — la piloter par les données demanderait un modèle de promotion qui
n'existe pas.

Écarté : la supprimer. Supprimer une section est une décision produit, comme au
lot 2a pour le CTA prestataire.

### Le rose primaire va au CTA professionnel

L'accueil compte plusieurs appels : la bannière promo, « Voir » des salons
proches, les deux CTA pro, les liens du pied de page.

Le haut de page (lot 2a) n'a **aucun** fond rose plein : les chips actifs le
sont, mais c'est un état de sélection. Le bas peut donc porter l'action
primaire.

Retenu : le **bloc CTA professionnel** garde son fond sombre `prune` — c'est un
encart distinct, visuellement séparé du flux — et ses deux liens d'action
passent en `rose`. La bannière promo et « Voir » restent secondaires.

### Le pied de page et le CTA gardent leur fond sombre

`bg-brand-ink` (#1F1A1C) devient `bg-prune` (#3A1024). Le principe ne change
pas : ces deux blocs se détachent par un fond sombre, ce qui reste conforme —
la règle interdit les ombres et les dégradés, pas les fonds contrastés.

Le `<Logo tone="light">` du pied de page est **conservé** : il existe
précisément pour les fonds sombres.

### `page.tsx` est un composant serveur

Vérifié : le fichier n'a **pas** de directive `"use client"`. Il interroge
directement Prisma.

Conséquence pour ce lot : aucun `onClick`, `useState` ni gestionnaire
d'événement ne peut y être introduit. Le restylage n'en a pas besoin — tout
passe par des classes et des `<Link>` — mais c'est une limite à connaître avant
de proposer quoi que ce soit d'interactif.

`PromoBanner`, lui, est un composant sans état qui ne rend qu'un `<Link>` : il
n'a pas non plus besoin de devenir client.

### La FAQ garde `<details>`/`<summary>`

Structure inchangée. C'est du HTML natif, sans JavaScript, et **le contenu reste
dans le HTML même replié** — ce qui satisfait l'exigence de Google : une
question balisée doit être visible sur la page.

Seul le style change. Le `+` qui pivote à l'ouverture (`group-open:rotate-45`)
est conservé : c'est une transformation d'état, pas une animation d'apparition.

---

## Ce que ce lot ne touche sous aucun prétexte

- **Les trois blocs JSON-LD** en fin de page : `WebSite`, `Organization` et
  `FAQPage`. C'est le travail SEO construit précédemment, et `FAQPage` est le
  seul type que le Test des résultats enrichis de Google prévisualise.
- `buildFaqJsonLd()` et `FAQ_ITEMS` — source unique de la FAQ visible **et** du
  balisage. Les désynchroniser invaliderait le balisage.
- Toutes les requêtes de données et le calcul de disponibilité des salons
  (`pickNextSlot`, `formatAvailability`) — lot 2a.
- Le haut de page, déjà livré.

---

## Vérification

Aucun test automatisé ne juge un rendu : Vitest tourne en `environment: "node"`
sans jsdom.

1. `grep` : **0** `brand-*` et **0** `luxury-*` dans les deux fichiers. C'est ce
   compteur global qui fait foi — aux lots 4 et 5, il a rattrapé à chaque fois
   une section oubliée par le découpage.
2. `npx tsc --noEmit` filtré sur les deux fichiers : aucune sortie. **23 erreurs
   préexistent** dans le module de caisse — hors sujet.
3. ESLint : **52 problèmes**, comme sur `main`, pas un de plus.
4. **180 tests au vert.**
5. `npm run build` réussit.
6. **Les trois blocs JSON-LD sont intacts** dans le HTML servi — contrôle non
   négociable : c'est le SEO qui a demandé le plus d'efforts.
7. La FAQ reste dépliable et son contenu présent dans le HTML même replié.
8. **Contrôle visuel par l'utilisatrice**, mobile et desktop.

**Rappel :** après un seed, l'accueil n'affiche ni offres ni salons —
`seed.ts` écrit `publishedToMarketplace: false` alors que les pages exigent
`true`. Publier temporairement en SQL pour tout contrôle visuel.

---

## Ce que ce lot ne fait pas

- Il ne supprime aucune section de la page.
- Il ne rend pas la bannière promo pilotée par les données.
- Il ne supprime aucun token `brand-*` ni `pos-*`, ni aucune classe `.luxury-*` —
  142 fichiers en dépendent, dont la caisse en production.
- Il ne touche ni au layout racine ni au composant `<Logo>`, qui gardent des
  classes `brand-*` visibles sur toutes les pages. Les traiter reviendrait à
  toucher le site entier, y compris la caisse.
- **Il ne remplace pas les « DT » restants** du dépôt (méta-descriptions SEO,
  tableaux de bord admin, cliente, influenceuse, caisse — plus de douze
  fichiers). Chantier séparé, à faire d'un seul geste.
- Il ne corrige pas le contraste `text-white` sur `bg-rose` (2,94:1, sous le
  seuil AA de 4,5:1), ni le pattern ARIA tablist incomplet. Les deux concernent
  tout le site et sont documentés dans les lots précédents.
