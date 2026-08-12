# Carte des salons — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au salon de placer son emplacement sur une carte depuis la caisse, et à la cliente de le voir sur une carte depuis la fiche publique du salon.

**Architecture:** Leaflet + tuiles OpenStreetMap, sans clé d'API. Deux composants de carte — un éditable (marqueur déplaçable, bouton « Localiser » qui interroge Nominatim) et un en lecture seule. Les coordonnées voyagent dans le `PUT /api/provider/profile` existant. La validation des coordonnées sort en fonction pure testable, comme `offer-publish.ts` et `booking-conflicts.ts` avant elle.

**Tech Stack:** Next.js 16.2 (App Router), React 19, Leaflet 1.9.4, Tailwind v4, Prisma 7, Vitest (environnement `node`).

**Spec:** [docs/superpowers/specs/2026-08-13-carte-salons-design.md](../specs/2026-08-13-carte-salons-design.md)

---

## Contexte pour l'ingénieur

**Salonista** est une marketplace beauté tunisienne (`salonista.tn`). Les salons
gèrent leur activité depuis une PWA de caisse (routes `/pos`) ; les clientes
consultent des fiches publiques (`/salon/[id]`).

`ProviderProfile` porte des colonnes `lat` et `lng` depuis l'origine du schéma,
mais **rien ne les alimente**. La fiche publique contient déjà un lien « Voir sur
la carte » conditionné à `salon.lat && salon.lng` — il n'apparaît jamais. Le code
d'affichage existe, la donnée manque. C'est ce chantier qui la crée.

**Huit choses à savoir avant de toucher au code :**

1. **Leaflet n'existe pas côté serveur.** Il manipule le DOM directement. Tout
   composant qui l'importe doit être chargé via
   `dynamic(() => import(...), { ssr: false })`. Sans ça, le build échoue sur
   `window is not defined`. **`next/dynamic` n'est utilisé nulle part ailleurs
   dans ce dépôt** — tu es le premier, ne cherche pas d'exemple existant.

2. **`npm run build` est la seule vérification qui attrape cette erreur.**
   `tsc` ne la voit pas. Ne saute pas le build.

3. **`next.config.ts` porte `typescript: { ignoreBuildErrors: true }`.** Le build
   de production ne type-check pas. `npx tsc --noEmit` est donc le seul filet sur
   les types — lance-le explicitement.

4. **Vitest tourne en `environment: "node"`**, include `src/**/*.test.ts(x)`.
   **Ni jsdom ni @testing-library/react** dans ce dépôt, et ce plan n'en ajoute
   pas. Seule la Task 2 est en TDD, sur de la logique pure. Les composants de
   carte sont vérifiés par `tsc`, ESLint, le build et la checklist manuelle.

5. **Deux modèles d'authentification coexistent.** Un propriétaire se connecte par
   email/mot de passe (session `PROVIDER`) ou par code PIN sur la tablette
   (session employé). `getCurrentEmployee()` réconcilie les deux. La route profil
   utilise déjà `requirePermission("settings.manage")` — tu n'as pas à y toucher.

6. **L'UI est en français.** Libellés, messages d'erreur, et les commentaires de
   code dans les fichiers POS.

7. **Aucune CSP** n'est définie, ni dans `next.config.ts` ni dans Nginx (vérifié).
   Les tuiles OSM se chargeront sans configuration réseau supplémentaire.
   `images.remotePatterns` ne s'applique pas : Leaflet insère ses tuiles en
   `<img>` bruts, hors de `next/image`.

8. **Nominatim impose 1 requête/seconde** et on ne l'appelle que sur clic explicite
   du bouton « Localiser », jamais à la frappe.

**Commandes :**

```bash
npm test              # vitest run — 124 tests aujourd'hui
npx tsc --noEmit      # typecheck (seul filet, cf. point 3)
npm run lint          # ESLint
npm run build         # build de production
npm run dev           # serveur de dev (port 3000)
```

**Erreurs `tsc` pré-existantes :** 23 erreurs réparties sur **deux fichiers**,
`src/components/pos/onboarding/wizard-client.tsx` et
`src/lib/rewards/rewards.test.ts`. Elles ne sont pas les tiennes ; ne les corrige
pas, confirme seulement qu'il ne s'en ajoute pas d'autres.

**Attention environnement :**
- Un conteneur Docker `users-service` occupe parfois le **port 3000**. Vérifie
  avec `docker ps` avant `npm run dev`.
- `npm run build` prérend `/` et `/sitemap.xml`, qui interrogent la base. Si
  PostgreSQL ne tourne pas, le build échoue sur `ECONNREFUSED localhost:5433`
  **avant** d'atteindre tes pages — ce qui masquerait une vraie erreur. Voir la
  Task 8 pour démarrer une base jetable.

---

