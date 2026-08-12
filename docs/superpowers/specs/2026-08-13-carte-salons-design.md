# Carte des salons — géolocalisation et affichage

**Date :** 2026-08-13
**Statut :** validé, prêt pour le plan d'implémentation
**Précédent :** [lot C — profil et horaires](2026-08-12-pos-settings-lot-c-design.md) (livré, PR #6)

---

## Problème

`ProviderProfile` porte des colonnes `lat` et `lng` depuis l'origine du schéma.
**Rien ne les alimente.** Aucun salon n'a de coordonnées.

Conséquence visible : la page publique `/salon/[id]` contient déjà un lien
« Voir sur la carte → » conditionné à `salon.lat && salon.lng`
(`salon-client.tsx:502`). Ce lien n'apparaît jamais. Le code de l'affichage
existe, la donnée manque.

Une cliente qui découvre un salon sur Salonista ne peut donc pas savoir où il se
trouve, sinon en lisant une adresse texte — souvent approximative en Tunisie,
où beaucoup de repères sont informels.

## Objectif

Permettre au salon de placer son emplacement sur une carte depuis la caisse, et
à la cliente de le voir sur une carte depuis la fiche du salon.

## Non-objectifs

- La carte multi-salons `/carte` : sans coordonnées en base, elle serait vide au
  lancement. C'est le lot suivant naturel.
- La recherche par proximité (« salons à moins de 5 km ») : même dépendance, et
  elle demande une requête géospatiale.
- Le géocodage rétroactif des salons existants : ils se placeront eux-mêmes
  depuis la caisse.

---

## Décisions

### Leaflet + OpenStreetMap, sans clé d'API

Écarté : Google Maps et Mapbox. Tous deux offrent de meilleures données en
Tunisie, mais exigent une clé d'API **et une carte bancaire** même au palier
gratuit. Pour une marketplace qui démarre avec quelques salons pilotes, c'est de
l'administratif et un risque de facture pour un bénéfice que les utilisateurs ne
verraient pas encore.

Leaflet pèse ~40 ko, ne demande aucun compte, et les tuiles OSM sont libres. La
couverture OSM en Tunisie est correcte sur Tunis, Sfax et Sousse, plus inégale
ailleurs — d'où la décision suivante, qui rend cette faiblesse supportable.

Si la couverture devenait un problème réel, migrer ne toucherait que les
composants de carte : les coordonnées stockées ne changent pas.

### Géocodage automatique, puis point corrigeable à la main

Le géocodage seul ne suffit pas. « 15 rue de Marseille, Tunis » se résout bien ;
« en face du café Chaabane » non — et c'est une adresse tunisienne courante. Un
point faux qui envoie une cliente à 800 mètres est pire que pas de carte.

Trois chemins vers le point, par ordre de commodité :

1. **Bouton « Localiser »** — envoie `adresse + ville` à Nominatim et place le
   marqueur sur le résultat. Chemin normal.
2. **Glisser le marqueur** — écrase les coordonnées. Recours quand le géocodage
   tombe à côté.
3. **Cliquer sur la carte** — place le marqueur. Utile quand il n'y en a pas
   encore.

Le salon voit immédiatement si le point est juste, au lieu de le découvrir par
une cliente perdue.

### Le géocodage se fait côté client

Le navigateur appelle Nominatim directement, sans route serveur intermédiaire.
Plus simple, et surtout : la charge se répartit sur les utilisateurs au lieu de
se concentrer sur l'IP du serveur, ce que Nominatim n'apprécie pas.

Contrepartie assumée : le `User-Agent` est celui du navigateur, pas un
identifiant Salonista. Si Nominatim finit par limiter, la parade est une route
serveur avec cache — à construire le jour où le problème existe, pas avant.

Nominatim impose **1 requête/seconde**. On ne géocode que sur clic explicite du
bouton, jamais à la frappe, donc la limite ne sera pas approchée. Le bouton se
désactive pendant l'appel.

### Les coordonnées voyagent avec le formulaire

`lat`/`lng` partent dans le même `PUT /api/provider/profile` que le nom et le
téléphone. Pas de route dédiée, pas d'enregistrement séparé : le salon corrige
son adresse et son point, puis clique une fois sur Enregistrer.

### Sans coordonnées, la fiche publique n'affiche pas de carte

Ni carte vide, ni marqueur au milieu de la mer. L'adresse texte et le téléphone
restent visibles comme aujourd'hui. Important au démarrage, puisque aucun salon
n'a encore de coordonnées : la page reste propre.

---

## Architecture

### Fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/lib/coords.ts` | Règle pure : une coordonnée est-elle valide ? | **Créer** |
| `src/lib/coords.test.ts` | Tests de la règle | **Créer** |
| `src/lib/geocode.ts` | Appel Nominatim + normalisation | **Créer** |
| `src/components/map/location-picker.tsx` | Carte éditable, marqueur déplaçable | **Créer** |
| `src/components/map/salon-map.tsx` | Carte en lecture seule | **Créer** |
| `src/components/pos/settings/salon-form.tsx` | Intégrer le picker, envoyer lat/lng | **Modifier** |
| `src/app/api/provider/profile/route.ts` | Accepter et valider lat/lng | **Modifier** |
| `src/app/salon/[id]/salon-client.tsx` | Carte + bouton Itinéraire | **Modifier** |
| `package.json` | `leaflet`, `@types/leaflet` | **Modifier** |

### La validation en fonction pure

Vitest tourne en `environment: "node"`, sans jsdom : les composants de carte ne
sont pas testables dans ce dépôt, mais une règle de validation l'est. Précédents :
`src/lib/offer-publish.ts` (lot B) et `src/lib/booking-conflicts.ts` (lot C),
extraits pour la même raison. **Aucun import Prisma.**

La règle vérifie :

- latitude dans `[-90, 90]`, longitude dans `[-180, 180]` ;
- rejet de `(0, 0)` — le « Null Island » qu'on obtient quand un parsing échoue
  silencieusement. Un salon tunisien s'y retrouverait au large du Ghana ;
- `NaN` et `Infinity` rejetés ;
- `null` accepté comme « pas de point » (les deux doivent être nuls ensemble).

### Le contrat API

`PUT /api/provider/profile` accepte `lat` et `lng` en `Float?`. Les deux sont
validés avant écriture ; un couple invalide renvoie 400. Envoyer `null` efface
le point, ce qui permet à un salon de se retirer de la carte.

### Contraintes Leaflet dans Next 16

- Leaflet manipule le DOM et n'existe pas côté serveur. Les deux composants de
  carte sont importés en `dynamic(() => import(...), { ssr: false })`, avec un
  bloc de la bonne hauteur en attendant. **Sans ça, `window is not defined` fait
  échouer le build** — et `npm run build` est la seule vérification qui l'attrape.
- Le CSS de Leaflet doit être importé, sinon les tuiles s'empilent en vrac. Il
  vient avec le paquet npm, pas de CDN.
- Vérifié : **aucune CSP** n'est définie, ni dans `next.config.ts` ni dans la
  configuration Nginx. Les tuiles OSM se chargeront sans configuration réseau
  supplémentaire. `images.remotePatterns` ne s'applique pas — Leaflet insère ses
  tuiles en `<img>` bruts, hors de `next/image`.

### Cadrage initial de la carte du salon

- Coordonnées existantes → centrage dessus, zoom 16.
- Pas de coordonnées mais une ville → géocodage de la ville seule pour dégrossir.
- Rien du tout → centre de la Tunisie (34°N, 9°E), zoom 6.

### Le bouton Itinéraire

Remplace le lien texte actuel. Cible :
`https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`

Sur mobile, ce format bascule dans l'application de navigation avec l'itinéraire
déjà calculé. C'est le geste réellement voulu : pas « voir un point », mais
« m'y rendre ».

---

## Vérification

**Automatique :** `npm test` (124 aujourd'hui + ceux des coordonnées),
`npx tsc --noEmit`, `npm run lint`, `npm run build`.

Note : `next.config.ts` porte `typescript: { ignoreBuildErrors: true }`, donc le
build ne type-check pas. `npx tsc --noEmit` est le seul filet sur les types.

**Manuelle**, sur PostgreSQL jetable :

1. Salon sans coordonnées → la carte de la caisse s'ouvre sur la Tunisie.
2. Saisir « 15 rue de Marseille » / « Tunis », cliquer **Localiser** → le
   marqueur se place sur Tunis.
3. Glisser le marqueur de quelques rues → les coordonnées suivent.
4. Enregistrer, recharger la page → le point est conservé.
5. Ouvrir `/salon/<id>` → la carte s'affiche avec le marqueur au bon endroit.
6. Cliquer **Itinéraire** → Google Maps s'ouvre avec la destination pré-remplie.
7. Salon **sans** coordonnées → aucune carte sur la fiche publique, adresse et
   téléphone toujours visibles, aucun bloc vide.
8. Adresse introuvable (« zzzz ») → message clair, pas de plantage, marqueur
   inchangé.
9. Sur iPhone : la carte est manipulable au doigt, le marqueur se déplace, la
   page ne défile pas pendant qu'on déplace la carte.
10. `npm run build` réussit — preuve que le `ssr: false` est correct.

---

## Dette assumée

**Le `User-Agent` envoyé à Nominatim est celui du navigateur.** La politique
d'usage de Nominatim demande un identifiant applicatif. On l'accepte parce que le
volume est très faible (un appel par enregistrement de profil, pas par visite).
À revoir si Nominatim limite : route serveur avec cache.

**Aucune limite de débit côté application.** Un salon qui cliquerait « Localiser »
en rafale pourrait dépasser 1 req/s. Le bouton désactivé pendant l'appel rend ça
peu probable ; un vrai *debounce* serait du zèle à ce stade.

**Les tuiles OSM sont chargées depuis `tile.openstreetmap.org`**, sans CDN
intermédiaire. Acceptable au volume actuel ; la politique d'usage d'OSM
tolère un trafic modeste.
