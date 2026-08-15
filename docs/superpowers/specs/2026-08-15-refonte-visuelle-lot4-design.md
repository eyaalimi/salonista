# Refonte visuelle — lot 4 : fiche salon et calendrier de réservation

**Date :** 2026-08-15
**Statut :** validé, prêt pour le plan d'implémentation
**Précédents :** [lot 1](2026-08-15-refonte-visuelle-lot1-design.md) · [lot 1b](2026-08-15-refonte-visuelle-lot1b-design.md) · [lot 2a](2026-08-15-refonte-visuelle-lot2a-design.md) · [lot 3](2026-08-15-refonte-visuelle-lot3-design.md)

---

## Problème

`/salon/[id]` garde l'ancienne charte beige/doré/Playfair. C'est la page où
l'on réserve — la dernière étape avant la conversion, et la plus visitée après
l'accueil et `/offres`.

## Objectif

Aligner la fiche salon et son calendrier sur le design system, et corriger deux
défauts d'usage réels que le restylage met en évidence.

---

## Correction du périmètre annoncé

Le lot était annoncé à **551 lignes**. C'est faux : le calendrier vit dans un
fichier séparé, `multi-service-calendar.tsx` — **289 lignes et 29 classes
`brand-*`**, dont un `shadow-sm`. Mon estimation initiale l'avait manqué.

Le lot réel fait donc **840 lignes**, le plus gros de la série.

Vérifié avant de décider : `MultiServiceCalendar` n'est importé **que** par la
fiche salon. Son jumeau `BookingCalendar` sert la fiche offre du lot 5, sans
dépendance croisée. Le traiter ici ne casse donc pas le lot 5.

**Décision : le calendrier entre dans ce lot.** Il est encadré par le titre
« Choisir une date » et le panier ; laissé beige, il produirait une rupture bien
plus visible que celle assumée sur l'accueil, où les deux moitiés étaient
séparées par un défilement.

---

## Décisions

### Le rose primaire va à « Confirmer la réservation »

La page a deux familles d'actions concurrentes : sélectionner un service (chaque
carte est un `<button>`) et confirmer. La règle du système impose **une seule
action primaire rose par vue**.

Retenu : le rose va à **Confirmer**, la conversion.

Écarté : mettre les cartes de service en rose. Avec huit services, la page
compterait huit blocs roses et le vrai bouton se noierait.

Un service sélectionné se signale donc par **bordure rose + fond `rose-soft` +
coche**, sans être un bouton rose plein. Le contraste avec l'état non
sélectionné reste net, mais la hiérarchie est préservée.

### Une barre de réservation fixe sur mobile

Aujourd'hui le panier est dans un `<aside>` : sur mobile il tombe **tout en
bas**, sous les services et le calendrier. Une visiteuse qui choisit trois
services ne voit ni son total ni le bouton sans faire défiler jusqu'au bout.

Retenu : quand le panier n'est pas vide, une barre fixe affiche le total et le
bouton Confirmer. Le panier détaillé — réordonner, retirer, notes — reste à sa
place.

**Contrainte technique vérifiée, non négociable :** `BottomNav` est en
`fixed bottom-0 z-50 h-[60px] md:hidden` avec
`padding-bottom: env(safe-area-inset-bottom)`. La barre de réservation doit donc
se poser **au-dessus** d'elle :

- `bottom: calc(60px + env(safe-area-inset-bottom))`
- `md:hidden`, comme la barre de navigation — sur desktop le panier collant
  suffit
- le conteneur de page reçoit un rembourrage bas suffisant, sinon le dernier
  bloc disparaît sous les deux barres

Écarté : remonter le panier au-dessus des services sur mobile. Plus simple, mais
il occuperait la place même vide, et repousserait les services — ce qu'on vient
justement voir.

### Deux correctifs d'usage, au-delà du style

Le restylage les rend visibles ; les laisser serait livrer une page neuve avec
des défauts connus.

- **Les commandes du panier** — flèches ▲▼ pour réordonner, croix ✕ pour retirer
  — font une douzaine de pixels. Elles passent à **44px**, même correctif que le
  menu de compte au lot 3. Le comportement ne change pas, seule la zone
  cliquable grandit.
- **« DT » devient « TND »**, aux **trois** endroits où il apparaît (prix du
  service, ligne du panier, total), comme sur `/offres` au lot 3. Le compte de
  deux, avancé d'abord, venait d'une lecture à l'œil ; `grep` en trouve trois.

### Ce que la carte impose

