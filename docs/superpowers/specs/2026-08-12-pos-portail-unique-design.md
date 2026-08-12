# Portail unique prestataire — Lot A : Navigation

**Date :** 2026-08-12
**Statut :** validé, prêt pour plan d'implémentation

---

## Contexte

Salonista sert trois rôles : CLIENT, INFLUENCER, PROVIDER. La stratégie commerciale
donne la priorité au PROVIDER (propriétaire de salon) : c'est lui qui paie, et c'est
par lui qu'on acquiert les deux autres.

Aujourd'hui le prestataire vit dans **deux portails distincts** avec deux side-bars :

| Portail | Auth | Entrées |
|---|---|---|
| `/prestataire` | email + mot de passe | Dashboard, Caisse, Fidélité, Mes offres, Réservations, Collaborations, Mon profil |
| `/pos` | PIN employé | Caisse, RDV, Services, Clients, Produits, Ventes, Tiroir, Fidélité, Commissions, Équipe, Stats |

Modifier un service depuis la caisse renvoie sur `/prestataire/offres/[id]`, avec une
side-bar différente et une identité visuelle différente. Le prestataire ne comprend
pas qu'il s'agit du même produit.

**Objectif :** la PWA POS devient le portail unique du prestataire. Plus aucun renvoi
vers `/prestataire`.

## Découpage en lots

Le chantier complet touche environ 2500 lignes. Le livrer d'un bloc ferait courir un
risque de régression sur la caisse pendant que les premiers salons l'utilisent en
production. Trois lots, chacun laissant l'application dans un état cohérent :

| Lot | Contenu | Effet visible |
|---|---|---|
| **A** *(ce spec)* | Rail 3 groupes, Collab + Store teasers, redirections, publication par défaut | Un seul portail visible |
| **B** | Fusion `/pos/services` + édition complète (photos, description, marketplace) dans un drawer, **plus la validation de publication côté UI** (cf. §3) | Plus besoin de sortir du POS pour éditer une offre |
| **C** | `/pos/settings` (profil salon + horaires), suppression du doublon fidélité | `/prestataire` entièrement vidé |

## Contrainte d'authentification — non bloquante

`getCurrentEmployee()` ([src/lib/employee-session.ts:18](../../../src/lib/employee-session.ts))
accepte déjà une session PROVIDER email/mot de passe et résout automatiquement la
ligne `SalonEmployee` de rôle OWNER, en la créant si elle n'existe pas.

**Conséquence :** les pages `/pos` fonctionnent déjà pour un prestataire connecté sans
PIN. Ce lot est un chantier de routage et de navigation, pas d'authentification.
Aucune modification de `src/lib/auth.ts` ni de `src/middleware.ts` n'est nécessaire.

---

## 1. Le rail

### Structure

Quinze entrées en trois groupes séparés par un trait fin, plus un groupe verrouillé.
Le séparateur existe déjà dans le rail actuel.

| Groupe | Entrées |
|---|---|
| CAISSE | Caisse, RDV, Clients |
| CATALOGUE | Services, Produits |
| GESTION | Ventes, Tiroir, Fidélité, Commissions, Équipe, Stats, Profil |
| VERROUILLÉ | Collab 🔒, Store 🔒 |

Changements par rapport à l'existant : `Clients` remonte dans CAISSE (usage quotidien
de la caissière), `Profil` apparaît (page minimale au lot A, complète au lot C),
`Collab` et `Store` s'ajoutent avec un cadenas.

### Rail vertical sur toutes les tailles

La bottom-bar horizontale mobile introduite au commit `9bf1594` est **abandonnée** :
le test sur iPhone a montré qu'elle n'est pas confortable. Retour au rail vertical
latéral, avec une largeur et un affichage de libellés adaptatifs.

| | Mobile (`< md`) | Desktop (`≥ md`) |
|---|---|---|
| Largeur | 56px | 80px |
| Libellés | masqués (`sr-only`) | visibles sous l'icône |
| Icônes | 22px | 20px |
| Zone tactile | 56 × 48px | 64 × 56px |
| Scroll | vertical | vertical |