## Structure des fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `package.json` | Ajouter `leaflet` + `@types/leaflet` | **Modifier** |
| `src/lib/coords.ts` | Règle pure : une coordonnée est-elle valide ? | **Créer** |
| `src/lib/coords.test.ts` | Tests de la règle | **Créer** |
| `src/lib/geocode.ts` | Appel Nominatim + normalisation | **Créer** |
| `src/components/map/marker-icon.ts` | Icône SVG partagée par les deux cartes | **Créer** |
| `src/components/map/location-picker.tsx` | Carte éditable, marqueur déplaçable | **Créer** |
| `src/components/map/salon-map.tsx` | Carte en lecture seule | **Créer** |
| `src/app/api/provider/profile/route.ts` | Accepter et valider `lat`/`lng` | **Modifier** |
| `src/app/(pos)/pos/settings/page.tsx` | Charger `lat`/`lng` dans le `select` | **Modifier** |
| `src/components/pos/settings/salon-form.tsx` | Intégrer le picker, envoyer les coords | **Modifier** |
| `src/app/salon/[id]/salon-client.tsx` | Carte + bouton Itinéraire | **Modifier** |

Deux composants de carte séparés plutôt qu'un seul paramétré : l'éditable porte
la logique de géocodage et de glisser-déposer (~150 lignes), le lecteur seul est
trivial (~60 lignes). Les fusionner donnerait un composant à double personnalité
dont la moitié du code serait morte dans chaque usage.

---

## Task 0 : Créer la branche et installer Leaflet

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1 : Vérifier que l'arbre est propre et à jour**

```bash
git status --short
git checkout main
git pull
```

Attendu : `git status --short` ne renvoie rien. Si l'arbre est sale, arrête-toi et
signale-le.

- [ ] **Step 2 : Créer la branche**

```bash
git checkout -b salon-map
```

Attendu : `Switched to a new branch 'salon-map'`

- [ ] **Step 3 : Installer Leaflet**

```bash
npm install leaflet@1.9.4
npm install --save-dev @types/leaflet
```

Attendu : installation sans erreur. `leaflet` en dépendance de production,
`@types/leaflet` en dépendance de développement.

- [ ] **Step 4 : Vérifier que rien n'est cassé**

```bash
npm test
npx tsc --noEmit
```

Attendu : **124 tests** passants en 8 fichiers ; aucune nouvelle erreur `tsc`
(seules les 23 pré-existantes dans les deux fichiers connus).

- [ ] **Step 5 : Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: ajouter leaflet pour la carte des salons"
```

---

## Task 1 : Ajouter lat/lng au contrat de l'API profil

**Pourquoi d'abord.** Les tâches suivantes envoient des coordonnées à cette route.
Si elle ne les accepte pas, on ne peut rien vérifier de bout en bout.

**Files:**
- Modify: `src/app/api/provider/profile/route.ts`

- [ ] **Step 1 : Lire le fichier**

```bash
cat "src/app/api/provider/profile/route.ts"
```

Repère le `PUT` : il destructure le corps, valide `openingHours` et
`receiptFooter`, puis appelle `prisma.providerProfile.update`.

- [ ] **Step 2 : Ajouter `lat` et `lng` au destructuring**

Dans le `PUT`, ajoute les deux champs à la liste destructurée, après `phone` :

```ts
  const {
    salonName,
    category,
    description,
    address,
    city,
    phone,
    lat,
    lng,
    photos,
    openingHours,
    matriculeFiscal,
    receiptFooter,
  } = body;
```

- [ ] **Step 3 : Valider le couple de coordonnées**

Juste après le bloc de validation de `receiptFooter` (celui qui vérifie
`length > 200`) et **avant** l'appel `prisma.providerProfile.update`, insère :

```ts
  // lat et lng vont toujours ensemble : soit un point complet, soit aucun.
  // Un seul des deux renseigne un demi-point, qu'aucun affichage ne sait
  // utiliser (la fiche publique teste `lat && lng`).
  const latFourni = lat !== undefined && lat !== null;
  const lngFourni = lng !== undefined && lng !== null;
  if (latFourni !== lngFourni) {
    return NextResponse.json(
      { error: "Latitude et longitude doivent être fournies ensemble" },
      { status: 400 },
    );
  }
  if (latFourni && lngFourni) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (
      !Number.isFinite(latNum) ||
      !Number.isFinite(lngNum) ||
      latNum < -90 ||
      latNum > 90 ||
      lngNum < -180 ||
      lngNum > 180
    ) {
      return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 });
    }
  }
```

- [ ] **Step 4 : Écrire les coordonnées**

Dans l'objet `data` de `prisma.providerProfile.update`, ajoute après `phone` :

```ts
      ...(lat !== undefined ? { lat: lat === null ? null : Number(lat) } : {}),
      ...(lng !== undefined ? { lng: lng === null ? null : Number(lng) } : {}),
```

L'étalement conditionnel préserve le comportement établi du fichier : un champ
absent du corps n'est pas touché, un champ à `null` efface la valeur — ce qui
permet à un salon de se retirer de la carte.

- [ ] **Step 5 : Vérifier**

```bash
npx tsc --noEmit
npx eslint "src/app/api/provider/profile/route.ts"
npm test
```

Attendu : aucune erreur sur ce fichier, 124 tests passants.

- [ ] **Step 6 : Commit**

```bash
git add "src/app/api/provider/profile/route.ts"
git commit -m "feat(carte): l'API profil accepte lat et lng

