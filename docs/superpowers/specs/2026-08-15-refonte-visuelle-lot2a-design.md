# Refonte visuelle — lot 2a : le haut du feed d'accueil

**Date :** 2026-08-15
**Statut :** validé, prêt pour le plan d'implémentation
**Précédents :** [lot 1 — fondations et connexion](2026-08-15-refonte-visuelle-lot1-design.md) · [lot 1b — inscription](2026-08-15-refonte-visuelle-lot1b-design.md)

---

## Problème

Les lots 1 et 1b ont refait la connexion et l'inscription, validées par
l'utilisateur. L'accueil garde l'ancienne charte beige/doré/Playfair.

C'est la page que voient les visiteuses en premier, et c'est celle dont
l'utilisateur a fourni une maquette de référence : en-tête wordmark + avatar,
champ de recherche en pill, chips de catégorie à défilement horizontal, cartes
salon avec image, badge menthe « LIBRE 14:00 », note en étoile et ligne
« quartier · catégories · dès N TND ».

## Objectif

Aligner le haut de l'accueil sur le design system, et créer les trois primitifs
`Chip`, `Badge` et `Card` que le reste du site réutilisera.

## Ce que les données permettent réellement

Vérifié dans le schéma avant toute proposition. Les trois éléments de la maquette
ne sont pas au même niveau de disponibilité :

| Élément de la maquette | État réel |
|---|---|
| Badge « LIBRE 14:00 » | Calculable, mais `TimeSlot` est indexé sur `[offerId, startTime]`, pas sur le salon |
| Note « ★ 4,9 » | Pas directement : `Review` porte un `offerId`, jamais un `providerId` |
| « quartier » | **N'existe pas.** `ProviderProfile` n'a que `address` (rue) et `city` |

---

## Décisions

### Le badge de disponibilité : affiché, mais borné

Écarté : le remplacer par une information déjà chargée (« dès 45 TND »). On
perdrait l'urgence commerciale — « libre à 14h » donne envie de réserver
maintenant.

Écarté aussi : une requête par salon. Sur 8 salons ça passe, sur 200 la page
ralentit.

Retenu : **une seule requête groupée**, bornée aux salons affichés, qui récupère
leur prochain créneau libre. Un salon sans créneau n'affiche simplement pas de
badge — jamais de badge mensonger.

**À savoir avant de tester :** les salons de test n'ont probablement aucun
créneau futur. Le badge n'apparaîtra donc sans doute pas au début. C'est le
comportement correct, pas une panne.

### La note en étoile : agrégée depuis les offres

Écarté : ajouter un champ de note sur `ProviderProfile`. Plus propre à terme,
mais demande une migration et une logique de recalcul — disproportionné ici.

Retenu : agréger les avis des offres du salon, et n'afficher l'étoile que s'il
existe au moins un avis.

**Réserve assumée, énoncée à l'utilisateur :** aucun avis n'existe aujourd'hui,
donc aucune étoile ne s'affichera. Le code est correct et s'activera seul dès la
première note. L'alternative — ne rien écrire maintenant — aurait obligé à y
revenir, et l'agrégation sera de toute façon nécessaire.

### Le quartier est remplacé par la ville

Le champ n'existe pas. La ligne devient `{ville} · {catégories} · dès {N} TND`.
L'ajouter demanderait une migration **et** que chaque salon le renseigne — deux
conditions hors de portée d'un lot de design.

### Le lot est coupé en deux

L'accueil fait 411 lignes et onze sections. Tout restyler d'un coup produirait un
diff trop gros pour être relu, et impossible à corriger finement si le rendu
déplaît.

**Lot 2a (celui-ci)** — le haut de page, c'est-à-dire ce que montre la maquette
et ce qu'on voit sans faire défiler : en-tête, recherche, chips, cartes salon et
cartes offre. Plus les trois primitifs.

**Lot 2b (plus tard)** — bannière promo, « Salons près de chez vous », CTA
prestataire et influenceuse, FAQ, footer. Surtout du texte et des liens,
restylables sans nouveau composant.

