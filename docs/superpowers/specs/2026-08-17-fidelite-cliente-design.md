# Refonte visuelle — les pages de fidélité

**Date :** 2026-08-17
**Statut :** validé, prêt pour le plan d'implémentation
**Précédent :** [l'espace cliente](2026-08-17-espace-cliente-design.md) — sidebar, « Mes réservations » et « Mon profil », livré et mergé (PR #22 et #24).

---

## Problème

Le lot précédent a refait la sidebar et les deux pages principales de l'espace
cliente. **Les deux pages de fidélité sont restées à l'ancienne charte** — elles
sont pourtant accessibles depuis la même sidebar, à un clic de « Mes
réservations ».

## Objectif

Terminer l'espace cliente visible : la liste des cartes et le détail d'une carte.

---

## Périmètre

| Fichier | Lignes | `brand-*` | `luxury-*` |
|---|---|---|---|
| `src/app/(dashboard)/cliente/fidelite/page.tsx` | 80 | 13 | 3 |
| `src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx` | 134 | 15 | 4 |

**Total : 214 lignes** — le plus court lot de la série.

Reste ensuite `paiement` (355 lignes) et `reservation` (189) pour clore l'espace
cliente.

---

## Décisions

### Le solde de points passe au menthe

Il est aujourd'hui dans un encadré doré (`bg-brand-gold-soft/40 border-2
border-brand-gold`), l'élément le plus voyant de la page.

Retenu : **fond menthe, texte `menthe-deep`.** Le design system réserve le menthe
aux disponibilités, aux **économies** et aux confirmations — des points de
fidélité sont un gain, c'est exactement son domaine.

Écarté : `rose-soft`. Plus proche de l'identité de marque, mais le rose est la
couleur d'**action** ; un grand bloc rose non cliquable induit en erreur.

Écarté aussi : une carte blanche ordinaire. Le solde perdrait sa mise en avant,
alors que c'est l'information principale de la page.

### La pagination de l'historique est branchée

**C'est un défaut fonctionnel, pas de style.** L'API
(`/api/cliente/fidelite/[walletId]`) pagine déjà par tranches de 20 : elle
accepte `page` et `pageSize`, et renvoie `total`. La page déclare ces champs dans
son type — **et ne les utilise jamais.**

Conséquence : au-delà de 20 transactions, une cliente fidèle ne voit jamais son
historique ancien, **et rien ne le lui signale**.

Retenu : un bouton « Voir plus » qui charge la page suivante et l'ajoute à la
liste, plus un compteur « N sur M ». Rien à changer côté serveur.

### Les pages passent au tutoiement

Elles vouvoient (« Vous n'avez encore aucune carte », « Vos points expirent »)
alors que « Mes réservations » et « Mon profil » tutoient depuis le lot
précédent. Une cliente passe de l'un à l'autre dans la même sidebar.

### Les mouvements de points quittent l'ambre et l'émeraude

L'historique colore les gains en `emerald-700` et les retraits en `amber-700` —
deux couleurs hors palette.

| Mouvement | Traitement |
|---|---|
| Gain (`+`) | `menthe-deep` — cohérent avec le solde |
| Retrait (`−`) | `prune` — neutre, ni alarmant ni valorisant |

Un échange de points n'est **pas** une erreur : le rose, seule couleur d'alerte
du système, serait un contresens.

---

## Ce que ce chantier ne touche pas

- **Les calculs de points** : `dinarPerPoint`, `pointsPerDinar`, la conversion en
  millimes, `formatDT` et `fromMillimes`
- `REASON_LABELS` — les **clés** (`EARN_PURCHASE`, `REDEEM_PURCHASE`…) sont des
  valeurs de base de données
- Les appels `/api/cliente/fidelite` et `/api/cliente/fidelite/[walletId]`
- Les règles du programme affichées (minimum d'échange, pourcentage maximum,
  expiration)

---

## Vérification

Aucun test automatisé ne juge un rendu : Vitest tourne en `environment: "node"`
sans jsdom.

1. `grep` : **0** `brand-*` et **0** `luxury-*` dans les deux fichiers.
2. **0** couleur hors palette (`amber`, `emerald`, `gray`…).
3. **0** `shadow`, `gradient`, `blur`.
4. **La pagination fonctionne** : le bouton « Voir plus » charge la suite, le
   compteur reflète le total, et il disparaît quand tout est chargé.
5. `npx tsc --noEmit` filtré sur les deux fichiers : aucune sortie. **23 erreurs
   préexistent** ailleurs — hors sujet.
6. ESLint : **52 problèmes**, comme sur `main`.
7. **180 tests au vert.**
8. `npm run build` réussit.
9. **Contrôle visuel par l'utilisatrice.**

**À savoir pour tester la pagination :** il faut plus de 20 transactions sur une
carte. Sur un jeu de données de test, le bouton n'apparaîtra probablement pas —
c'est le comportement correct, pas une panne.

---

## Réserve honnête

**La pagination est difficile à vérifier sans données.** Le code sera correct,
mais son effet restera invisible tant qu'aucune carte n'aura dépassé 20
transactions.

C'est l'inverse du reste du lot, dont le résultat se voit immédiatement.