Les deux vont ensemble : un demi-point n'est affichable nulle part,
la fiche publique teste lat && lng."
```

---

## Task 2 : La validation des coordonnées, en fonction pure (TDD)

**Pourquoi cette tâche existe.** C'est le seul morceau de ce chantier que Vitest
puisse tester (environnement `node`, pas de jsdom). Une coordonnée invalide qui
passe en base produit un marqueur au milieu de l'océan, et personne ne s'en aperçoit
avant qu'une cliente se plaigne.

Le cas qui compte vraiment : **`(0, 0)`**, le « Null Island ». C'est ce qu'on obtient
quand un parsing échoue silencieusement — `Number("") === 0`. Un salon tunisien s'y
retrouverait au large du Ghana. On le rejette explicitement.

Précédents dans le dépôt : `src/lib/offer-publish.ts` et
`src/lib/booking-conflicts.ts`, extraits pour la même raison. **Aucun import
Prisma** dans ce module.

**Files:**
- Create: `src/lib/coords.ts`
- Create: `src/lib/coords.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Crée `src/lib/coords.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { isValidCoords, parseCoords } from "./coords";

describe("isValidCoords", () => {
  it("accepte un point tunisien plausible (Tunis)", () => {
    expect(isValidCoords(36.8065, 10.1815)).toBe(true);
  });

  it("accepte les bornes exactes", () => {
    expect(isValidCoords(90, 180)).toBe(true);
    expect(isValidCoords(-90, -180)).toBe(true);
  });

  it("refuse une latitude hors bornes", () => {
    expect(isValidCoords(91, 10)).toBe(false);
    expect(isValidCoords(-91, 10)).toBe(false);
  });

  it("refuse une longitude hors bornes", () => {
    expect(isValidCoords(36, 181)).toBe(false);
    expect(isValidCoords(36, -181)).toBe(false);
  });

  it("refuse (0, 0) — Null Island, symptome d'un parsing rate", () => {
    expect(isValidCoords(0, 0)).toBe(false);
  });

  it("accepte une seule des deux coordonnees a zero", () => {
    // Le meridien de Greenwich et l'equateur sont des lieux reels.
    expect(isValidCoords(36.8, 0)).toBe(true);
    expect(isValidCoords(0, 10.18)).toBe(true);
  });

  it("refuse NaN et Infinity", () => {
    expect(isValidCoords(NaN, 10)).toBe(false);
    expect(isValidCoords(36, NaN)).toBe(false);
    expect(isValidCoords(Infinity, 10)).toBe(false);
    expect(isValidCoords(36, -Infinity)).toBe(false);
  });
});

describe("parseCoords", () => {
  it("renvoie un point valide depuis des nombres", () => {
    expect(parseCoords(36.8065, 10.1815)).toEqual({ lat: 36.8065, lng: 10.1815 });
  });

  it("renvoie un point valide depuis des chaines", () => {
    expect(parseCoords("36.8065", "10.1815")).toEqual({ lat: 36.8065, lng: 10.1815 });
  });

  it("renvoie null si l'un des deux manque", () => {
    expect(parseCoords(36.8065, null)).toBeNull();
    expect(parseCoords(null, 10.1815)).toBeNull();
    expect(parseCoords(null, null)).toBeNull();
    expect(parseCoords(undefined, undefined)).toBeNull();
  });

  it("renvoie null pour une chaine vide — Number('') vaut 0, piege classique", () => {
    expect(parseCoords("", "")).toBeNull();
  });

  it("renvoie null pour des coordonnees invalides", () => {
    expect(parseCoords(91, 10)).toBeNull();
    expect(parseCoords(0, 0)).toBeNull();
    expect(parseCoords("abc", "def")).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
npx vitest run src/lib/coords.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./coords"`.

- [ ] **Step 3 : Écrire l'implémentation**

Crée `src/lib/coords.ts` :

```ts
/**
 * Validation des coordonnees geographiques d'un salon.
 *
 * Pas d'import Prisma ici — le module doit rester chargeable par vitest
 * (cf. src/lib/verify-authz.ts, meme contrainte).
 */

export type Coords = { lat: number; lng: number };

/**
 * Une paire (lat, lng) est-elle utilisable comme emplacement de salon ?
 *
 * Le cas (0, 0) est rejete volontairement : c'est le « Null Island », au large
 * du Ghana, qu'on obtient quand un parsing echoue en silence — Number("")
 * vaut 0. Aucun salon tunisien ne s'y trouve. En revanche une SEULE des deux
 * coordonnees a zero reste valide : l'equateur et le meridien de Greenwich
 * sont des lieux reels.
 */
export function isValidCoords(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

/**
 * Normalise une paire d'entrees (nombres, chaines, null, undefined) en un point
 * valide, ou null si le point est absent ou invalide.
 *
 * Les deux coordonnees vont ensemble : un demi-point n'est affichable nulle
 * part, la fiche publique teste `lat && lng`.
 */
export function parseCoords(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined,
): Coords | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return null;
  }
  // Number("") vaut 0 : sans ce garde, une chaine vide produirait Null Island.
  if (typeof lat === "string" && lat.trim() === "") return null;
  if (typeof lng === "string" && lng.trim() === "") return null;

  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!isValidCoords(latNum, lngNum)) return null;
  return { lat: latNum, lng: lngNum };
}
```

