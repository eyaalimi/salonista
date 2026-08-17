# Contraste du rose : texte prune sur fond rose

**Date :** 2026-08-17
**Statut :** validé, prêt pour le plan d'implémentation
**Contexte :** premier des trois chantiers transverses ouverts après la série de refonte visuelle (lots 1 à 6, tous livrés).

---

## Problème

Le token `--color-rose` (`#FF5C8A`) porte du texte blanc partout où il sert de
fond. Ce couple donne un contraste de **2,94:1**.

Les seuils WCAG AA sont de **4,5:1** pour du texte normal et **3:1** pour du
texte large (≥ 18,66px gras ou ≥ 24px). Le couple actuel est sous les deux.

Concrètement : sur les boutons roses du site, le libellé est difficile à lire
pour une personne malvoyante, en plein soleil, ou sur un écran de mauvaise
qualité — trois situations courantes pour une cliente qui réserve depuis son
téléphone dans la rue.

Le défaut a été relevé lors des revues des lots 4 et 5, et laissé de côté à
chaque fois : il concerne un token partagé, donc tout le site, et ne pouvait pas
être corrigé dans un lot dédié à une page.

## Objectif

Atteindre le seuil AA partout où le rose sert de fond, **sans modifier la
couleur `#FF5C8A`**, qui vient de la palette de référence de l'utilisatrice.

---

## Décision

### Le texte passe au prune ; le rose ne bouge pas

Deux voies atteignaient le seuil, chiffrées avant de choisir :

| Voie | Contraste | Conséquence |
|---|---|---|
| Assombrir le rose vers `#D42E60`, garder le blanc | 4,82:1 | Les boutons gardent leur aspect, mais la couleur de la palette change |
| **Garder `#FF5C8A`, texte en `prune` (#3A1024)** | **5,59:1** | La couleur est préservée, l'aspect des boutons change |

**Retenu : la seconde.** La couleur de marque est un choix de l'utilisatrice,
issu d'une palette qu'elle a fournie ; l'altérer pour une raison technique
reviendrait à défaire une décision de design. Le texte, lui, n'a pas ce statut.

Le résultat dépasse le seuil AA avec 5,59:1, soit une marge confortable.

### Aucune exception « grand texte »

Vérifié avant de conclure : tous les textes concernés sont petits.

- Badges : `text-xs` (12px)
- Initiale d'avatar : `text-xs`
- Cases de calendrier et créneaux : `text-sm` (14px)
- Boutons : `text-base` (16px)

Aucun n'atteint les 18,66px gras qui autoriseraient le seuil réduit de 3:1.
Le prune s'applique donc partout, sans cas particulier.

---

## Périmètre

Plus large que « les boutons ». Cartographié avant rédaction :

### Trois primitifs

| Fichier | Élément |
|---|---|
| `src/components/ui/button.tsx` | variante `primary` |
| `src/components/ui/badge.tsx` | ton `rose` |
| `src/components/ui/chip.tsx` | état actif |

Les corriger propage la correction partout où ces primitifs sont utilisés — ce
qui couvre la majorité des cas.

### Treize emplacements en dur

Répartis dans huit fichiers : page d'inscription, fiche offre (bouton de
paiement + les deux onglets d'authentification), `/offres`, accueil (les deux
CTA professionnels), fiche salon, les deux calendriers (jour sélectionné +
créneau actif), et l'initiale d'avatar du menu de compte.

### Le survol

`Button` définit `hover:bg-[#F04A79]`, un rose plus foncé. Calculé, pas
supposé : avec du texte prune, ce survol donne **4,66:1** — au-dessus du seuil
de 4,5:1, mais avec une marge bien plus mince que les 5,59:1 de l'état normal.

Il est conservé tel quel.

**Avertissement pour la suite, calculé :** avec du texte prune, assombrir
davantage le fond **dégrade** le contraste au lieu de l'améliorer — le prune
étant lui-même très foncé, il se rapproche du fond :

| Fond | Contraste avec le prune |
|---|---|
| `#FF5C8A` (normal) | 5,59:1 ✓ |
| `#F04A79` (survol actuel) | 4,66:1 ✓ |
| `#D42E60` | 3,41:1 ✗ |
| `#B01C4A` | 2,43:1 ✗ |

Autrement dit : **le couple prune-sur-rose n'est viable que sur les roses
clairs.** Si l'on voulait un jour un rose plus profond, il faudrait revenir au
texte blanc — les deux options sont exclusives l'une de l'autre.

---

## Ce que ce chantier ne touche pas

- **La couleur `--color-rose` elle-même.** C'est tout l'intérêt de l'option
  retenue.
- `--color-rose-soft`, qui porte déjà du texte prune (13,35:1).
- L'anneau de focus `.ds-focus`, qui utilise le rose comme **bordure** et non
  comme fond — les règles de contraste de texte ne s'y appliquent pas.
- Les tokens `brand-*` et `pos-*`, ni la caisse.

---

## Vérification

1. **Le calcul de contraste**, refait après modification : `#3A1024` sur
   `#FF5C8A` doit donner **5,59:1**, et sur le survol `#F04A79` rester ≥ 4,5:1.
2. `grep` : plus aucun `bg-rose` accompagné de `text-white` dans `src/`.
3. `npx tsc --noEmit` filtré sur les fichiers touchés : aucune sortie. **23
   erreurs préexistent** dans le module de caisse — hors sujet.
4. ESLint : **52 problèmes**, comme sur `main`, pas un de plus.
5. **180 tests au vert.**
6. `npm run build` réussit.
7. **Contrôle visuel** : les boutons roses restent-ils lisibles et désirables ?
   C'est un changement d'aspect assumé, pas seulement une correction technique —
   c'est l'utilisatrice qui juge.

---

## Réserve honnête

**Ce changement modifie l'apparence de tous les boutons principaux du site.**
Le texte passe de blanc à prune foncé : plus lisible, mais visuellement plus
doux, moins tranché.

Si le rendu déplaît, l'alternative reste ouverte — assombrir le rose vers
`#D42E60` et garder le blanc, ce qui préserve l'aspect actuel au prix d'un écart
avec la palette d'origine. Les deux options atteignent le seuil ; c'est un
arbitrage esthétique, pas technique.
