# Lot B — Drawer d'édition des services dans la caisse

**Date :** 2026-08-12
**Statut :** validé, prêt pour le plan d'implémentation
**Précédent :** [lot A — portail unique](2026-08-12-pos-portail-unique-design.md) (livré, PR #4, `3b1c515`)

---

## Problème

Le lot A a rapatrié le portail prestataire dans la PWA de caisse et supprimé les pages
`/prestataire/offres`. La page `/pos/services` qui les remplace ne sait faire que trois
choses : ajouter un service à la volée, basculer sa TVA, basculer son statut actif.

Sept champs sur neuf sont devenus inatteignables : titre, description, prix, prix barré,
durée, catégorie, photos. Le badge de statut pointe déjà vers `?edit=<id>` mais ce
paramètre est ignoré — le lot A l'avait posé en prévision de ce lot.

Conséquence concrète, remontée par le prestataire pilote après le déploiement :
*« je vois que l'onglet de services on ne peut pas voir modifier un service »*. Un
service créé par l'ajout rapide part publié sur le feed mais sans photo, donc masqué,
et rien dans la caisse ne permet de lui en ajouter une.

## Objectif

Rendre les neuf champs d'un service modifiables depuis la caisse, sans quitter la PWA.

## Non-objectifs

- La suppression de services (voir « Décision : pas de suppression »).
- Le profil du salon et les horaires d'ouverture → lot C.
- La refonte visuelle de `<ImageUpload>` aux tokens POS (voir « Dette assumée »).

---

## Décisions

### Deux sections plutôt qu'un formulaire plat

Le drawer sépare ce dont la caisse a besoin au quotidien de ce qui sert la vitrine
en ligne.

**Section « essentiel »**, toujours visible : titre, prix, durée, TVA, actif. Ce sont
les champs qu'une caissière corrige entre deux clientes.

**Section « Vitrine en ligne »**, repliable : photos, catégorie, prix barré,
description, publication. Elle s'ouvre automatiquement quand il manque une photo,
sinon elle reste repliée. La caissière qui corrige un prix ne la voit jamais ; le
propriétaire qui veut soigner sa page la trouve ouverte quand il y a du travail.

Un en-tête de section porte le même badge à trois états que la liste
(`En ligne` / `Incomplet` / `Hors ligne`), pour que l'état soit lisible section repliée.

### Publication : photo obligatoire, prix barré optionnel

L'API exige aujourd'hui les deux pour publier. Le prix barré devient facultatif : un
salon peut vouloir publier un service à son prix plein, sans promotion. La photo
reste obligatoire — sans elle le service est de toute façon filtré du feed par
`photos: { isEmpty: false }`, et le publier ne produirait qu'un statut mensonger.

Un prix barré **fourni mais inférieur** au prix de vente reste refusé : c'est une
incohérence d'affichage, pas une omission.

### Pas de suppression : désactiver seulement

`BookingItem.offer` porte `onDelete: Cascade`. Supprimer un service détruit
l'historique de réservation qui le référence, et par cascade les Commissions
associées. `SaleItem.offer` porte `onDelete: SetNull`, donc les ventes survivraient —
mais l'asymétrie suffit à écarter la suppression depuis une caisse.

Le drawer offre donc **Désactiver**, en bas à gauche, discret. Un clic bascule
`active: false` : le service quitte la grille de caisse et le feed public,
l'historique reste intact. Pas de confirmation destructrice à écrire.

Corollaire : `DELETE /api/offers/[id]` n'est jamais appelé par le drawer. Voir
« Dette assumée ».

---

## Architecture

### Nouveau fichier : `src/components/pos/service-edit-drawer.tsx`

Environ 350 lignes. Fichier séparé — `services-list-client.tsx` fait déjà 373 lignes
et y ajouter le drawer le rendrait difficile à tenir en tête.

Le modèle est `src/components/pos/customer-detail-drawer.tsx` (487 lignes) : panneau
latéral qui charge lui-même ses données, mode édition, état occupé.

```tsx
<ServiceEditDrawer
  offerId={string}
  onClose={() => void}
  onSaved={(updated: Offer) => void}
/>
```

**Le drawer charge ses propres données** — `GET /api/offers/[id]` au montage, spinner
pendant l'attente. C'est ce qui permet d'ouvrir le drawer depuis une URL collée sans
avoir hydraté la liste au préalable, et garantit des données fraîches même si la liste
en mémoire a dérivé.

**Mise en page.** Panneau latéral droit sur desktop (`md:w-[480px]`), plein écran sur
mobile (`fixed inset-0`), comme le SidePanel corrigé pendant le lot A. Backdrop
cliquable pour fermer.

**Garde-fou upload.** Le bouton *Enregistrer* est désactivé pendant qu'un upload est en
cours, via `onUploadingChange` de `<ImageUpload>`. C'est le correctif d'une race
condition documentée (règle 7 de `CLAUDE.md`) : sans lui, un utilisateur rapide
enregistre `photos: []` alors que le fichier est bien monté.

**Garde-fou publication.** La case *Publier sur salonista.tn* est désactivée quand
`photos.length === 0`, avec la mention « Ajoutez une photo pour publier ». C'est le
pendant client de la validation serveur — l'utilisateur voit pourquoi il ne peut pas
plutôt que de récolter un 400.

### Câblage `?edit=<id>`

Trois chemins convergent sur le même paramètre d'URL :

1. Clic sur une ligne de la liste → `router.push('/pos/services?edit=' + id, { scroll: false })`
2. Clic sur un badge `Photo manquante` / `Hors ligne` → les `<Link>` écrits au lot A
   fonctionnent enfin
3. URL collée ou page rechargée → le drawer s'ouvre au montage

Dans `services-list-client.tsx` :

```tsx
const searchParams = useSearchParams();
const router = useRouter();
const editId = searchParams.get("edit");

{editId && (
  <ServiceEditDrawer
    offerId={editId}
    onClose={() => router.push("/pos/services", { scroll: false })}
    onSaved={(updated) => {
      setOffers((arr) => arr.map((x) => (x.id === updated.id ? updated : x)));
      router.push("/pos/services", { scroll: false });
    }}
  />
)}
```

`onSaved` **patche la ligne localement** au lieu de recharger la liste : la caisse peut
tenir une centaine de services et tourne sur des tablettes lentes.

**`<Suspense>` requis.** `src/app/(pos)/pos/services/page.tsx` est un server component
qui rend `<ServicesListClient>`. Dès que ce dernier appelle `useSearchParams()`,
Next.js 16 exige un `<Suspense>` autour de lui (règle 3 de `CLAUDE.md`). Le fallback
peut être un simple squelette de page.

### API : trois changements dans `src/app/api/offers/[id]/route.ts`

**1. `originalPrice` optionnel à la publication** (bloc `isPublishTransition`,
actuellement lignes 89-96) :

```ts
// Prix barre facultatif : on ne le valide QUE s'il est fourni.
// Un salon peut publier un service au prix plein, sans promotion.
const effOriginal = body.originalPrice ?? offer.originalPrice;
const effDiscount = body.discountPrice ?? offer.discountPrice;
if (effOriginal != null && Number(effOriginal) < Number(effDiscount)) {
  missing.push("prix barré ≥ prix actuel");
}
```

**2. `GET` accepte la session employé.** Le garde d'accès aux offres non publiées
(lignes 26-44) n'autorise que `ADMIN` et `PROVIDER`. Une caissière connectée par PIN
n'a pas de session PROVIDER et reçoit un 404 sur toute offre hors ligne — c'est-à-dire
précisément celles que le drawer sert à corriger. Ajout d'une troisième branche via
`getCurrentEmployee()`, comparant `employee.providerId` à `offer.providerId`.

Aucune permission particulière n'est exigée pour lire : la liste des services est déjà
visible par toute la caisse, une fiche ne révèle rien de plus.

**3. `DELETE` ne bouge pas.** Voir « Dette assumée ».

### Ce qui ne change pas

`PUT` écrit déjà les neuf champs du drawer. `regenerateOfferSlots` se déclenche déjà sur
changement de durée ou passage en publié. Le garde `isPublishTransition` du lot A reste
en place — c'est lui qui permet de basculer la TVA sans que le serveur réclame une photo.

---

## Vérification

**Automatique :** `npm test` (99 tests, doit rester à 99/99) et `npx tsc --noEmit`.

**Manuelle**, sur la base PostgreSQL jetable (Docker, port 5433) avec le jeu de données
du lot A :

1. Ouvrir un service issu de l'ajout rapide (publié, sans photo) → le drawer s'ouvre,
   section Vitrine dépliée, badge `Incomplet`.
2. Corriger le prix, enregistrer → 200, la ligne de la liste se met à jour sans
   rechargement.
3. Ajouter une photo, laisser le prix barré vide, cocher Publier → 200 (c'est le
   changement du point 1 de l'API).
4. Vérifier que le service apparaît sur `/offres`.
5. Décocher Publier, réenregistrer → le service disparaît du feed, badge `Hors ligne`.
6. Sur un service hors ligne, tenter de cocher Publier sans photo → la case est
   désactivée côté UI ; forcer l'appel renvoie 400.
7. Se connecter par PIN en MANAGER, ouvrir un service hors ligne → pas de 404
   (c'est le changement du point 2 de l'API).
8. Coller `/pos/services?edit=<id>` dans un onglet neuf → le drawer s'ouvre chargé.
9. Désactiver un service → il quitte la grille de caisse, l'historique de vente le
   référençant reste consultable.
10. Sur iPhone : le drawer s'affiche plein écran, le rail vertical reste accessible.

---

## Dette assumée

**`DELETE /api/offers/[id]` reste en auth `PROVIDER` seule.** Le lot A a basculé `POST`
et `PUT` vers `requirePermission("products.manage")` pour que les employés PIN puissent
travailler ; `DELETE` a été laissé de côté. Le drawer ayant choisi la désactivation, la
route est morte pour la caisse — la basculer serait du travail pour un chemin que
personne n'emprunte. À traiter si une suppression administrative devient nécessaire,
avec au préalable une décision explicite sur la cascade `BookingItem`.

**`<ImageUpload>` est stylé aux tokens marketplace** (`brand-gold`, `brand-bordeaux`)
et non aux tokens POS. Dans le drawer, la zone de dépôt détonnera légèrement. C'est
cosmétique et le composant est partagé avec les pages publiques ; le retoucher
demanderait de le paramétrer. Hors périmètre du lot B.

---

## Périmètre

Quatre éléments, pas de découpage nécessaire :

1. `service-edit-drawer.tsx` — nouveau fichier, ~350 lignes
2. Câblage `?edit=<id>` + `<Suspense>` dans `services-list-client.tsx` et sa page
3. `originalPrice` optionnel dans la validation de publication
4. `GET /api/offers/[id]` accepte la session employé

Le garde-fou photo côté UI (point 4 de la liste initiale) est intégré au point 1 —
c'est une propriété du drawer, pas un chantier séparé.