- [ ] **Step 4 : Lancer le test — 12 passants attendus**

```bash
npx vitest run src/lib/coords.test.ts
```

Attendu : PASS, 12 tests (7 pour `isValidCoords`, 5 pour `parseCoords`).

- [ ] **Step 5 : Lancer la suite complète**

```bash
npm test
```

Attendu : **136 tests** passants en 9 fichiers (124 + 12). Si le compte diffère,
arrête-toi et signale-le ; ne « répare » pas d'autres tests.

- [ ] **Step 6 : Vérifier et commiter**

```bash
npx tsc --noEmit
npx eslint src/lib/coords.ts src/lib/coords.test.ts
git add src/lib/coords.ts src/lib/coords.test.ts
git commit -m "feat(carte): validation pure des coordonnees

Rejette (0,0) — le Null Island qu'on obtient quand un parsing echoue
en silence, Number('') valant 0."
```

---

## Task 3 : Le géocodage Nominatim

**Files:**
- Create: `src/lib/geocode.ts`

Module appelé depuis le navigateur, sur clic explicite du bouton « Localiser ».
Pas de route serveur intermédiaire : la charge se répartit sur les utilisateurs
au lieu de se concentrer sur l'IP du serveur, ce que Nominatim n'apprécie pas.

- [ ] **Step 1 : Créer le fichier**

Crée `src/lib/geocode.ts` :

```ts
import { parseCoords, type Coords } from "@/lib/coords";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/**
 * Cherche des coordonnees a partir d'une adresse libre.
 *
 * Appele depuis le navigateur, sur clic explicite de l'utilisateur — jamais a
 * la frappe. Nominatim limite a 1 requete/seconde ; ce rythme ne l'approche
 * pas.
 *
 * Renvoie null si l'adresse est introuvable ou si la reponse est inexploitable.
 * L'appelant distingue les deux cas par le message affiche, pas par le retour :
 * dans les deux cas il n'y a rien a placer sur la carte.
 */
export async function geocodeAddress(query: string): Promise<Coords | null> {
  const q = query.trim();
  if (!q) return null;

  const url = `${NOMINATIM}?format=json&limit=1&countrycodes=tn&q=${encodeURIComponent(q)}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;

    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const first = data[0] as { lat?: string; lon?: string };
    // Nominatim nomme la longitude "lon", pas "lng".
    return parseCoords(first.lat, first.lon);
  } catch {
    return null;
  }
}
```

Note le paramètre `countrycodes=tn` : il restreint la recherche à la Tunisie, ce
qui écarte les homonymes étrangers (« rue de Marseille » existe à Marseille).

- [ ] **Step 2 : Vérifier**

```bash
npx tsc --noEmit
npx eslint src/lib/geocode.ts
npm test
```

Attendu : aucune erreur, 136 tests passants.

- [ ] **Step 3 : Commit**

```bash
git add src/lib/geocode.ts
git commit -m "feat(carte): geocodage Nominatim restreint a la Tunisie"
```

---

## Task 4 : L'icône de marqueur partagée, puis la carte en lecture seule

**Files:**
- Create: `src/components/map/marker-icon.ts`
- Create: `src/components/map/salon-map.tsx`

Le composant le plus simple des deux : un marqueur, pas d'interaction d'édition.
On commence par lui pour valider le montage de Leaflet avant d'ajouter la
complexité du glisser-déposer.

L'icône vit dans son propre fichier parce que les **deux** cartes en ont besoin,
à l'identique. La dupliquer garantirait qu'une correction future n'en touche
qu'une moitié.

- [ ] **Step 0 : Créer l'icône partagée**

Crée `src/components/map/marker-icon.ts` :

```ts
import L from "leaflet";

/**
 * Icone de marqueur en SVG inline, aux couleurs de la marque.
 *
 * Les icones par defaut de Leaflet sont des PNG references en chemins relatifs
 * au CSS ; sous un bundler ces chemins cassent et le marqueur devient
 * invisible — panne classique et deroutante, car la carte s'affiche
 * correctement. Un SVG inline evite le probleme sans fichier a servir.
 */
export function markerIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26c0-7.7-6.3-14-14-14z" fill="#D4A574"/>
      <circle cx="14" cy="14" r="5" fill="#1F1A1C"/>
    </svg>`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40],
  });
}
```

Les deux couleurs sont les tokens de marque : `#D4A574` (or) et `#1F1A1C`
(encre).

- [ ] **Step 1 : Créer le fichier de la carte**

Crée `src/components/map/salon-map.tsx` :

```tsx
"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { markerIcon } from "@/components/map/marker-icon";

/**
 * Carte en lecture seule : un marqueur, pas d'edition.
 *
 * Ce composant importe Leaflet, qui manipule le DOM et n'existe pas cote
 * serveur. Il DOIT etre charge via dynamic(..., { ssr: false }) — sinon le
 * build echoue sur « window is not defined ».
 */
export default function SalonMap({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;

    map.current = L.map(container.current, {
      center: [lat, lng],
      zoom: 16,
      // La molette zoome la page, pas la carte : sur une fiche longue, capturer
      // le scroll pieger la visiteuse qui veut simplement descendre.
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map.current);

    L.marker([lat, lng], { icon: markerIcon() })
      .addTo(map.current)
      .bindPopup(label);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [lat, lng, label]);

  return <div ref={container} className="h-56 w-full rounded" />;
}
```