Le libellé reste dans le DOM en `sr-only` sur mobile : les lecteurs d'écran et
l'attribut `title` (tap long) continuent de fonctionner.

`safe-area-inset-bottom` reste appliqué en bas du rail pour l'encoche iPhone.

### Verrouillage

Le type `RailItem` gagne un champ optionnel :

```ts
type RailItem = {
  href: string;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
  perm?: Permission;
  locked?: boolean;   // ← nouveau
};
```

Une entrée verrouillée :
- se rend en `opacity-50` avec un badge `Lock` superposé à l'icône ;
- reste **cliquable** et mène à sa page teaser ;
- **ignore le filtre de permission** — tout le monde doit voir l'offre commerciale,
  pas seulement le OWNER.

Approche retenue parmi trois : un flag booléen sur l'entrée, plutôt qu'un composant
séparé (duplication du style actif/hover) ou un pilotage par `getActiveModules()`
(demanderait des valeurs d'enum `SubscriptionModule` et une migration Prisma pour
des fonctionnalités qui n'existent pas encore — prématuré). Le jour où Collab est
livrable, on retire une propriété et on bascule vers les modules.

### Conséquence sur la barre panier

La barre panier flottante (commit `57cf250`) n'est plus gênée par la bottom-bar.
Elle se recale au-dessus du bas de l'écran, décalée de 56px vers la droite pour
laisser le rail visible.

---

## 2. Les pages

### `/pos/collab` et `/pos/store` — teasers verrouillés

Un composant partagé `<LockedFeaturePage>` paramétré par titre, accroche, liste
d'arguments et image d'aperçu.

```
┌─────────────────────────────────────────┐
│  🔒 BIENTÔT DISPONIBLE                  │
│                                         │
│  Collaborations influenceuses           │
│                                         │
│  Recevez des propositions de            │
│  créatrices de contenu locales et       │
│  ne payez qu'à la réservation           │
│  effective.                             │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  [aperçu de l'interface, flouté]  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ✓ Une seule commission par conversion  │
│  ✓ Suivi des clics et réservations      │
│  ✓ Aucun engagement mensuel             │
│                                         │
│      [ Être prévenu au lancement ]      │
└─────────────────────────────────────────┘
```

**Aperçu :** capture statique dans `public/images/teaser-collab.webp` et
`teaser-store.webp`, rendue avec `blur-sm` et un dégradé. Pas de fausse interface
interactive — on ne fait pas croire que c'est cliquable.

**Bouton « Être prévenu » :** `POST /api/pos/interest` avec `{ feature }`. Donne une
liste d'attente qualifiée avant d'avoir codé la fonctionnalité — signal de
priorisation pour choisir entre Collab et Store.

Après clic, le bouton devient un état inerte « Vous serez prévenu·e ✓ ». L'état est
rechargé au montage via `GET /api/pos/interest` pour survivre à un rafraîchissement.

### Redirections `/prestataire/*` → `/pos/*`

Chaque route devient un `page.tsx` de trois lignes appelant `redirect()` de
`next/navigation` — redirection 307 côté serveur, sans flash de contenu.

| Depuis | Vers |
|---|---|
| `/prestataire` | `/pos` |
| `/prestataire/fidelite` | `/pos/loyalty` |
| `/prestataire/reservations` | `/pos/calendar` |
| `/prestataire/collaborations` | `/pos/collab` |
| `/prestataire/offres` | `/pos/services` |
| `/prestataire/offres/[id]` | `/pos/services?edit=<id>` |
| `/prestataire/profil` | `/pos/settings` |

Les redirections permanentes sont préférées à la suppression : les liens déjà envoyés
par email aux salons pilotes, les favoris et l'indexation continuent de fonctionner.

**Deux cibles n'existent pas encore.** Pour ne livrer aucune 404 :

- `/pos/settings` est créée au lot A comme page minimale affichant le profil du salon
  en lecture seule, avec un bouton « Modifier » désactivé portant la mention
  « Bientôt ». La page complète arrive au lot C.
- `?edit=<id>` est ignoré par `/pos/services` au lot A. Le drawer arrive au lot B.

Aucune impasse pour l'utilisateur dans les deux cas.

### Liens sortants à corriger

Quatre occurrences dans [src/components/pos/services-list-client.tsx](../../../src/components/pos/services-list-client.tsx)
(lignes 269, 276, 330, 337) pointent vers `/prestataire/offres/${o.id}`. Elles
deviennent `/pos/services?edit=${o.id}`.

C'est le seul fichier du POS qui fuit vers l'ancien portail — vérifié par
`grep -rn "/prestataire" src/components/pos/ src/app/(pos)/`.

---

## 3. Publication marketplace par défaut

### Décision

Le prestataire n'ayant plus que ce portail, un service créé dans la caisse doit
partir sur le feed Salonista **sans action supplémentaire**. La publication devient
l'intention par défaut ; la complétude conditionne la visibilité, pas la création.

`POST /api/offers` passe de `publishedToMarketplace = false` à `true` par défaut.

### Lever le blocage de validation

[src/app/api/offers/route.ts:102-112](../../../src/app/api/offers/route.ts) rejette
aujourd'hui toute création publiée sans catégorie, prix barré et photo. Avec la
publication par défaut, l'ajout rapide (nom + prix + durée + TVA) échouerait en 400
avec `Champs requis manquants : catégorie, prix barré, au moins une photo`.

La validation devient progressive :

- `category` retombe sur `AUTRE` quand elle est absente (comportement déjà en place
  pour les créations non publiées) ;
- `originalPrice` reste nullable — le feed n'affiche alors pas de prix barré ;
- l'absence de photo n'empêche plus la création, elle masque l'offre du feed.

**Vigilance :** cette route sert aussi le formulaire complet de `/prestataire/offres`,
qui comptait sur la validation stricte pour empêcher une publication bâclée. Ce
formulaire devient inatteignable au lot A (redirigé vers `/pos/services`), donc
l'assouplissement ne dégrade rien dans l'immédiat.

Le garde-fou est **reporté au lot B**, où il est réimplémenté côté UI dans le drawer
d'édition : validation client et bouton de publication désactivé tant que la photo
manque. L'API reste permissive, l'UI guide. C'est cohérent avec le badge
d'incomplétude décrit ci-dessous.

### Badge de statut

Le badge de la liste des services porte l'action de complétion plutôt que celle de
publication :

| État | Badge desktop | Badge mobile | Cible du clic |
|---|---|---|---|
| Publié + photo | `En ligne` (vert) | `En ligne` | — |
| Publié, sans photo | `Ajouter une photo` (ambre) | `Photo manquante` | `?edit=<id>` |
| Dépublié | `Hors ligne` (gris) | `Hors ligne` | `?edit=<id>` |

Au lot A le clic ne produit rien de visible ; au lot B il ouvre le drawer sur la
section photos.

### Filtre de visibilité du feed public

Le badge n'est honnête que si le feed masque réellement les offres sans photo.
Quatre requêtes alimentent les surfaces publiques :

| Fichier | Ligne | Action |
|---|---|---|
| [src/app/api/offers/route.ts](../../../src/app/api/offers/route.ts) | 36 | ajouter `photos: { isEmpty: false }` |
| [src/app/page.tsx](../../../src/app/page.tsx) | 30 | ajouter `photos: { isEmpty: false }` |
| [src/app/offres/page.tsx](../../../src/app/offres/page.tsx) | 37 | ajouter `photos: { isEmpty: false }` |
| [src/app/salon/[id]/page.tsx](../../../src/app/salon/[id]/page.tsx) | 17 | ajouter `publishedToMarketplace: true` **et** `photos: { isEmpty: false }` |

`isEmpty` est l'opérateur Prisma sur les champs scalaires en liste ; `photos` est un
`String[]`, donc pas de jointure.

**Bug préexistant corrigé au passage :** la page salon filtre uniquement sur
`active: true`, sans `publishedToMarketplace`. Les services POS-only y fuient déjà
aujourd'hui. Avec la publication par défaut, tous les services de caisse s'y
afficheraient — la correction devient bloquante.

### Services existants — aucune migration de données

Les services créés avant ce changement ont `publishedToMarketplace: false`. Les
basculer d'office publierait sans prévenir des services que le prestataire avait
délibérément gardés en interne.

**Ils ne sont pas touchés.** Ils affichent le badge `Hors ligne`, cliquable pour
publier au cas par cas. Seuls les nouveaux services sont publiés par défaut.

---

## 4. Modèle de données

Un seul modèle ajouté, pour la liste d'attente des fonctionnalités verrouillées :

```prisma
model FeatureInterest {
  id         String   @id @default(cuid())
  providerId String
  feature    String   // "COLLAB" | "STORE"
  createdAt  DateTime @default(now())

  provider ProviderProfile @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@unique([providerId, feature])
  @@index([feature])
}
```

`ProviderProfile` gagne la relation inverse `featureInterests FeatureInterest[]`.

**`feature` en `String` plutôt qu'en enum :** ces valeurs bougeront au gré des idées
produit, et une migration Prisma pour ajouter une option de teasing serait
disproportionnée.

**`@@unique([providerId, feature])` :** un clic répété ne crée pas de doublon. Le POST
utilise un `upsert` et renvoie 200 dans les deux cas.

Migration : `20260812_feature_interest`. Aucune migration de données.

---

## 5. Périmètre

### Inclus dans le lot A

- Rail : 3 groupes, 15 entrées, vertical sur toutes tailles, largeur adaptative
- Champ `locked` sur `RailItem` et son rendu
- `/pos/collab` et `/pos/store` via `<LockedFeaturePage>`
- `/pos/settings` en lecture seule
- `POST` / `GET /api/pos/interest`
- Modèle `FeatureInterest` + migration
- 7 redirections `/prestataire/*`
- 4 liens corrigés dans `services-list-client.tsx`
- `publishedToMarketplace: true` par défaut + validation assouplie
- Badge de statut à trois états
- Filtre `photos: { isEmpty: false }` sur 4 surfaces publiques + correction du bug
  `/salon/[id]`

### Explicitement hors lot A

- Drawer d'édition complète des services → **lot B**
- Page profil complète avec horaires d'ouverture → **lot C**
- Suppression du doublon `/prestataire/fidelite` → **lot C**
- Suppression des fichiers `/prestataire/*` (seules les redirections sont posées)
- Fonctionnalités Collab et Store elles-mêmes (seuls les teasers sont livrés)
- Bascule du verrouillage vers `getActiveModules()`
- Portails `/cliente` et `/influenceuse` — intouchés

---

## 6. Vérification

Le lot est livrable quand :

1. Aucune occurrence de `/prestataire` dans `src/components/pos/` et `src/app/(pos)/`
   (`grep -rn`)
2. Les 7 URLs `/prestataire/*` redirigent en 307 vers leur cible
3. Le rail affiche 15 entrées en 3 groupes, à 56px sur mobile et 80px sur desktop
4. Collab et Store sont visibles, grisées, cliquables, et mènent à leur teaser
5. « Être prévenu » écrit une ligne `FeatureInterest` ; un second clic ne duplique pas
6. Un service créé par l'ajout rapide a `publishedToMarketplace: true` et porte le
   badge ambre `Ajouter une photo`
7. Ce même service **n'apparaît pas** sur `/`, `/offres` ni `/salon/[id]`
8. Après ajout d'une photo, il apparaît sur les trois surfaces et le badge passe au
   vert `En ligne`
9. Un service antérieur au changement garde `publishedToMarketplace: false` et le
   badge `Hors ligne`
10. `npx tsc --noEmit` ne remonte aucune erreur nouvelle sur les fichiers touchés
    (les erreurs Prisma préexistantes du client local corrompu sont attendues —
    voir règle 7 de CLAUDE.md)
