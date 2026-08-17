# Refonte visuelle — l'espace cliente

**Date :** 2026-08-17
**Statut :** validé, prêt pour le plan d'implémentation
**Précédents :** les six lots de refonte visuelle (parcours public), livrés et mergés. Les trois chantiers transverses : contraste et devise mergés, [accessibilité des onglets](2026-08-17-aria-tablist-design.md) poussée.

---

## Problème

La refonte visuelle a couvert le parcours public — accueil, offres, fiche salon,
fiche offre, connexion, inscription. **L'espace cliente est resté à l'ancienne
charte** : Playfair, badges encadrés en majuscules, boutons noirs et dorés.

Une cliente qui réserve voit « Réservation enregistrée » au nouveau design, puis
clique sur « Payer plus tard » et atterrit sur « Mes reservations » à l'ancien.
La rupture est franche, en plein milieu du parcours de conversion.

## Objectif

Aligner le cadre du tableau de bord et les deux pages principales de l'espace
cliente sur le design system.

---

## Périmètre

| Fichier | Lignes | `brand-*` | `luxury-*` |
|---|---|---|---|
| `src/app/(dashboard)/dashboard-layout-client.tsx` | 148 | 16 | 1 |
| `src/app/(dashboard)/cliente/page.tsx` | 334 | 27 | 8 |
| `src/app/(dashboard)/cliente/profil/page.tsx` | 101 | 14 | 2 |

**Total : 583 lignes.**

### Ce qui reste pour un second lot

`paiement` (355 lignes), `reservation` (189), `fidelite` (80 + 134). La page de
paiement est la plus délicate du lot — elle mérite son propre passage.

---

## Décisions

### La sidebar est partagée par les quatre rôles

`dashboard-layout-client.tsx` sert **cliente, prestataire, influenceuse et
admin**. La restyler change donc l'apparence de tous les espaces, pas seulement
celui demandé.

Retenu : **on la restyle quand même.** C'est le cadre visible sur chaque écran
de l'espace cliente ; le laisser à l'ancienne charte produirait des pages neuves
dans un décor ancien, visible en permanence.

Conséquence assumée : les espaces prestataire, influenceuse et admin changent
d'apparence sans avoir été demandés. Leur *contenu* reste inchangé — seul le
cadre bouge.

**Logique à préserver absolument :** le filtrage des entrées de menu par module
d'abonnement actif (`activeModules`). C'est de la logique commerciale — un salon
sans module « Caisse » ne doit pas voir l'entrée correspondante.

### Les accents sont remis

L'espace cliente écrit « Mes reservations », « Confirmees », « Esthetique »,
« Etes-vous sure ». Les pages publiques refaites écrivent « Réservation
enregistrée ». Une cliente passe de l'un à l'autre en un clic.

Retenu : **remettre les accents** sur les textes affichés.

**Ce qui ne change pas :** les valeurs de statut (`PENDING`, `CONFIRMED`,
`COMPLETED`, `CANCELLED`) et les clés de catégorie (`COIFFURE`, `ESTHETIQUE`…).
Ce sont des valeurs de base de données, pas du texte. Les toucher casserait les
filtres et les correspondances.

### La modale d'avis est restylée

La page contient une fenêtre modale — 5 étoiles et un commentaire — qui n'apparaît
pas sur les captures : elle ne s'ouvre que sur une réservation terminée.

Elle porte un `backdrop-blur-sm`, interdit par le design system. Retenu : la
restyler avec la page. Ses étoiles passent en `rose`, comme celles de la fiche
offre.

### Le rose primaire va à « Découvrir les offres »

La page « Mes réservations » compte plusieurs actions : découvrir les offres,
payer, voir le QR code, laisser un avis, annuler. La règle impose **une seule
action rose pleine par vue**.

Retenu : le rose va au bouton d'en-tête **« Découvrir les offres »** — c'est
l'action qui ramène vers la conversion.

Les actions par réservation deviennent secondaires : « Payer » en `prune` plein
(action forte mais répétée par ligne), « QR code » et « Laisser un avis » en
bordure seule.

**« Annuler » reste distinct.** C'est la seule action destructrice de la page ;
elle garde un traitement à part, en bordure, sans jamais devenir rose ni prune.

### Les statuts deviennent des `Badge`

Quatre statuts colorés en ambre, bleu, émeraude et rouge — toutes couleurs hors
palette. Ils passent au primitif `Badge` :

| Statut | Ton | Raison |
|---|---|---|
| En attente | `prune` | neutre, en cours |
| Confirmée | `menthe` | confirmation — usage documenté du menthe |
| Terminée | `menthe` | idem |
| Annulée | `rose` | seule couleur d'alerte du système |

---

## Ce que ce chantier ne touche pas

- **Le filtrage par module d'abonnement** (`activeModules`) dans la sidebar
- `signOut`, la navigation par rôle, `usePathname`
- Les appels API : `/api/client/bookings`, `/api/client/profile`, `/api/reviews`
- La logique de filtre, d'annulation et d'envoi d'avis
- Les valeurs de statut et les clés de catégorie
- Le contenu des espaces prestataire, influenceuse et admin — seul leur cadre
  change

---

## Vérification

Aucun test automatisé ne juge un rendu : Vitest tourne en `environment: "node"`
sans jsdom.

1. `grep` : **0** classe `brand-*` et **0** `luxury-*` dans les trois fichiers.
   C'est ce compteur global qui fait foi — sur trois lots précédents, il a
   rattrapé à chaque fois une section oubliée par le découpage.
2. **0** couleur hors palette (`amber`, `blue`, `emerald`, `red`, `gray`).
3. **0** `shadow`, `gradient`, `blur` — la modale perd son flou.
4. `npx tsc --noEmit` filtré sur les trois fichiers : aucune sortie. **23
   erreurs préexistent** ailleurs, hors sujet.
5. ESLint : **52 problèmes**, comme sur `main`.
6. **180 tests au vert.**
7. `npm run build` réussit.
8. **Les quatre rôles gardent leur menu** : la sidebar affiche toujours les
   bonnes entrées selon le rôle et les modules actifs.
9. **Contrôle visuel par l'utilisatrice** : ses deux pages, plus un coup d'œil
   à l'espace prestataire pour vérifier que le nouveau cadre lui va.

---

## Réserve honnête

**Ce chantier change l'apparence d'espaces que tu n'as pas demandés** —
prestataire, influenceuse, admin — parce qu'ils partagent le même cadre.

C'est le prix d'un composant partagé. L'alternative aurait été de dupliquer la
sidebar pour la cliente seule, ce qui créerait deux composants à maintenir pour
un résultat visuellement identique à terme.
