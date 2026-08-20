# Inscription autonome d'un salon

**Date :** 2026-08-20
**Statut :** validé, prêt pour le plan d'implémentation

---

## Le problème

Salonista a deux portes d'entrée pour les salons, et elles répondent à deux
réalités commerciales différentes :

**`/pos-start`** — le commercial est *physiquement dans le salon*, avec sa
tablette. Il va vite : email, nom, un code PIN, la caisse tourne. C'est un
outil de terrain.

**`/register`** — le salon découvre Salonista seul sur internet, à Djerba ou à
Gabès. Personne n'est là pour l'aider. Il doit tout faire lui-même.

**La seconde porte fonctionne déjà techniquement.** Vérifié de bout en bout :
`/register` propose le choix « Salon », `/api/register` crée le
`ProviderProfile`, `getCurrentEmployee()` crée le compte propriétaire à la
première visite, et depuis le chantier « accès sans caisse » un salon sans
module atteint son espace. Les offres créées sont publiées sur la marketplace
par défaut.

**Le problème n'est donc pas technique, il est d'orientation.** Trois trous :

1. **Rien ne mène à l'inscription salon.** Un salon qui arrive par Google
   atterrit sur un feed conçu pour les clientes. Le CTA « Tu as un salon ? »
   existe, mais tout en bas de la page d'accueil.
2. **Après inscription, le salon est lâché dans l'interface de caisse** — un
   outil de comptoir — alors qu'il voulait publier des offres. Rien ne lui dit
   par où commencer.
3. **Aucun chemin vers la caisse.** Un salon convaincu par la marketplace n'a
   aucun moyen de découvrir le module, ni de le demander.

## Objectif

Un salon qui découvre Salonista sur internet comprend la proposition,
s'inscrit seul, publie ses premières offres sans aide — et découvre la caisse
plus tard, quand il est déjà convaincu.

---

## Ce que la lecture du code a établi

- `/api/register` accepte `PROVIDER` et crée le `ProviderProfile`
  (`register/route.ts:59`).
- Il ne crée **ni `SalonEmployee`, ni `SalonSubscription`** — mais
  `getCurrentEmployee()` crée le propriétaire à la volée
  (`employee-session.ts:39`), donc l'accès fonctionne.
- L'absence d'abonnement POS est **le comportement correct** : ce salon n'a pas
  demandé la caisse.
- `Offer.publishedToMarketplace` vaut `true` par défaut dans
  `/api/offers` — une offre créée est visible immédiatement.
- `ProviderProfile.onboardingDismissedAt` **existe déjà** : le guide de
  démarrage peut le réutiliser, sans migration.

---

## Les trois chantiers

### 1. Une page « Vous êtes un salon ? » — `/pro`

Une page d'atterrissage dédiée, celle qu'on met dans Google, sur Instagram et
sur les cartes de visite. Elle répond aux questions qu'un salon se pose :

- **Ce que Salonista apporte** : des clientes qui découvrent le salon, des
  réservations en ligne, un profil public.
- **Comment ça marche** : je m'inscris, je publie mes offres, les clientes
  réservent.
- **Combien ça coûte** : la marketplace est gratuite ; la caisse est un module
  séparé.
- **Un bouton** vers `/register?role=PROVIDER`.

Le CTA existant en bas de l'accueil pointe désormais vers `/pro` plutôt que
directement vers l'inscription : un salon a besoin de comprendre avant de
créer un compte.

Un lien « Espace pro » entre aussi dans la navigation du haut.

### 2. Un guide de démarrage en trois étapes

Sans lui, un salon s'inscrit et ne publie jamais rien — il ne sait pas quoi
faire de l'écran qu'il a sous les yeux.

Une carte en tête de son espace, avec la progression :

| Étape | Faite quand | Mène à |
|---|---|---|
| **Complète ton profil** | adresse, ville et au moins une photo | `/pos/settings` |
| **Ajoute ton premier service** | au moins une offre publiée | `/pos/services` |
| **Définis tes horaires** | `openingHours` renseigné | `/pos/settings` |

Chaque étape est **calculée depuis les données réelles**, jamais depuis un
drapeau posé à la main : un salon qui remplit son profil avant de lire le guide
doit voir l'étape déjà cochée.

La carte disparaît quand les trois étapes sont faites. Un lien « Masquer »
écrit `onboardingDismissedAt` pour ceux qui veulent s'en débarrasser plus tôt.

**Pourquoi les horaires comptent :** sans eux, aucun créneau n'est généré, donc
personne ne peut réserver. Un salon qui publie des offres sans horaires croit
être en ligne alors qu'il est invisible.

### 3. Découvrir la caisse depuis son espace

Une entrée « Activer la caisse » dans l'espace du salon, menant à une page qui
explique le module et permet de le demander.

C'est la stratégie de départ, remise à l'endroit : **la caisse est un plus pour
gagner des salons**, pas un péage à l'entrée. Le salon la découvre quand il est
déjà convaincu par la marketplace.

La demande crée une trace côté admin. Elle n'active rien automatiquement —
l'activation reste une décision commerciale.

---

## Ce que ce chantier ne fait pas

- **Il ne touche pas à `/pos-start`.** L'inscription commerciale reste telle
  quelle : c'est un outil de terrain qui marche.
- **Il ne fusionne pas les deux inscriptions.** Elles servent deux situations
  différentes et doivent le rester.
- **Il n'active aucun module automatiquement.**
- **Il ne change pas le paiement ni les abonnements.**

---

## Vérification

1. Un salon arrive sur `/pro`, comprend l'offre, clique et s'inscrit.
2. Après inscription il voit le guide, avec zéro étape cochée.
3. Il remplit son profil → l'étape se coche **sans qu'il ait à rafraîchir la
   logique** : elle est calculée depuis les données.
4. Il crée une offre → elle apparaît sur la marketplace publique.
5. Il définit ses horaires → des créneaux sont générés, une cliente peut
   réserver.
6. Les trois étapes faites, la carte disparaît.
7. **Un salon inscrit via `/pos-start` ne voit aucun changement** — contrôle de
   non-régression : cette inscription est en production.
8. `npx tsc --noEmit` : **23 erreurs préexistantes**, pas une de plus.
9. ESLint : **51 problèmes** au maximum.
10. **200 tests au vert**, plus ceux ajoutés.

---

## Réserve

Le calcul des étapes du guide est de la logique pure : il **doit** être testé,
c'est le seul endroit testable de ce chantier (Vitest tourne sans jsdom, aucun
composant React n'est testable ici).

Le reste — la page `/pro`, la carte du guide — se vérifie à l'œil et au
parcours réel. Un salon de test inscrit de zéro, sans aide, est le seul
contrôle qui prouve que le parcours tient.
