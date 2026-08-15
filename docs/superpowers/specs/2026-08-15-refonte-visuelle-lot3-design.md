# Refonte visuelle — lot 3 : page /offres et barre du bas

**Date :** 2026-08-15
**Statut :** validé, prêt pour le plan d'implémentation
**Précédents :** [lot 1](2026-08-15-refonte-visuelle-lot1-design.md) · [lot 1b](2026-08-15-refonte-visuelle-lot1b-design.md) · [lot 2a](2026-08-15-refonte-visuelle-lot2a-design.md) — tous livrés, validés et mergés

---

## Problème

Les lots précédents ont refait la connexion, l'inscription et le haut de
l'accueil. L'utilisateur a signalé, capture à l'appui, que `/offres` garde
l'ancienne charte : badge « COLLECTION » encadré, titre Playfair, champ de
recherche rectangulaire, chips carrés en majuscules.

La barre de navigation du bas est dans le même état, et elle est visible sur
**toutes** les pages publiques.

## Objectif

Aligner `/offres`, la barre du bas et le menu de compte sur le design system.

## Ordre des lots restants

Établi avec l'utilisateur, du plus rentable au plus lourd :

| Lot | Contenu | Ampleur |
|---|---|---|
| **3 (celui-ci)** | `/offres` + barre du bas + menu de compte | 248 lignes, 21 classes `brand-*` |
| 4 | Fiche salon | 551 lignes, 62 classes |
| 5 | Fiche offre | 549 lignes, 59 classes |
| 6 | Bas de l'accueil | ~100 lignes |

---

## Décisions

### `NavAccount` est restylé, pas remplacé

**Une première proposition, retirée après vérification.** J'avais proposé de
remplacer l'en-tête de `/offres` par le `HomeNav` refait au lot 2a — une seule
barre à maintenir.

La lecture du code a montré que **`NavAccount` fait plus que `HomeNav`** : un
menu déroulant avec l'e-mail, un lien vers l'espace **selon le rôle**
(`dashboardByRole`), et un bouton **Déconnexion**. `HomeNav` n'a qu'un avatar
menant à `/cliente` en dur.

Le remplacement aurait donc supprimé la déconnexion et envoyé un prestataire vers
l'espace cliente. Option écartée.

`NavAccount` est restylé sur place, en gardant **exactement** ses fonctions.
Bénéfice supplémentaire : il apparaît aussi sur les fiches salon et offre, donc
ce travail sert aux lots 4 et 5.

**L'unification des deux barres reste souhaitable** — mais c'est une décision
produit (l'avatar de l'accueil doit-il ouvrir un menu ?), à traiter séparément.

### Le badge « COLLECTION » et le séparateur disparaissent

Le titre dynamique reste : il affiche « Résultats pour "balayage" » ou le nom de
la catégorie, et informe réellement sur l'endroit où l'on se trouve. Le compteur
d'offres reste aussi.

Écarté : garder le badge en le colorant en rose. Un pseudo-badge « COLLECTION »
entrerait en conflit avec le primitif `Badge`, dont le sens est précis dans le
système — menthe pour la disponibilité, rose pour les remises. Deux objets
identiques au sens différent créent la confusion.

Écarté aussi : supprimer tout l'en-tête. On perdrait le titre dynamique.

### Aucun nouveau primitif

Les six existants (`Button`, `Input`, `RoleTabs`, `Chip`, `Badge`, `Card`)
couvrent tous les besoins de cette page.

---

## Architecture

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/components/bottom-nav.tsx` | Barre du bas, visible partout | **Modifier** |
| `src/components/nav-account.tsx` | Menu de compte, sert aussi aux lots 4-5 | **Modifier** |
| `src/app/offres/page.tsx` | La page signalée par l'utilisateur | **Modifier** |

### La page `/offres`

```
        Nos offres beauté          ← Bricolage Grotesque
        8 offres disponibles

  ╭──────────────────────────╮ ╭──────────╮
  │ Cherche un soin, un salon│ │Rechercher│   ← deux pills, bouton rose
  ╰──────────────────────────╯ ╰──────────╯

  [Toutes] [Coiffure] [Esthétique] …          ← primitif Chip
```

La recherche devient deux pills séparées plutôt qu'un bloc rectangulaire soudé.
Le bouton « Rechercher » est l'**unique action primaire rose** de la page.

Les chips passent de carrés-majuscules à des pills en casse normale, via le
primitif `Chip`. Gain direct : ils obtiennent la cible tactile de 44px, que la
version actuelle n'a pas.

Les cartes d'offre adoptent `Card`, la remise devient un `Badge tone="rose"` et
la catégorie un `Badge tone="prune"`.

**Trois interdits à supprimer**, présents aujourd'hui : `hover:shadow-md` sur les
cartes, `bg-gradient-to-br` sur les images sans photo, `backdrop-blur-sm` sur le
badge de catégorie — plus le `backdrop-blur-md` de la barre de navigation.

**Deux points de contenu :**

- **« DT » devient « TND »**, comme sur le feed du lot 2a. Deux notations
  monétaires sur le même site prêtent à confusion.
- **La mention « TVA incluse : N% » reste.** Elle est utile et légalement
  pertinente ; seul son style change.

### La barre du bas

L'onglet actif passe de doré à **rose**, l'inactif à `prune-soft`, la bordure
supérieure à `hairline`. Le fond reste blanc.

**Ne bouge pas :** la logique `HIDDEN_PREFIXES` (la caisse et les tableaux de
bord ont leurs propres navigations), les cibles de 44px déjà correctes, et le
`env(safe-area-inset-bottom)` pour les iPhone à encoche. Ce sont des correctifs
acquis lors de lots antérieurs, pas du style.

---

## Vérification

Aucun test automatisé ne juge un rendu : Vitest tourne en `environment: "node"`
sans jsdom.

1. `npm run build` réussit ; `npx tsc --noEmit` et ESLint sans erreur nouvelle.
2. `grep` : **aucune** classe `brand-*` dans les trois fichiers, et aucun
   `shadow` / `gradient` / `blur`.
3. Les 180 tests restent au vert — aucun test ajouté.
4. **La recherche et les filtres fonctionnent toujours** : ce sont des `<form>`
   et des `<Link>` à paramètres d'URL. Seule leur apparence change, mais c'est
   ce qu'il faut tester.
5. La barre du bas reste **masquée** sur `/pos` — règle corrigée lors d'un lot
   antérieur.
6. `NavAccount` conserve ses trois fonctions : e-mail affiché, lien vers le bon
   espace selon le rôle, déconnexion.
7. **Contrôle visuel par l'utilisateur**, mobile et desktop.

---

## Ce que ce lot ne fait pas

- Les fiches salon (lot 4) et offre (lot 5), ni le bas de l'accueil (lot 6).
- Il ne supprime aucun token `brand-*` ni `pos-*` — 142 fichiers en dépendent,
  dont la caisse en production.
- Il n'unifie pas `HomeNav` et `NavAccount` : décision produit à traiter à part.