- [ ] **Step 2 : Vérifier**

```bash
npx tsc --noEmit
npx eslint src/components/map/marker-icon.ts src/components/map/salon-map.tsx
```

Attendu : aucune erreur. Si `tsc` se plaint de `leaflet/dist/leaflet.css`,
vérifie que `@types/leaflet` est bien installé (Task 0).

- [ ] **Step 3 : Commit**

```bash
git add src/components/map/marker-icon.ts src/components/map/salon-map.tsx
git commit -m "feat(carte): composant carte en lecture seule

Icone SVG inline dans un fichier partage : les PNG par defaut de Leaflet
cassent sous bundler, et les deux cartes ont besoin de la meme icone."
```

---

## Task 5 : La carte éditable

**Files:**
- Create: `src/components/map/location-picker.tsx`

Trois chemins vers le point : bouton « Localiser » (géocodage), glisser le
marqueur, cliquer sur la carte.

- [ ] **Step 1 : Créer le fichier**

Crée `src/components/map/location-picker.tsx` :

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeAddress } from "@/lib/geocode";
import { markerIcon } from "@/components/map/marker-icon";

/** Centre de la Tunisie, cadrage par defaut quand on n'a aucun point. */
const TUNISIE: [number, number] = [34.0, 9.0];
const ZOOM_PAYS = 6;
const ZOOM_ADRESSE = 16;

/**
 * Carte editable : marqueur deplaçable + bouton de geocodage.
 *
 * Ce composant importe Leaflet, qui manipule le DOM et n'existe pas cote
 * serveur. Il DOIT etre charge via dynamic(..., { ssr: false }).
 */
