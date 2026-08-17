# Refonte visuelle — lot 5 : fiche offre et calendrier de réservation

**Date :** 2026-08-17
**Statut :** validé, prêt pour le plan d'implémentation
**Précédents :** [lot 1](2026-08-15-refonte-visuelle-lot1-design.md) · [lot 1b](2026-08-15-refonte-visuelle-lot1b-design.md) · [lot 2a](2026-08-15-refonte-visuelle-lot2a-design.md) · [lot 3](2026-08-15-refonte-visuelle-lot3-design.md) · [lot 4](2026-08-15-refonte-visuelle-lot4-design.md)

---

## Problème

`/offre/[id]` garde l'ancienne charte beige/doré/Playfair. C'est la page
d'atterrissage des **liens d'influenceuses** : une visiteuse qui clique depuis
Instagram arrive ici, et peut s'inscrire et réserver sans quitter la page.

## Objectif

Aligner la fiche offre et son calendrier sur le design system, et corriger deux
défauts que le restylage met en évidence.

---

## Périmètre réel : 816 lignes, pas 549

Comme au lot 4, le calendrier vit dans un fichier séparé —
`booking-calendar.tsx`, **267 lignes et 28 classes `brand-*`**. Vérifié : il
n'est importé **que** par la fiche offre, et le lot 4 n'y a pas touché.

Total réel : **816 lignes**.

Le calendrier entre dans ce lot pour la même raison qu'au lot 4 : laissé beige au
milieu du formulaire de réservation, il produirait une rupture immédiatement
visible.

---

## Décisions

### Le rose primaire va au bouton « Réserver »

La page a plusieurs actions : ouvrir le formulaire, basculer entre les onglets
d'authentification, choisir un créneau, valider. Le rose plein va au bouton de
soumission — la conversion — et à lui seul.

L'onglet actif du sélecteur d'authentification est rose, comme dans `RoleTabs`
sur les pages Connexion et Inscription. Ce n'est pas une action concurrente mais
un état de sélection, exactement comme la date choisie dans le calendrier.

### Les onglets sont refaits à la main, pas via `RoleTabs`

**Vérification qui a changé la décision.** Le primitif `RoleTabs` semblait
convenir : deux onglets, apparence identique. La lecture du code montre qu'il est
**inutilisable ici** — son type est `RoleKey = "CLIENT" | "PROVIDER" |
"INFLUENCER"`, et sa liste `ROLE_OPTIONS` est codée en dur avec trois entrées
portant chacune un `registerHref`.

Nos onglets sont « Nouveau client » / « J'ai déjà un compte » : un axe différent,
sans rapport avec les rôles.

Écarté : généraliser `RoleTabs` en `Tabs`. Plus propre à terme, mais cela
modifierait un composant dont dépendent les pages Connexion et Inscription
**déjà livrées et validées** — un risque de régression sur du travail accepté,
pour un seul usage supplémentaire.

Écarté aussi : créer un second primitif. Deux composants presque identiques à
maintenir pour un seul appel.

Retenu : deux boutons restylés sur place, **reprenant l'apparence de
`RoleTabs`** — piste `bg-rose-soft` en pill, onglet actif `bg-rose text-white`,
cible de 44px. Visuellement indistinguable, sans toucher à l'existant.

### Les champs passent par le primitif `Input`

Les quatre champs (nom, téléphone, e-mail, mot de passe) adoptent `Input`, comme
les pages Connexion et Inscription. Bénéfice concret au-delà de la cohérence :
`Input` impose `min-h-[52px]` et `text-base`. Les champs actuels sont en
`text-sm` — **en dessous de 16px, iOS zoome automatiquement au focus** et casse
la mise en page. C'est un défaut réel sur le parcours d'inscription mobile, qui
est précisément celui des visiteuses venues d'Instagram.

`Input` exige un `label` et un `id`. Les champs actuels n'ont que des
`placeholder` — c'est-à-dire aucune étiquette pour un lecteur d'écran, et un
libellé qui disparaît dès qu'on tape. Le passage au primitif corrige les deux.

### La barre fixe mobile est corrigée

Elle utilise aujourd'hui `bottom-[60px]` **en dur, sans la safe-area**. Sur un
iPhone à encoche, elle passe donc sous la barre de navigation.

C'est exactement le défaut corrigé au lot 4. Elle adopte la même géométrie :
`bottom: calc(60px + env(safe-area-inset-bottom))`, `z-40` sous le `z-50` de
`BottomNav`, `md:hidden`.

Le conteneur a déjà `pb-32 md:pb-20` — conservé, il joue le même rôle que le
`pb-40` du lot 4.

### Le calendrier suit le lot 4, avec une différence

Même traitement : disponible en `menthe`, sélectionné en `rose`, indisponible en
gris ; la pastille « disponible » disparaît (redondante sur fond menthe plein) ;
le point « aujourd'hui » passe en rose ; « une date en doré » devient **« une
date en vert »** — le texte décrit une couleur à l'écran.

**La différence :** ce calendrier affiche la **capacité restante** de chaque
créneau (« 3 places », « Complet »). Cette information est conservée. Un créneau
complet reste désactivé et lisiblement distinct.