**La rupture visuelle temporaire est assumée ici**, contrairement au cas
login/inscription : les deux moitiés sont sur la même page et se verront au
défilement. Mais un lot de 411 lignes jugé raté se corrigerait à l'aveugle.

### Rien n'est supprimé de la page

Écarté : restructurer l'accueil selon la seule maquette, ce qui retirerait le CTA
prestataire. C'est le canal d'acquisition des salons — et commercialement,
l'utilisateur commence par eux. Supprimer une section est une décision produit,
pas un choix de design.

---

## Architecture

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/components/ui/chip.tsx` | Chip de catégorie, pill, actif en rose | **Créer** |
| `src/components/ui/badge.tsx` | Badge menthe (disponibilité) et rose (remise) | **Créer** |
| `src/components/ui/card.tsx` | Conteneur de carte, 36px, sans ombre | **Créer** |
| `src/lib/salon-availability.ts` | Choix et formatage du prochain créneau | **Créer** |
| `src/lib/salon-availability.test.ts` | Tests de la règle | **Créer** |
| `src/components/home-nav.tsx` | Wordmark + avatar au nouveau style | **Modifier** |
| `src/app/page.tsx` | Haut de page et requêtes associées | **Modifier** |

### Les trois primitifs

- **`Chip`** — pill, bordure `hairline`, fond blanc ; actif en rose plein.
- **`Badge`** — pill menthe avec texte `menthe-deep`, le menthe pur n'ayant pas
  assez de contraste pour du texte. Variante rose pour les remises.
- **`Card`** — rayon `--radius-card`, fond blanc, **aucune ombre** : elle se
  détache par sa couleur sur le fond crème.

### Le module de disponibilité

Sixième module pur de cette série, après `offer-publish`, `booking-conflicts`,
`coords`, `salon-jsonld` et `offer-jsonld`. Même raison : Vitest tourne en
`environment: "node"` sans jsdom, donc les composants ne sont pas testables, mais
une règle l'est. **Aucun import Prisma.**

Il porte deux décisions vérifiables :

- **quel créneau retenir** parmi tous ceux des offres d'un salon — le plus proche
  dans le futur ayant encore de la capacité ;
- **comment le formater** — « LIBRE 14:00 » si c'est aujourd'hui,
  « LIBRE DEMAIN 9:00 » sinon, comme dans la maquette.

### La carte salon

```
┌────────────────────────────┐
│      [ image du salon ]    │
│  ╭──────────────╮          │
│  │ LIBRE 14:00  │          │  ← badge menthe, sur l'image
│  ╰──────────────╯          │
├────────────────────────────┤
│  Studio Nour        ★ 4,9  │
│  Tunis · Coiffure · dès    │
│  65 TND                    │
└────────────────────────────┘
```

Les cartes offre gardent leur rail horizontal : mêmes données, nouveau style.

---

## Vérification

Rien n'est testable automatiquement côté rendu : pas de jsdom, et aucun test ne
dit si une page est réussie. Seul le module de disponibilité a des tests.

1. `npm run build` réussit ; `npx tsc --noEmit` et ESLint sans erreur nouvelle.
2. `grep` sur les parties migrées : aucun `shadow`, `gradient` ou `blur`.
3. Les tests existants restent au vert, plus ceux du nouveau module.
4. **Non-régression SEO** : les trois blocs JSON-LD de bas de page (`WebSite`,
   `Organization`, `FAQPage`) sont **intacts** — ils viennent d'être construits.
5. Un salon sans créneau libre n'affiche **pas** de badge ; un salon sans avis
   n'affiche **pas** d'étoile.
6. **Contrôle visuel par l'utilisateur**, sur mobile et desktop.

---

## Ce que ce lot ne fait pas

- Le bas de l'accueil (lot 2b), les fiches salon, les fiches offre, la caisse.
- Il ne supprime aucun token `brand-*` ni `pos-*` — 142 fichiers en dépendent,
  dont la caisse en production.
- Il ne supprime aucune section de la page.
- Il n'ajoute ni champ `quartier` ni note de salon en base.