export default function LocationPicker({
  lat,
  lng,
  address,
  city,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  address: string;
  city: string;
  onChange: (lat: number, lng: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Le parent recree souvent onChange ; on garde la derniere version sans
  // relancer l'effet de montage, qui detruirait la carte a chaque frappe.
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Montage unique. Les dependances sont volontairement vides : la position
  // initiale ne doit etre lue qu'une fois, les mises a jour passent par
  // placeMarker.
  useEffect(() => {
    if (!container.current || map.current) return;

    const hasPoint = lat !== null && lng !== null;
    map.current = L.map(container.current, {
      center: hasPoint ? [lat, lng] : TUNISIE,
      zoom: hasPoint ? ZOOM_ADRESSE : ZOOM_PAYS,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map.current);

    if (hasPoint) {
      placeMarker(lat, lng, false);
    }

    map.current.on("click", (e: L.LeafletMouseEvent) => {
      placeMarker(e.latlng.lat, e.latlng.lng, true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Place ou deplace le marqueur, et remonte les coordonnees au parent. */
  function placeMarker(nextLat: number, nextLng: number, notify: boolean) {
    if (!map.current) return;

    if (marker.current) {
      marker.current.setLatLng([nextLat, nextLng]);
    } else {
      marker.current = L.marker([nextLat, nextLng], {
        draggable: true,
        icon: markerIcon(),
      }).addTo(map.current);

      marker.current.on("dragend", () => {
        const p = marker.current!.getLatLng();
        onChangeRef.current(p.lat, p.lng);
        setMessage(null);
      });
    }

    if (notify) onChangeRef.current(nextLat, nextLng);
  }

  async function localiser() {
    const query = [address.trim(), city.trim()].filter(Boolean).join(", ");
    if (!query) {
      setMessage("Renseignez d'abord une adresse ou une ville.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const found = await geocodeAddress(query);
      if (!found) {
        setMessage("Adresse introuvable. Placez le marqueur à la main sur la carte.");
        return;
      }
      map.current?.setView([found.lat, found.lng], ZOOM_ADRESSE);
      placeMarker(found.lat, found.lng, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div ref={container} className="h-64 w-full rounded border border-pos-border" />
      <div className="mt-2 flex items-start justify-between gap-3">
        <p className="text-xs text-pos-ink-3">
          Déplacez le marqueur si l&apos;emplacement n&apos;est pas exact.
        </p>
        <button
          type="button"
          onClick={localiser}
          disabled={busy}
          className="shrink-0 rounded border border-pos-border px-3 py-1.5 text-xs text-pos-ink-2 disabled:opacity-50"
        >
          {busy ? "Recherche…" : "Localiser"}
        </button>
      </div>
      {message && <p className="mt-1 text-xs text-amber-700">{message}</p>}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier**

```bash
npx tsc --noEmit
npx eslint src/components/map/location-picker.tsx
```

Attendu : aucune erreur. Le `eslint-disable-next-line react-hooks/exhaustive-deps`
est intentionnel et commenté — ne le retire pas.

- [ ] **Step 3 : Commit**

```bash
git add src/components/map/location-picker.tsx
git commit -m "feat(carte): selecteur d'emplacement avec marqueur deplaçable

Trois chemins vers le point : geocodage, glisser, clic. Le glisser est
le recours quand Nominatim tombe a cote — frequent pour les adresses
tunisiennes informelles."
```

---

## Task 6 : Intégrer le sélecteur dans l'onglet Salon

**Files:**
- Modify: `src/app/(pos)/pos/settings/page.tsx`
- Modify: `src/components/pos/settings/salon-form.tsx`

- [ ] **Step 1 : Charger lat/lng dans le `select` de la page**

Dans `src/app/(pos)/pos/settings/page.tsx`, le `select` du
`prisma.providerProfile.findUnique` liste les colonnes chargées. Ajoute `lat` et
`lng` après `phone: true` :

```ts
      phone: true,
      lat: true,
      lng: true,
```

Puis, dans le bloc de typage qui suit (le `as { ... } | null`), ajoute après
`phone: string | null;` :

```ts
    lat: number | null;
    lng: number | null;
```

Enfin, dans l'objet `profile={{ ... }}` passé à `<SettingsTabs>`, ajoute après
`phone: provider.phone,` :

```ts
            lat: provider.lat,
            lng: provider.lng,
```

- [ ] **Step 2 : Étendre le type `SalonProfile`**

Dans `src/components/pos/settings/salon-form.tsx`, ajoute les deux champs au type
exporté, après `phone` :

```ts
export type SalonProfile = {
  salonName: string;
  category: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  photos: string[];
  matriculeFiscal: string | null;
  receiptFooter: string | null;
};
```

- [ ] **Step 3 : Importer le sélecteur en chargement dynamique**

En haut de `salon-form.tsx`, après l'import de `ImageUpload`, ajoute :

```tsx
import dynamic from "next/dynamic";

// Leaflet manipule le DOM et n'existe pas cote serveur : sans ssr:false, le
// build echoue sur « window is not defined ».
const LocationPicker = dynamic(() => import("@/components/map/location-picker"), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full rounded border border-pos-border bg-pos-bg" />
  ),
});
```

- [ ] **Step 4 : Ajouter les coordonnées à l'état du formulaire**

Dans le `useState` initial, ajoute après `phone` :

```ts
    lat: initial.lat,
    lng: initial.lng,
```

- [ ] **Step 5 : Envoyer les coordonnées à l'enregistrement**

Dans le corps du `fetch` du `save()`, ajoute après `phone` :

```ts
          lat: form.lat,
          lng: form.lng,
```

- [ ] **Step 6 : Afficher le sélecteur sous le champ Ville**

Repère le bloc `<div className="grid grid-cols-2 gap-3">` qui contient les champs
**Ville** et **Matricule fiscal**. Juste **après** la balise fermante `</div>` de
ce bloc, insère :

```tsx
      <div>
        <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
          Emplacement sur la carte
        </span>
        <LocationPicker
          lat={form.lat}
          lng={form.lng}
          address={form.address}
          city={form.city}
          onChange={(lat, lng) => {
            setForm((f) => ({ ...f, lat, lng }));
            setOk(false);
          }}
        />
      </div>
```

Note l'usage de `setForm` directement plutôt que `patch` : `patch` ne modifie
qu'une clé à la fois, or on met à jour `lat` et `lng` ensemble.

- [ ] **Step 7 : Vérifier**

```bash
npx tsc --noEmit
npx eslint src/components/pos/settings/salon-form.tsx "src/app/(pos)/pos/settings/page.tsx"
npm test
```

Attendu : aucune erreur, 136 tests passants.

- [ ] **Step 8 : Commit**

```bash
git add src/components/pos/settings/salon-form.tsx "src/app/(pos)/pos/settings/page.tsx"
git commit -m "feat(carte): le salon place son emplacement depuis la caisse"
```

---

## Task 7 : La carte sur la fiche publique

**Files:**
- Modify: `src/app/salon/[id]/salon-client.tsx`

La page serveur passe déjà `lat` et `lng` au composant client, et le type
`Salon` les déclare déjà. **Rien à changer côté données** — seulement l'affichage.

- [ ] **Step 1 : Importer la carte en chargement dynamique**

En haut de `src/app/salon/[id]/salon-client.tsx`, avec les autres imports,
ajoute :

```tsx
import dynamic from "next/dynamic";

// Leaflet manipule le DOM et n'existe pas cote serveur : sans ssr:false, le
// build echoue sur « window is not defined ».
const SalonMap = dynamic(() => import("@/components/map/salon-map"), {
  ssr: false,
  loading: () => <div className="h-56 w-full rounded bg-brand-sand" />,
});
```

- [ ] **Step 2 : Remplacer le lien mort par la carte et le bouton**

Dans le bloc « Coordonnées », repère le bloc conditionnel actuel :

```tsx
              {salon.lat && salon.lng && (
                <a
                  href={`https://www.google.com/maps?q=${salon.lat},${salon.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 text-[10px] tracking-[0.15em] uppercase text-brand-gold hover:text-brand-bordeaux"
                >
                  Voir sur la carte →
                </a>
              )}
```

Remplace-le **intégralement** par :

```tsx
              {salon.lat !== null && salon.lng !== null && (
                <div className="mt-4">
                  <SalonMap lat={salon.lat} lng={salon.lng} label={salon.salonName} />
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${salon.lat},${salon.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block w-full border border-brand-gold/40 py-2 text-center text-[10px] uppercase tracking-[0.15em] text-brand-gold hover:bg-brand-gold hover:text-white transition-colors"
                  >
                    Itinéraire →
                  </a>
                </div>
              )}
```

Deux changements de fond, au-delà de l'ajout de la carte :

- La condition passe de `salon.lat && salon.lng` à des comparaisons explicites à
  `null`. L'ancienne forme traitait la latitude `0` comme absente — sans effet en
  Tunisie, mais autant ne pas propager le motif.
- Le lien devient une URL d'**itinéraire** (`/maps/dir/?api=1&destination=`) et
  non plus de simple affichage. Sur mobile, ce format bascule dans l'application
  de navigation avec le trajet déjà calculé : c'est le geste réellement voulu.

- [ ] **Step 3 : Vérifier**

```bash
npx tsc --noEmit
npx eslint "src/app/salon/[id]/salon-client.tsx"
npm test
```

Attendu : aucune erreur, 136 tests passants.

- [ ] **Step 4 : Le build — l'étape qui compte**

```bash
npm run build
```

Attendu : **build réussi**. C'est la seule vérification qui prouve que les deux
`dynamic(..., { ssr: false })` sont corrects ; `tsc` ne détecte pas
`window is not defined`.

Si le build échoue sur `ECONNREFUSED` à `localhost:5433` : le prérendu de `/` et
`/sitemap.xml` interroge la base, qui ne tourne pas. Ce n'est pas ton code, mais
cette erreur **avorte le build avant tes pages** et masquerait un vrai problème.
Démarre une base jetable puis relance :

```bash
docker run -d --name map-build -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=beaute_marketplace -p 5433:5432 postgres:16
npx prisma migrate deploy
npm run build
docker rm -f map-build
```

Si le build échoue sur `caniuse-lite` ou `jose` manquants :
`rm -rf node_modules && npm install`. Corruption connue, pas ton code.

- [ ] **Step 5 : Commit**

```bash
git add "src/app/salon/[id]/salon-client.tsx"
git commit -m "feat(carte): carte et bouton Itineraire sur la fiche publique

Le lien « Voir sur la carte » existait mais n'apparaissait jamais, faute
de coordonnees en base. Il devient une URL d'itineraire, qui bascule
dans l'app de navigation sur mobile."
```

---

## Task 8 : Vérification manuelle sur base réelle

Aucun test automatisé ne couvre les composants de carte (pas de jsdom dans ce
dépôt). Cette checklist est la vraie vérification — **ne la saute pas**.

**Files:** aucun

- [ ] **Step 1 : Préparer l'environnement**

```bash
docker ps --format "{{.Names}} {{.Ports}}"
```

Si un conteneur occupe le port 3000 (souvent `users-service`), arrête-le ou
change de port. Puis démarre une base jetable :

```bash
docker run -d --name salonista-map -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=beaute_marketplace -p 5433:5432 postgres:16
npx prisma migrate deploy
npm run dev
```

Il te faut un salon avec le module POS actif et un compte propriétaire. Crée-le
par l'inscription prestataire, ou par un script `npx tsx`.

- [ ] **Step 2 : Dérouler la checklist**

Toute ligne qui échoue = la tâche n'est pas finie.

- [ ] `/pos/settings`, onglet **Salon** → la carte s'affiche sous Ville,
      centrée sur la **Tunisie** (salon sans coordonnées).
- [ ] Saisir « 15 rue de Marseille » / « Tunis », cliquer **Localiser** → le
      marqueur apparaît sur Tunis et la carte s'y recentre.
- [ ] **Glisser** le marqueur de quelques rues → il reste où on le lâche.
- [ ] Cliquer **Enregistrer**, recharger la page → la carte s'ouvre sur le point
      enregistré, pas sur la Tunisie entière.
- [ ] Saisir une adresse absurde (« zzzzz »), cliquer **Localiser** → message
      « Adresse introuvable… », **aucun plantage**, le marqueur existant ne
      bouge pas.
- [ ] Vider Adresse et Ville, cliquer **Localiser** → message demandant de
      renseigner une adresse, aucun appel réseau.
- [ ] Ouvrir `/salon/<id>` → la carte s'affiche dans le bloc Coordonnées, le
      marqueur est au bon endroit, un clic dessus montre le nom du salon.
- [ ] Cliquer **Itinéraire** → Google Maps s'ouvre dans un nouvel onglet avec la
      destination pré-remplie.
- [ ] Ouvrir la fiche d'un salon **sans coordonnées** → aucune carte, aucun bloc
      vide, adresse et téléphone toujours visibles.
- [ ] Faire défiler la fiche publique avec la molette **au-dessus de la carte** →
      la page défile, la carte ne zoome pas.
- [ ] Sur iPhone (DevTools, 375px) : la carte est manipulable au doigt dans la
      caisse, le marqueur se déplace, et la fiche publique reste lisible.

- [ ] **Step 3 : Nettoyer**

```bash
docker rm -f salonista-map
git status --short
```

Attendu : arbre propre, aucun fichier temporaire.

- [ ] **Step 4 : Commit si des correctifs ont été nécessaires**

Si rien n'a bougé, ne commite rien.

---

## Task 9 : Pousser et préparer la pull request

**Files:** aucun

- [ ] **Step 1 : Vérification finale**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

Attendu : 136 tests, aucune nouvelle erreur `tsc`, lint propre sur les fichiers
touchés, build réussi.

- [ ] **Step 2 : Pousser**

```bash
git push -u origin salon-map
```

- [ ] **Step 3 : Ouvrir la PR**

`gh` n'est pas installé sur cette machine. Après le push, GitHub affiche une URL
`https://github.com/eyaalimi/salonista/pull/new/salon-map` — ouvre-la dans le
navigateur et utilise ce corps :

```markdown
Le salon place son emplacement sur une carte depuis la caisse ; la cliente le voit sur la fiche publique.

## Le problème

`ProviderProfile.lat` et `.lng` existent depuis l'origine du schéma mais **rien ne les alimentait**. La fiche publique contenait déjà un lien « Voir sur la carte » conditionné à `lat && lng` : il n'apparaissait jamais. Le code d'affichage existait, la donnée manquait.

## Changements

- **Leaflet + OpenStreetMap, sans clé d'API ni carte bancaire.** Écarté Google Maps et Mapbox : meilleures données en Tunisie, mais compte de facturation obligatoire pour un bénéfice que les pilotes ne verraient pas encore. Migrer plus tard ne toucherait que les composants de carte — les coordonnées stockées ne changent pas.
- **Trois chemins vers le point** dans la caisse : bouton « Localiser » (géocodage Nominatim restreint à la Tunisie), glisser le marqueur, cliquer sur la carte. Le glisser est essentiel : « en face du café Chaabane » est une adresse tunisienne courante que le géocodage ne résout pas.
- **Carte + bouton Itinéraire** sur la fiche publique. Le lien devient une URL `/maps/dir/`, qui bascule dans l'app de navigation sur mobile avec le trajet déjà calculé.
- **Validation en fonction pure testée** (`src/lib/coords.ts`, 12 tests), dont le rejet de `(0, 0)` — le « Null Island » qu'on obtient quand un parsing échoue en silence, `Number("")` valant 0.
- Sans coordonnées, **aucune carte ne s'affiche** : ni bloc vide, ni marqueur au milieu de la mer. Important au démarrage, où aucun salon n'est encore placé.

## Non inclus, volontairement

- La carte multi-salons `/carte` : elle serait vide au lancement. C'est le lot suivant, une fois les salons placés.
- La recherche par proximité : même dépendance, et demande une requête géospatiale.

## Dette assumée

Le géocodage part du navigateur, donc le `User-Agent` envoyé à Nominatim est celui du navigateur et non un identifiant Salonista. Accepté vu le volume (un appel par enregistrement de profil, pas par visite). Si Nominatim limite un jour, la parade est une route serveur avec cache.

## Vérification

`npm test` 136/136 · `tsc --noEmit` (seules restent les 23 erreurs pré-existantes, dans deux fichiers non touchés) · `eslint` propre · `npm run build` réussi — c'est lui, et non `tsc`, qui prouve que les `dynamic(..., { ssr: false })` sont corrects.

Checklist manuelle déroulée : géocodage, glisser-déposer, persistance après rechargement, adresse introuvable sans plantage, fiche sans coordonnées propre, molette qui ne capture pas le scroll.
```

**Ne merge pas toi-même** — un push sur `main` déclenche le déploiement
automatique vers Lightsail. Le merge est la décision du propriétaire.

---

## Notes de conception

**Pourquoi deux composants de carte et non un seul paramétré ?** L'éditable porte
le géocodage, le glisser-déposer et la gestion d'erreur (~150 lignes) ; le lecteur
seul est trivial (~60 lignes). Un composant unique aurait une double personnalité
dont la moitié du code serait morte dans chaque usage.

**Pourquoi rejeter `(0, 0)` ?** Parce que `Number("")` vaut `0` : un champ vide
mal géré produit silencieusement un point au large du Ghana. Rejeter la paire
tout en acceptant une seule coordonnée nulle préserve les lieux réels sur
l'équateur et le méridien de Greenwich.

**Pourquoi `countrycodes=tn` sur Nominatim ?** « Rue de Marseille » existe à
Marseille. Restreindre à la Tunisie écarte les homonymes étrangers, qui seraient
le mode d'échec le plus déroutant pour un salon.

**Pourquoi `scrollWheelZoom: false` ?** Sur une fiche longue, une carte qui capture
la molette piège la visiteuse qui veut simplement faire défiler la page.

**Pourquoi une icône SVG inline, et dans son propre fichier ?** Les icônes par
défaut de Leaflet sont des PNG référencés en chemins relatifs au CSS ; sous un
bundler ces chemins cassent et le marqueur devient invisible — panne classique et
déroutante, car la carte s'affiche correctement. Elle vit dans
`marker-icon.ts` plutôt que dupliquée dans les deux composants : à l'identique
dans deux fichiers, une correction future n'en toucherait qu'une moitié.