### Deux corrections au-delà du style

- **Quatre « DT » deviennent « TND »** — prix affiché, prix barré, bouton de
  soumission, barre fixe.
- **`text-gray-400` et `text-red-600`/`bg-red-50`** sortent de la palette. Le
  prix barré passe en `prune-soft`, les erreurs en `rose`.

---

## Architecture

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/app/offre/[id]/offer-client.tsx` | Fiche, formulaire, avis, barre fixe | **Modifier** |
| `src/components/booking-calendar.tsx` | Calendrier mono-service | **Modifier** |

Aucun composant créé, aucun primitif modifié.

### Les interdits localisés

| Interdit | Emplacement |
|---|---|
| `backdrop-blur-md` | `offer-client.tsx:227` — barre de navigation |
| `bg-gradient-to-br` | `offer-client.tsx:240` — fond de l'image |
| `shadow-sm` | `booking-calendar.tsx:163` — jour sélectionné |
| `text-gray-400` | `offer-client.tsx:301` — prix barré |
| `text-red-600` / `bg-red-50` / `border-red-100` | `offer-client.tsx:330` — bloc d'erreur |
| `luxury-image-reveal` | `offer-client.tsx:240` — animation de 1,2 s |

### L'animation d'apparition de l'image est supprimée

`luxury-image-reveal` (ligne 240) n'est pas une couleur mais une **animation** :
`imageReveal 1.2s ease-out`, de `opacity: 0` + `scale(1.04)` vers l'état normal.

Le design system ne prévoit qu'un mouvement, `.ds-press` — un `scale(0.97)` de
120 ms à l'appui. Une apparition d'une seconde et demie au chargement appartient
au vocabulaire de l'ancienne charte « luxe », pas à celui-ci.

Elle est donc retirée. C'est un changement de **comportement perçu**, pas
seulement de style : l'image s'affichera immédiatement au lieu de se révéler.
Signalé explicitement pour que ce soit une décision, pas un effet de bord.

### Les étoiles d'avis

`StarRating` colore les étoiles en `brand-gold`. Elles passent en `rose` pleine
et `hairline` pour les vides. Le composant est **local au fichier** (défini
ligne 45), donc sans effet ailleurs.

---

## Ce que ce lot ne touche pas

La logique doit rester strictement intacte :

- `createBooking` et son `POST /api/bookings` avec `trackingToken`
- `handleBook` : l'enchaînement inscription → `signIn` → `updateSession` →
  réservation, et le `autoVerify: true` qui permet de réserver avant vérification
- Le `useEffect` qui écrit `tracking_ref` dans localStorage — **c'est le
  mécanisme d'attribution des commissions d'influenceuses**
- `slotsByDay`, `availableDates`, `grid`, `canGoPrev` dans le calendrier
- Les états `showBooking`, `authMode`, `selectedPhoto` et la galerie

---

## Vérification

Aucun test automatisé ne juge un rendu : Vitest tourne en `environment: "node"`
sans jsdom. Aucun module pur n'est créé ici.

1. `grep` : **0** classe `brand-*`, **0** `luxury-*`, **0**
   `shadow|gradient|blur`, **0** couleur hors palette, **0** « DT » dans les deux
   fichiers. C'est ce compteur qui fait foi, pas la couverture apparente des
   tâches — au lot 4, un en-tête avait échappé au découpage par sections.
2. `npx tsc --noEmit` filtré sur les deux fichiers : aucune sortie. **23 erreurs
   préexistent** dans le module de caisse — hors sujet, à ne pas corriger.
3. ESLint : aucune erreur nouvelle par rapport à `main`.
4. **180 tests au vert**, aucun ajouté ni supprimé.
5. `npm run build` réussit.
6. **Le parcours d'inscription intégré fonctionne de bout en bout** : une
   visiteuse non connectée choisit un créneau, s'inscrit, et la réservation
   aboutit. C'est le vrai test de ce lot.
7. **L'attribution de tracking survit** : `tracking_ref` toujours écrit en
   localStorage, `trackingToken` toujours envoyé à l'API.
8. La barre fixe ne recouvre pas la navigation sur mobile.
9. **Contrôle visuel par l'utilisatrice**, mobile et desktop.

**Rappel pour le contrôle visuel :** après un seed, les offres sont invisibles —
`seed.ts` écrit `publishedToMarketplace: false` alors que les pages exigent
`true`. Publier temporairement en base pour tester.

---

## Ce que ce lot ne fait pas

- Le bas de l'accueil (lot 6).
- Il ne redimensionne pas les cases du calendrier (~35px, sous les 44px du
  système). Le même défaut existe au lot 4 : sept colonnes dans 272px ne peuvent
  pas donner 44px sans repenser la grille. À traiter une fois pour les deux
  calendriers.
- Il ne corrige pas le contraste `text-white` sur `bg-rose` (2,94:1, sous le
  seuil AA de 4,5:1). Le token vient du lot 1 et concerne **tout le site** —
  décision à prendre séparément.
- Il ne supprime aucun token `brand-*` ni `pos-*`.
- Il ne modifie pas `RoleTabs`.