`SalonMap` rend `<div className="h-56 w-full rounded" />` — un rayon de 4px qui
jurera contre les cartes à 36px. Son squelette de chargement dans la fiche salon
utilise encore `bg-brand-sand`.

Les deux passent au système : `--radius-panel` pour la carte, `rose-soft` pour
le squelette. **Le comportement Leaflet n'est pas touché** — ni le
`scrollWheelZoom: false` (qui évite de piéger le défilement), ni le
`dynamic(..., { ssr: false })` sans lequel le build échoue sur
« window is not defined ».

### Aucun nouveau primitif

`Button`, `Input`, `Chip`, `Badge` et `Card` couvrent tous les besoins. La barre
de réservation fixe est un bloc propre à cette page, pas un composant
réutilisable — le lot 5 aura une structure différente.

---

## Architecture

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/app/salon/[id]/salon-client.tsx` | Fiche, panier, barre fixe | **Modifier** |
| `src/components/multi-service-calendar.tsx` | Calendrier multi-services | **Modifier** |
| `src/components/map/salon-map.tsx` | Rayon du conteneur uniquement | **Modifier** |

### Les quatre interdits à supprimer

Localisés, pas supposés :

| Interdit | Emplacement |
|---|---|
| `backdrop-blur-md` | `salon-client.tsx:239` — barre de navigation |
| `shadow-sm` | `salon-client.tsx:321` — carte de service sélectionnée |
| `shadow-sm` | `multi-service-calendar.tsx:187` — jour choisi |
| `bg-brand-sand` | `salon-client.tsx:18` — squelette de la carte |

### Le calendrier

La légende passe du doré au système : disponible en `menthe`, sélectionné en
`rose`, indisponible en gris. Le texte « Sélectionnez une date en doré » devient
« en vert » — **il décrit une couleur à l'écran, donc il ment si on ne le change
pas**.

**Les cases du calendrier sont trop petites au doigt, et ce lot ne le corrige
pas.** Le chiffre mérite d'être posé, parce qu'il contredit une estimation que
j'avais d'abord donnée à vue d'œil.

Sur un écran de 360px : 360 − 48 (marges de page) − 40 (marges de la carte)
= 272px de large, moins six gouttières de 4px, divisé par sept colonnes ≈ **35px
par case**. Pas 45px comme annoncé initialement. C'est **sous le minimum de
44px** que le système impose partout ailleurs.

Le corriger demanderait de repenser la grille — sept colonnes dans 272px ne
peuvent pas donner 44px sans défilement horizontal, colonnes réduites ou
disposition différente. C'est un travail de conception à part entière, pas un
ajustement de classe.

**Assumé et laissé en dehors du lot**, pour ne pas transformer un restylage en
refonte du calendrier. À traiter séparément — le même problème touchera
`booking-calendar.tsx` au lot 5, donc autant le résoudre une fois pour les deux.

---

## Vérification

Aucun test automatisé ne juge un rendu : Vitest tourne en `environment: "node"`
sans jsdom. Les composants ne sont pas testables, et aucun module pur n'est créé
dans ce lot.

1. `npm run build` réussit ; `npx tsc --noEmit` et ESLint sans erreur nouvelle.
2. `grep` : **aucune** classe `brand-*` dans les trois fichiers, et aucun
   `shadow` / `gradient` / `blur`. Aucun « DT » restant.
3. Les 180 tests restent au vert — aucun test ajouté, aucun supprimé.
4. **La réservation fonctionne toujours de bout en bout** : sélection multiple,
   réordonnancement, choix d'un créneau, envoi. C'est le vrai test de ce lot.
5. **Le brouillon localStorage survit** : `DRAFT_KEY_PREFIX`, le TTL de 7 jours,
   le filtrage des offres disparues et le nettoyage après réservation sont de la
   logique, pas du style. Aucun ne bouge.
6. **La barre fixe ne recouvre pas la barre de navigation** sur mobile, et le
   dernier bloc de la page reste atteignable.
7. **Contrôle visuel par l'utilisateur**, mobile et desktop.

---

## Ce que ce lot ne fait pas

- La fiche offre (lot 5), le bas de l'accueil (lot 6).
- Il ne touche pas `booking-calendar.tsx` — c'est le lot 5.
- Il ne supprime aucun token `brand-*` ni `pos-*` : 142 fichiers en dépendent,
  dont la caisse en production.
- Il ne modifie ni la logique du panier, ni le brouillon localStorage, ni
  l'appel à `/api/bookings`.
- Il ne redimensionne pas les cases du calendrier.
