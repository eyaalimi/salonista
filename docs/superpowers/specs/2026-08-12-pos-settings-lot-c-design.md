# Lot C — Profil du salon et horaires dans la caisse

**Date :** 2026-08-12
**Statut :** validé, prêt pour le plan d'implémentation
**Précédents :** [lot A — portail unique](2026-08-12-pos-portail-unique-design.md) (livré, PR #4) · [lot B — drawer des services](2026-08-12-pos-services-drawer-lot-b-design.md) (livré, PR #5)

---

## Problème

Le lot A a rapatrié le portail prestataire dans la PWA de caisse et remplacé
`/prestataire/profil` par une redirection vers `/pos/settings`. Cette page affiche le
profil **en lecture seule**, avec un bouton « Modifier — bientôt » désactivé.

Conséquence : un salon qui change ses horaires d'été, corrige son numéro de téléphone ou
veut illustrer sa page publique **ne peut plus le faire nulle part**. L'ancienne page
éditable n'existe plus, la nouvelle ne sait pas écrire.

C'est le dernier manque fonctionnel de la consolidation.

## Objectif

Rendre le profil du salon et les horaires d'ouverture modifiables depuis la caisse,
sans quitter la PWA.

## Non-objectifs

- Colab et Store restent verrouillés — décision commerciale (voir lot A).
- `lat` / `lng` : la colonne existe mais rien ne l'alimente ; l'éditer demanderait un
  géocodage. Hors périmètre.
- Aucune refonte de `<OpeningHoursEditor>` : il est réutilisé tel quel.

## Correction de périmètre

Le périmètre annoncé oralement comportait « supprimer le doublon
`/prestataire/fidelite` ». **Ce travail est déjà fait** : le fichier est une redirection
d'une ligne vers `/pos/loyalty`, écrite au lot A. Il n'y a rien à supprimer. Le lot C se
limite donc au profil et aux horaires.

---

## Décisions

### Deux onglets, deux enregistrements séparés

`/pos/settings` présente deux onglets : **Salon** et **Horaires**, chacun avec son
propre bouton *Enregistrer* et son propre appel réseau.

Le découpage suit la réalité du domaine plutôt que l'esthétique. Les champs de profil
sont inoffensifs ; les horaires sont la **seule** donnée dont la modification déclenche
`regenerateAllProviderSlots`, qui recalcule 30 jours de créneaux de réservation.
Les séparer garantit qu'enregistrer un numéro de téléphone ne peut jamais toucher un
rendez-vous, et permet de n'afficher la confirmation de conflits que là où elle a un
sens.

Effet secondaire utile : deux composants d'environ 180 lignes au lieu d'un de 350.

### Neuf champs, pas sept

L'exploration a révélé deux colonnes éditables que le périmètre initial ne mentionnait
pas :

- **`photos`** (`String[]`) — le salon n'a aujourd'hui aucun moyen d'illustrer sa page
  publique depuis la caisse.
- **`receiptFooter`** (`String?`) — le message imprimé en bas des tickets. L'API valide
  déjà sa longueur à 200 caractères.

Les inclure coûte deux champs de formulaire. Les omettre laisserait deux colonnes
inéditables indéfiniment.

Liste complète de l'onglet Salon : `salonName`, `category`, `phone`, `address`, `city`,
`matriculeFiscal`, `description`, `photos`, `receiptFooter`.

### Prévenir avant d'enregistrer, pas après

`regenerateOfferSlots` (lu ligne à ligne) ne supprime que les créneaux **futurs et sans
réservation** (`bookedCount === 0`). Un créneau réservé survit même s'il sort de la
nouvelle grille. **Aucun rendez-vous n'est donc jamais perdu.**

Le risque réel est ailleurs : un salon qui ferme le samedi sans réaliser qu'il a trois
clientes ce samedi-là. Les rendez-vous sont honorés, et le salon l'apprend le jour même.

Avant d'écrire, on compte donc les réservations futures qui tombent hors des nouveaux
horaires. S'il y en a, on affiche la liste et on demande confirmation. S'il n'y en a
aucune — le cas courant — on enregistre directement, sans friction ajoutée.

La formulation dit ce qui se passe vraiment : « Ils seront honorés : vos clientes ont
déjà réservé. Vous devrez ouvrir ce jour-là ou les contacter. » Ni alarmisme, ni silence.

### La règle de conflit sort en fonction pure

Vitest tourne ici en `environment: "node"`, sans jsdom ni testing-library : les
composants React ne sont pas testables dans ce dépôt, mais une règle métier l'est.
« Cette date-heure tombe-t-elle dans ces plages d'ouverture ? » est exactement le genre
de calcul où une erreur de fuseau, de minuit ou de dimanche passe inaperçue à l'œil.

Précédents dans le dépôt : `src/lib/verify-authz.ts` (lot antérieur) et
`src/lib/offer-publish.ts` (lot B), tous deux extraits pour la même raison. On suit le
même découpage.

**La fonction doit s'appuyer sur `generateSlots` de `src/lib/opening-hours.ts`**, qui
encode déjà la logique jour → plages → créneaux. Réimplémenter ce calcul ferait diverger
les deux au premier changement.

---

## Architecture

### Fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/app/(pos)/pos/settings/page.tsx` | Charge le profil, garde `settings.manage`, rend les onglets | Modifier |
| `src/components/pos/settings/salon-form.tsx` | Onglet Salon — 9 champs | Créer |
| `src/components/pos/settings/hours-form.tsx` | Onglet Horaires + dialogue de conflits | Créer |
| `src/lib/booking-conflicts.ts` | Règle pure : réservations hors grille | Créer |
| `src/lib/booking-conflicts.test.ts` | Tests de la règle | Créer |
| `src/app/api/provider/profile/route.ts` | Auth employé + accepter `photos` | Modifier |
| `src/app/api/pos/settings/conflicts/route.ts` | Comptage avant enregistrement | Créer |

### Permissions

`settings.manage` est **OWNER uniquement** (`ROLE_DEFAULTS` dans
`src/lib/permissions.ts`). Un MANAGER ne voit pas cette page — la garde existe déjà dans
`page.tsx` et ne change pas.

### Le piège d'authentification

`/api/provider/profile` refuse tout ce qui n'est pas `session.user.role === "PROVIDER"`.
Or un propriétaire a **deux** façons de se connecter : email/mot de passe (session
PROVIDER, la route marche) ou **code PIN sur la tablette** (session employé, la route
renvoie 401). Le second est le mode normal d'usage de la caisse.

La route bascule donc vers `requirePermission("settings.manage")`, comme les routes
d'offres au lot B. `getCurrentEmployee()` réconcilie les deux modèles ; la permission
fait le tri.

**Vérifié avant décision : la route n'a aucun appelant dans le code.** La page qui
l'utilisait est devenue une redirection au lot A, la route est orpheline depuis. C'est
aussi la seule route qui écrit `openingHours` (l'onboarding POS écrit le profil par son
propre chemin, sans toucher aux horaires). Le changement ne peut donc rien casser.

**Un ajout au contrat** : le `PUT` actuel ne lit pas `photos` alors que la colonne
existe. À ajouter.

### La route de conflits

`GET /api/pos/settings/conflicts?openingHours=<json>` — lecture seule, aucun effet de
bord, donc appelable sans risque à chaque tentative d'enregistrement.

Elle interroge `TimeSlot` (qui porte `startTime` et `bookedCount`) plutôt que `Booking` :
plus direct, et évite de joindre trois tables. Sont retenus les créneaux tels que
`startTime >= maintenant`, `bookedCount > 0`, appartenant à une offre du salon, et dont
`startTime` ne tombe dans aucune plage des nouveaux horaires.

Retour : `{ conflicts: Array<{ startTime: string; offerTitle: string }> }`, trié par
date, pour que le dialogue affiche « sam. 16 août à 10:00 — Coupe femme ».

### Flux d'enregistrement des horaires

1. L'utilisateur modifie les plages, clique *Enregistrer*.
2. `GET /api/pos/settings/conflicts` avec les nouveaux horaires.
3. Zéro conflit → `PUT /api/provider/profile` directement.
4. Au moins un conflit → dialogue listant les rendez-vous → *Annuler* (rien n'est
   écrit) ou *Enregistrer quand même* → `PUT`.
5. Le `PUT` déclenche `regenerateAllProviderSlots` côté serveur, inchangé.

---

## Garde-fous repris des lots précédents

- **Bouton *Enregistrer* désactivé pendant un upload de photo**, via `onUploadingChange`
  de `<ImageUpload>`. Sans lui, un utilisateur rapide enregistre `photos: []` alors que
  le fichier est bien monté (règle 7 de `CLAUDE.md`, bug déjà vécu deux fois).
- **Compteur de caractères sur le pied de ticket** (`0/200`), pour que la limite se voie
  avant le 400 du serveur.

---

## Vérification

**Automatique :** `npm test` (112 tests aujourd'hui + ceux des conflits), `npx tsc
--noEmit`, `npm run lint`, `npm run build`.

**Manuelle**, sur PostgreSQL jetable :

1. Modifier le nom du salon → enregistré, visible sur la page publique.
2. Ajouter une photo → visible sur la page publique du salon.
3. Pied de ticket à 201 caractères → refusé côté UI avant l'appel.
4. Élargir les horaires (ouvrir le samedi) → nouveaux créneaux disponibles à la
   réservation.
5. **Le test qui compte** : créer un rendez-vous samedi, puis fermer le samedi →
   le dialogue annonce ce rendez-vous ; après *Enregistrer quand même*, **le rendez-vous
   existe toujours** et reste visible dans le panneau des RDV.
6. *Annuler* dans le dialogue → aucune écriture, les horaires restent inchangés.
7. Réduire les horaires sans aucun rendez-vous concerné → aucun dialogue, enregistrement
   direct.
8. Se connecter **par PIN en OWNER**, modifier le profil → pas de 401 (c'est le
   changement d'authentification).
9. Un MANAGER n'accède pas à la page (redirection vers `/pos`).
10. Sur iPhone : les deux onglets sont lisibles, l'éditeur d'horaires reste utilisable.

---

## Dette assumée

**`<ImageUpload>` garde ses tokens marketplace** (`brand-gold`, `brand-bordeaux`) au lieu
des tokens POS. Même constat qu'au lot B : le composant est partagé avec les pages
publiques, le paramétrer sortirait du périmètre. La zone de dépôt détonnera légèrement.

**`/api/provider/profile` garde son chemin `provider/`** alors qu'elle devient une route
de caisse. La renommer en `/api/pos/settings` serait plus cohérent, mais casserait
l'historique Git du fichier pour un gain cosmétique. À faire si d'autres routes
`provider/` migrent un jour.
