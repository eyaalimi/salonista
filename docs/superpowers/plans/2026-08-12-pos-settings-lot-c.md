# Lot C — Profil du salon et horaires — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le profil du salon et les horaires d'ouverture modifiables depuis la PWA de caisse, avec une confirmation avant tout changement d'horaires qui laisserait des rendez-vous hors plage.

**Architecture:** `/pos/settings` devient une page à deux onglets — « Salon » (9 champs de profil) et « Horaires » (l'éditeur existant + un dialogue de conflits). Les deux enregistrent séparément, ce qui garantit qu'éditer un numéro de téléphone ne peut jamais toucher un créneau de réservation. La détection de conflits sort en fonction pure testable (`src/lib/booking-conflicts.ts`), sur le modèle de `offer-publish.ts` du lot B.

**Tech Stack:** Next.js 16.2 (App Router), React 19, Tailwind v4 (tokens `pos-*`), Prisma 7, Vitest (environnement `node`), TypeScript strict.

**Spec:** [docs/superpowers/specs/2026-08-12-pos-settings-lot-c-design.md](../specs/2026-08-12-pos-settings-lot-c-design.md)

---

## Contexte pour l'ingénieur

**Salonista** est une marketplace beauté tunisienne. Les salons utilisent une **PWA de
caisse** sur tablette (routes sous `/pos`). Les lots A et B ont rapatrié le portail
prestataire dans cette PWA. Il reste un trou : `/pos/settings` affiche le profil du salon
en **lecture seule**, avec un bouton « Modifier — bientôt » désactivé. Un salon qui change
ses horaires d'été ne peut le faire nulle part. C'est ce lot qui corrige ça.

**Sept choses à savoir avant de toucher au code :**

1. **Deux modèles d'authentification coexistent.** Un propriétaire se connecte par
   email/mot de passe (session `PROVIDER`) **ou** par code PIN sur la tablette (session
   avec `session.employee`). `getCurrentEmployee()` dans `src/lib/employee-session.ts`
   réconcilie les deux. Toute route de caisse doit passer par lui, jamais par
   `session.user.role === "PROVIDER"` seul — sinon la tablette prend un 401.

2. **`settings.manage` est une permission OWNER uniquement** (voir `ROLE_DEFAULTS` dans
   `src/lib/permissions.ts`). Un MANAGER ne voit pas cette page. La garde existe déjà
   dans `page.tsx`.

3. **Modifier les horaires recalcule 30 jours de créneaux** via
   `regenerateAllProviderSlots`. Cette fonction ne supprime que les créneaux **futurs et
   sans réservation** (`bookedCount === 0`) — aucun rendez-vous n'est jamais perdu. Mais
   un rendez-vous déjà pris un samedi **survit** si le salon ferme le samedi. C'est ce
   que le dialogue de conflits sert à signaler.

4. **Les photos uploadées ne passent pas par l'optimiseur Next.** Utilise
   `<UploadedImage>`, jamais `<Image>`, pour tout chemin `/uploads/...`. `<ImageUpload>`
   le fait déjà correctement.

5. **Vitest tourne en `environment: "node"`**, include `src/**/*.test.ts(x)`. Il n'y a
   **ni jsdom ni @testing-library/react** dans ce dépôt, et ce plan n'en ajoute pas. Seule
   la Task 1 est en TDD, sur de la logique pure. Le reste est vérifié par `tsc`, ESLint,
   `npm run build`, et la checklist manuelle de la Task 8.

6. **`npm run build` est la seule vérification qui détecte certaines erreurs** (frontières
   Suspense, erreurs de prérendu). `tsc` ne les voit pas. Au lot B, ESLint n'avait rien
   signalé sur un `useSearchParams` sans Suspense — seul le build l'a attrapé.

7. **L'UI est en français.** Libellés, messages d'erreur. Les commentaires de code sont en
   français dans les fichiers POS — suis le fichier que tu édites.

**Commandes :**

```bash
npm test              # vitest run — 112 tests aujourd'hui
npx tsc --noEmit      # typecheck
npm run lint          # ESLint
npm run build         # build de production
npm run dev           # serveur de dev (port 3000)
```

**Deux erreurs `tsc` pré-existantes** vivent dans
`src/components/pos/onboarding/wizard-client.tsx` et `src/lib/rewards/rewards.test.ts`.
Elles ne sont pas les tiennes ; ne les corrige pas, confirme seulement qu'il ne s'en
ajoute pas d'autres.

**Attention environnement :** un conteneur Docker `users-service` occupe parfois le
**port 3000**. Vérifie avec `docker ps` avant `npm run dev`.

---

## Structure des fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/lib/opening-hours.ts` | Exporter `toMinutes` et `dayKeyFromDate` (aujourd'hui privés) | **Modifier** |
| `src/lib/booking-conflicts.ts` | Règle pure : un créneau tombe-t-il hors des horaires ? | **Créer** |
| `src/lib/booking-conflicts.test.ts` | Tests de la règle | **Créer** |
| `src/app/api/provider/profile/route.ts` | Auth employé + accepter `photos` | **Modifier** |
| `src/app/api/pos/settings/conflicts/route.ts` | Comptage des conflits avant enregistrement | **Créer** |
| `src/components/pos/settings/salon-form.tsx` | Onglet Salon — 9 champs | **Créer** |
| `src/components/pos/settings/hours-form.tsx` | Onglet Horaires + dialogue | **Créer** |
| `src/components/pos/settings/settings-tabs.tsx` | Bascule client entre les deux onglets | **Créer** |
| `src/app/(pos)/pos/settings/page.tsx` | Charge le profil, rend les onglets (server component) | **Modifier** |

Deux composants séparés plutôt qu'un : chacun fait ~180 lignes, avec son propre
enregistrement et son propre appel réseau. C'est le découpage qui garantit qu'enregistrer
un téléphone ne déclenche jamais `regenerateAllProviderSlots`.

---

## Task 0 : Créer la branche

**Files:** aucun

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
git checkout -b pos-settings
```

Attendu : `Switched to a new branch 'pos-settings'`

---

## Task 1 : La règle de conflit, en fonction pure (TDD)

**Pourquoi cette tâche existe.** Quand un salon réduit ses horaires, il faut savoir quels
rendez-vous déjà pris tombent hors des nouvelles plages. « Cette date-heure tombe-t-elle
dans ces plages d'ouverture ? » est un calcul où une erreur de jour de semaine, de minuit
ou de dimanche passe inaperçue à l'œil nu — et c'est le seul morceau de ce lot que Vitest
puisse tester (environnement `node`, pas de jsdom).

Précédents dans le dépôt : `src/lib/verify-authz.ts` et `src/lib/offer-publish.ts` (lot
B), extraits pour la même raison. **Aucun import Prisma** dans ce module.

`src/lib/opening-hours.ts` possède déjà `toMinutes(hhmm)` et `dayKeyFromDate(date)`, mais
elles sont **privées**. Il faut les exporter plutôt que réécrire le parsing : deux
implémentations du même calcul divergent au premier changement.

**Files:**
- Modify: `src/lib/opening-hours.ts:47` et `:52`
- Create: `src/lib/booking-conflicts.ts`
- Create: `src/lib/booking-conflicts.test.ts`

- [ ] **Step 1 : Exporter les deux helpers**

Dans `src/lib/opening-hours.ts`, ajoute `export` devant les deux fonctions privées.
Ligne 47 :

```ts
export function toMinutes(hhmm: string): number {
```

Ligne 52 :

```ts
export function dayKeyFromDate(d: Date): DayKey {
```

Ne change rien d'autre dans ce fichier.

- [ ] **Step 2 : Écrire le test qui échoue**

Crée `src/lib/booking-conflicts.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { isOutsideOpeningHours, findConflicts } from "./booking-conflicts";
import { emptyOpeningHours, type OpeningHours } from "./opening-hours";

// 2026-08-15 est un SAMEDI, 2026-08-17 un LUNDI. Verifie avec :
//   new Date(2026, 7, 15).getDay() === 6
const SAMEDI = (h: number, m = 0) => new Date(2026, 7, 15, h, m, 0, 0);
const LUNDI = (h: number, m = 0) => new Date(2026, 7, 17, h, m, 0, 0);

const ouvertEnSemaine: OpeningHours = {
  ...emptyOpeningHours(),
  mon: [{ start: "09:00", end: "18:00" }],
  sat: [],
};

describe("isOutsideOpeningHours", () => {
  it("un creneau pendant une plage ouverte n'est pas en conflit", () => {
    expect(isOutsideOpeningHours(LUNDI(10), ouvertEnSemaine)).toBe(false);
  });

  it("un creneau un jour ferme est en conflit", () => {
    expect(isOutsideOpeningHours(SAMEDI(10), ouvertEnSemaine)).toBe(true);
  });

  it("un creneau avant l'ouverture est en conflit", () => {
    expect(isOutsideOpeningHours(LUNDI(8), ouvertEnSemaine)).toBe(true);
  });

  it("un creneau apres la fermeture est en conflit", () => {
    expect(isOutsideOpeningHours(LUNDI(18, 30), ouvertEnSemaine)).toBe(true);
  });

  it("l'heure d'ouverture exacte n'est pas en conflit", () => {
    expect(isOutsideOpeningHours(LUNDI(9), ouvertEnSemaine)).toBe(false);
  });

  it("l'heure de fermeture exacte EST en conflit — le service commencerait a la fermeture", () => {
    expect(isOutsideOpeningHours(LUNDI(18), ouvertEnSemaine)).toBe(true);
  });

  it("gere les plages multiples (pause dejeuner)", () => {
    const avecPause: OpeningHours = {
      ...emptyOpeningHours(),
      mon: [
        { start: "09:00", end: "12:00" },
        { start: "14:00", end: "18:00" },
      ],
    };
    expect(isOutsideOpeningHours(LUNDI(10), avecPause)).toBe(false);
    expect(isOutsideOpeningHours(LUNDI(13), avecPause)).toBe(true);
    expect(isOutsideOpeningHours(LUNDI(15), avecPause)).toBe(false);
  });

  it("des horaires entierement vides mettent tout en conflit", () => {
    expect(isOutsideOpeningHours(LUNDI(10), emptyOpeningHours())).toBe(true);
  });
});

describe("findConflicts", () => {
  const creneaux = [
    { startTime: LUNDI(10), offerTitle: "Coupe femme" },
    { startTime: SAMEDI(10), offerTitle: "Balayage" },
    { startTime: SAMEDI(14), offerTitle: "Brushing" },
  ];

  it("ne retient que les creneaux hors horaires", () => {
    const r = findConflicts(creneaux, ouvertEnSemaine);
    expect(r.map((c) => c.offerTitle)).toEqual(["Balayage", "Brushing"]);
  });

  it("trie par date croissante", () => {
    const desordre = [
      { startTime: SAMEDI(14), offerTitle: "Brushing" },
      { startTime: SAMEDI(10), offerTitle: "Balayage" },
    ];
    const r = findConflicts(desordre, ouvertEnSemaine);
    expect(r.map((c) => c.offerTitle)).toEqual(["Balayage", "Brushing"]);
  });

  it("renvoie un tableau vide quand tout rentre dans les horaires", () => {
    const ouvertPartout: OpeningHours = {
      mon: [{ start: "00:00", end: "23:59" }],
      tue: [{ start: "00:00", end: "23:59" }],
      wed: [{ start: "00:00", end: "23:59" }],
      thu: [{ start: "00:00", end: "23:59" }],
      fri: [{ start: "00:00", end: "23:59" }],
      sat: [{ start: "00:00", end: "23:59" }],
      sun: [{ start: "00:00", end: "23:59" }],
    };
    expect(findConflicts(creneaux, ouvertPartout)).toEqual([]);
  });

  it("une liste vide ne produit aucun conflit", () => {
    expect(findConflicts([], ouvertEnSemaine)).toEqual([]);
  });
});
```

- [ ] **Step 3 : Lancer le test pour vérifier qu'il échoue**

```bash
npx vitest run src/lib/booking-conflicts.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./booking-conflicts"`.

- [ ] **Step 4 : Écrire l'implémentation**

Crée `src/lib/booking-conflicts.ts` :

```ts
import { dayKeyFromDate, toMinutes, type OpeningHours } from "@/lib/opening-hours";

/** Un creneau reserve, reduit a ce qui sert au calcul et a l'affichage. */
export type BookedSlot = {
  startTime: Date;
  offerTitle: string;
};

/**
 * Le debut de ce creneau tombe-t-il en dehors des plages d'ouverture ?
 *
 * On teste le DEBUT seulement, pas la duree complete : un rendez-vous qui
 * commence dans les horaires et deborde de dix minutes n'est pas un probleme
 * pour le salon. Un rendez-vous qui commence un jour ferme, si.
 *
 * L'heure de fermeture exacte compte comme un conflit : un service qui
 * commencerait pile a la fermeture ne peut pas etre honore.
 *
 * Pas d'import Prisma ici — le module doit rester chargeable par vitest
 * (cf. src/lib/verify-authz.ts, meme contrainte).
 */
export function isOutsideOpeningHours(startTime: Date, hours: OpeningHours): boolean {
  const ranges = hours[dayKeyFromDate(startTime)] ?? [];
  if (ranges.length === 0) return true;

  const minutes = startTime.getHours() * 60 + startTime.getMinutes();
  return !ranges.some((r) => toMinutes(r.start) <= minutes && minutes < toMinutes(r.end));
}

/**
 * Parmi des creneaux deja reserves, ceux qui tomberaient hors des nouveaux
 * horaires. Tries par date croissante pour l'affichage.
 *
 * Ces rendez-vous ne sont PAS supprimes par la regeneration des creneaux
 * (regenerateOfferSlots epargne tout creneau dont bookedCount > 0) : ils
 * seront honores. Le but est que le salon le sache avant de valider.
 */
export function findConflicts(slots: BookedSlot[], hours: OpeningHours): BookedSlot[] {
  return slots
    .filter((s) => isOutsideOpeningHours(s.startTime, hours))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}
```

- [ ] **Step 5 : Lancer le test — 13 passants attendus**

```bash
npx vitest run src/lib/booking-conflicts.test.ts
```

Attendu : PASS, 13 tests.

- [ ] **Step 6 : Lancer la suite complète**

```bash
npm test
```

Attendu : **125 tests** passants en 8 fichiers (112 + 13). Si le compte diffère,
arrête-toi et signale-le ; ne « répare » pas d'autres tests.

- [ ] **Step 7 : Typecheck et lint**

```bash
npx tsc --noEmit
npx eslint src/lib/booking-conflicts.ts src/lib/booking-conflicts.test.ts src/lib/opening-hours.ts
```

Attendu : aucune erreur mentionnant `booking-conflicts` ou `opening-hours` ; ESLint
silencieux.

- [ ] **Step 8 : Commit**

```bash
git add src/lib/booking-conflicts.ts src/lib/booking-conflicts.test.ts src/lib/opening-hours.ts
git commit -m "feat(settings): detection des rendez-vous hors horaires, en fonction pure

Exporte toMinutes et dayKeyFromDate plutot que de reecrire le parsing :
deux implementations du meme calcul divergent au premier changement."
```

---

## Task 2 : Ouvrir l'API profil aux sessions employé PIN

**Pourquoi.** `/api/provider/profile` refuse tout ce qui n'est pas
`session.user.role === "PROVIDER"`. Or un propriétaire se connecte le plus souvent **par
PIN sur la tablette** — session employé, donc 401. Sans ce changement, la page de
settings ne peut pas enregistrer depuis la caisse.

**Vérifié avant d'écrire ce plan : cette route n'a aucun appelant dans le code.** La page
qui l'utilisait est devenue une redirection au lot A. C'est aussi la seule route qui écrit
`openingHours`. Le changement ne peut rien casser.

**Files:**
- Modify: `src/app/api/provider/profile/route.ts`

- [ ] **Step 1 : Remplacer les imports d'authentification**

En haut du fichier, remplace :

```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
```

par :

```ts
import { requirePermission, toResponse } from "@/lib/employee-session";
```

`NextRequest`, `NextResponse`, `prisma`, `isValidOpeningHours` et
`regenerateAllProviderSlots` restent importés tels quels.

- [ ] **Step 2 : Réécrire la garde du GET**

Remplace le début de `GET` :

```ts
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const profile = await prisma.providerProfile.findUnique({
    where: { userId: session.user.id },
  });
```

par :

```ts
export async function GET() {
  // Accepte session PROVIDER et session employe par PIN : un proprietaire
  // ouvre le plus souvent la caisse avec son code, pas avec son mot de passe.
  let employee;
  try {
    employee = await requirePermission("settings.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const profile = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
  });
```

Note le passage de `where: { userId }` à `where: { id: employee.providerId }` — l'employé
connaît son `providerId`, pas forcément un `userId`.

- [ ] **Step 3 : Réécrire la garde du PUT**

Remplace le début de `PUT` :

```ts
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
```

par :

```ts
export async function PUT(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("settings.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const body = await req.json();
```

- [ ] **Step 4 : Accepter `photos` et remplacer l'upsert par un update**

Dans le destructuring du corps, ajoute `photos` :

```ts
  const {
    salonName,
    category,
    description,
    address,
    city,
    phone,
    photos,
    openingHours,
    matriculeFiscal,
    receiptFooter,
  } = body;
```

Puis remplace **tout** l'appel `prisma.providerProfile.upsert({...})` par un `update` —
l'employé a forcément un profil existant, la branche `create` n'a plus de sens :

```ts
  const profile = await prisma.providerProfile.update({
    where: { id: employee.providerId },
    data: {
      salonName,
      category,
      description,
      address,
      city,
      phone,
      openingHours,
      ...(photos !== undefined ? { photos } : {}),
      ...(matriculeFiscal !== undefined ? { matriculeFiscal: matriculeFiscal || null } : {}),
      ...(receiptFooter !== undefined ? { receiptFooter: receiptFooter || null } : {}),
    },
  });
```

Ne touche pas au bloc de validation `isValidOpeningHours` / `receiptFooter.length > 200`,
ni au `regenerateAllProviderSlots(profile.id)` de la fin.

- [ ] **Step 5 : Vérifier**

```bash
npx tsc --noEmit
npx eslint src/app/api/provider/profile/route.ts
npm test
```

Attendu : aucune erreur sur ce fichier, 125 tests passants.

- [ ] **Step 6 : Commit**

```bash
git add src/app/api/provider/profile/route.ts
git commit -m "fix(settings): l'API profil accepte la session employe PIN

Un proprietaire ouvre la caisse avec son code PIN, pas avec son mot de
passe : la garde PROVIDER-only rendait le profil non modifiable depuis
la tablette. Accepte aussi photos, colonne existante jamais ecrite."
```

---

## Task 3 : La route de comptage des conflits

**Files:**
- Create: `src/app/api/pos/settings/conflicts/route.ts`

Route en **lecture seule**, sans effet de bord : on peut l'appeler à chaque tentative
d'enregistrement sans risque.

- [ ] **Step 1 : Créer le fichier**

Crée `src/app/api/pos/settings/conflicts/route.ts` :

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { isValidOpeningHours, type OpeningHours } from "@/lib/opening-hours";
import { findConflicts } from "@/lib/booking-conflicts";

/**
 * Rendez-vous deja pris qui tomberaient hors des horaires proposes.
 *
 * Lecture seule : aucun effet de bord, appelable avant chaque enregistrement.
 * On interroge TimeSlot (qui porte startTime et bookedCount) plutot que
 * Booking : plus direct, et evite de joindre trois tables.
 */
export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("settings.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const raw = req.nextUrl.searchParams.get("openingHours");
  if (!raw) {
    return NextResponse.json({ error: "Horaires manquants" }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Horaires illisibles" }, { status: 400 });
  }
  if (!isValidOpeningHours(parsed)) {
    return NextResponse.json({ error: "Horaires d'ouverture invalides" }, { status: 400 });
  }

  const booked = await prisma.timeSlot.findMany({
    where: {
      startTime: { gte: new Date() },
      bookedCount: { gt: 0 },
      offer: { providerId: employee.providerId },
    },
    select: { startTime: true, offer: { select: { title: true } } },
  });

  const conflicts = findConflicts(
    booked.map((s) => ({ startTime: s.startTime, offerTitle: s.offer.title })),
    parsed as OpeningHours,
  );

  return NextResponse.json({
    conflicts: conflicts.map((c) => ({
      startTime: c.startTime.toISOString(),
      offerTitle: c.offerTitle,
    })),
  });
}
```

- [ ] **Step 2 : Vérifier**

```bash
npx tsc --noEmit
npx eslint "src/app/api/pos/settings/conflicts/route.ts"
```

Attendu : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add "src/app/api/pos/settings/conflicts/route.ts"
git commit -m "feat(settings): route de comptage des rendez-vous hors horaires"
```

---

## Task 4 : L'onglet Salon

**Files:**
- Create: `src/components/pos/settings/salon-form.tsx`

Neuf champs. Deux garde-fous obligatoires : le bouton *Enregistrer* désactivé pendant un
upload (`onUploadingChange` de `<ImageUpload>` — sans lui on enregistre `photos: []`
pendant que le fichier monte, bug déjà vécu deux fois dans ce dépôt, règle 7 de
`CLAUDE.md`), et un compteur de caractères sur le pied de ticket pour que la limite de 200
se voie avant le 400 du serveur.

- [ ] **Step 1 : Créer le fichier**

Crée `src/components/pos/settings/salon-form.tsx` :

```tsx
"use client";

import { useState } from "react";
import { ImageUpload } from "@/components/image-upload";

export type SalonProfile = {
  salonName: string;
  category: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  photos: string[];
  matriculeFiscal: string | null;
  receiptFooter: string | null;
};

const CATEGORIES = [
  { value: "COIFFURE", label: "Coiffure" },
  { value: "ESTHETIQUE", label: "Esthétique" },
  { value: "ONGLERIE", label: "Onglerie" },
  { value: "MASSAGE", label: "Massage" },
  { value: "PARFUMERIE", label: "Parfumerie" },
  { value: "AUTRE", label: "Autre" },
];

const FOOTER_MAX = 200;

export function SalonForm({ initial }: { initial: SalonProfile }) {
  const [form, setForm] = useState({
    salonName: initial.salonName,
    category: initial.category,
    description: initial.description ?? "",
    address: initial.address ?? "",
    city: initial.city ?? "",
    phone: initial.phone ?? "",
    photos: initial.photos ?? [],
    matriculeFiscal: initial.matriculeFiscal ?? "",
    receiptFooter: initial.receiptFooter ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setOk(false);
  }

  async function save() {
    if (busy || uploading || !form.salonName.trim()) return;
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch("/api/provider/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salonName: form.salonName.trim(),
          category: form.category,
          description: form.description.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          phone: form.phone.trim() || null,
          photos: form.photos,
          matriculeFiscal: form.matriculeFiscal.trim() || null,
          receiptFooter: form.receiptFooter.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Enregistrement impossible.");
        return;
      }
      setOk(true);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  const footerTrop = form.receiptFooter.length > FOOTER_MAX;

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
      {ok && (
        <div className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
          Profil enregistré.
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
          Nom du salon
        </span>
        <input
          className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm"
          value={form.salonName}
          onChange={(e) => patch("salonName", e.target.value)}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
            Catégorie
          </span>
          <select
            className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm"
            value={form.category}
            onChange={(e) => patch("category", e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
            Téléphone
          </span>
          <input
            className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm"
            value={form.phone}
            onChange={(e) => patch("phone", e.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
          Adresse
        </span>
        <input
          className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm"
          value={form.address}
          onChange={(e) => patch("address", e.target.value)}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
            Ville
          </span>
          <input
            className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm"
            value={form.city}
            onChange={(e) => patch("city", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
            Matricule fiscal
          </span>
          <input
            className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm"
            value={form.matriculeFiscal}
            onChange={(e) => patch("matriculeFiscal", e.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
          Description
        </span>
        <textarea
          rows={3}
          className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm"
          value={form.description}
          onChange={(e) => patch("description", e.target.value)}
        />
      </label>

      <div>
        <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
          Photos du salon
        </span>
        <ImageUpload
          images={form.photos}
          onChange={(photos) => patch("photos", photos)}
          onUploadingChange={setUploading}
          max={5}
        />
      </div>

      <label className="block">
        <span className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-pos-ink-3">
          <span>Pied de ticket</span>
          <span className={footerTrop ? "text-red-600" : ""}>
            {form.receiptFooter.length}/{FOOTER_MAX}
          </span>
        </span>
        <input
          className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm"
          placeholder="Merci de votre visite !"
          value={form.receiptFooter}
          onChange={(e) => patch("receiptFooter", e.target.value)}
        />
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={busy || uploading || footerTrop || !form.salonName.trim()}
          className="rounded bg-pos-ink px-4 py-2 text-sm font-medium text-pos-bg disabled:opacity-50"
        >
          {uploading ? "Upload en cours…" : busy ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier**

```bash
npx tsc --noEmit
npx eslint src/components/pos/settings/salon-form.tsx
```

Attendu : aucune erreur, ESLint silencieux.

- [ ] **Step 3 : Commit**

```bash
git add src/components/pos/settings/salon-form.tsx
git commit -m "feat(settings): onglet Salon, neuf champs editables

photos et receiptFooter sont des colonnes existantes qu'aucune interface
ne savait editer."
```

---

## Task 5 : L'onglet Horaires et le dialogue de conflits

**Files:**
- Create: `src/components/pos/settings/hours-form.tsx`

`<OpeningHoursEditor>` existe déjà (`src/components/opening-hours-editor.tsx`, 109 lignes,
interface `{ value, onChange }`) et est réutilisé **sans modification**.

Le flux d'enregistrement : on interroge d'abord la route de conflits ; s'il n'y en a
aucun, on enregistre directement ; sinon on affiche le dialogue et on attend la décision.

- [ ] **Step 1 : Créer le fichier**

Crée `src/components/pos/settings/hours-form.tsx` :

```tsx
"use client";

import { useState } from "react";
import { OpeningHoursEditor } from "@/components/opening-hours-editor";
import { emptyOpeningHours, type OpeningHours } from "@/lib/opening-hours";

type Conflict = { startTime: string; offerTitle: string };

function formatConflict(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HoursForm({ initial }: { initial: OpeningHours | null }) {
  const [hours, setHours] = useState<OpeningHours>(initial ?? emptyOpeningHours());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);

  /** Ecrit vraiment les horaires. Appele directement s'il n'y a aucun
   *  conflit, ou depuis le dialogue apres confirmation. */
  async function persist() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/provider/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingHours: hours }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Enregistrement impossible.");
        return;
      }
      setConflicts(null);
      setOk(true);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  /** Verifie d'abord les rendez-vous deja pris hors des nouveaux horaires. */
  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const url = `/api/pos/settings/conflicts?openingHours=${encodeURIComponent(
        JSON.stringify(hours),
      )}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Vérification impossible.");
        setBusy(false);
        return;
      }
      if (json.conflicts.length > 0) {
        setConflicts(json.conflicts as Conflict[]);
        setBusy(false);
        return;
      }
    } catch {
      setError("Erreur réseau.");
      setBusy(false);
      return;
    }
    await persist();
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
      {ok && (
        <div className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
          Horaires enregistrés.
        </div>
      )}

      <OpeningHoursEditor value={hours} onChange={(h) => { setHours(h); setOk(false); }} />

      <p className="text-xs text-pos-ink-3">
        Vos créneaux de réservation sont recalculés sur 30 jours à chaque
        enregistrement.
      </p>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded bg-pos-ink px-4 py-2 text-sm font-medium text-pos-bg disabled:opacity-50"
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {conflicts && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-pos-border bg-pos-surface p-5 shadow-2xl"
          >
            <h2 className="text-base font-semibold text-pos-ink">
              {conflicts.length === 1
                ? "1 rendez-vous est déjà pris en dehors de ces horaires"
                : `${conflicts.length} rendez-vous sont déjà pris en dehors de ces horaires`}
            </h2>

            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm text-pos-ink-2">
              {conflicts.map((c, i) => (
                <li key={`${c.startTime}-${i}`}>
                  {formatConflict(c.startTime)} — {c.offerTitle}
                </li>
              ))}
            </ul>

            <p className="mt-3 text-sm text-pos-ink-3">
              Ils seront honorés : vos clientes ont déjà réservé. Vous devrez ouvrir ce
              jour-là ou les contacter.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConflicts(null)}
                disabled={busy}
                className="rounded border border-pos-border px-3 py-2 text-sm text-pos-ink-2 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={persist}
                disabled={busy}
                className="rounded bg-pos-ink px-3 py-2 text-sm font-medium text-pos-bg disabled:opacity-50"
              >
                {busy ? "Enregistrement…" : "Enregistrer quand même"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier**

```bash
npx tsc --noEmit
npx eslint src/components/pos/settings/hours-form.tsx
```

Attendu : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add src/components/pos/settings/hours-form.tsx
git commit -m "feat(settings): onglet Horaires avec confirmation des rendez-vous hors plage

regenerateOfferSlots epargne les creneaux reserves : aucun rendez-vous
n'est perdu. Le dialogue existe pour qu'un salon qui ferme le samedi
sache qu'il a trois clientes ce samedi-la."
```

---

## Task 6 : Assembler la page à deux onglets

**Files:**
- Modify: `src/app/(pos)/pos/settings/page.tsx`

La page actuelle est un server component qui charge le profil et l'affiche en lecture
seule. Elle garde son chargement et sa garde `settings.manage` ; seul l'affichage change.

Les onglets ont besoin d'état client, donc le rendu passe dans un petit composant client.

- [ ] **Step 1 : Créer le conteneur d'onglets**

Crée `src/components/pos/settings/settings-tabs.tsx` :

```tsx
"use client";

import { useState } from "react";
import { SalonForm, type SalonProfile } from "@/components/pos/settings/salon-form";
import { HoursForm } from "@/components/pos/settings/hours-form";
import type { OpeningHours } from "@/lib/opening-hours";

export function SettingsTabs({
  profile,
  openingHours,
}: {
  profile: SalonProfile;
  openingHours: OpeningHours | null;
}) {
  const [tab, setTab] = useState<"salon" | "horaires">("salon");

  const onglet = (id: "salon" | "horaires", label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      aria-selected={tab === id}
      role="tab"
      className={`px-4 py-2 text-sm font-medium ${
        tab === id
          ? "border-b-2 border-pos-ink text-pos-ink"
          : "text-pos-ink-3 hover:text-pos-ink-2"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div role="tablist" className="mt-4 flex border-b border-pos-border">
        {onglet("salon", "Salon")}
        {onglet("horaires", "Horaires")}
      </div>

      <div className="mt-6">
        {tab === "salon" ? (
          <SalonForm initial={profile} />
        ) : (
          <HoursForm initial={openingHours} />
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2 : Réécrire la page**

Remplace le contenu de `src/app/(pos)/pos/settings/page.tsx` par :

```tsx
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { SettingsTabs } from "@/components/pos/settings/settings-tabs";
import { isValidOpeningHours, type OpeningHours } from "@/lib/opening-hours";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profil du salon — Salonista" };

/**
 * Profil du salon, editable depuis la caisse.
 *
 * Deux onglets separes : les champs de profil ne touchent jamais aux
 * creneaux, seuls les horaires declenchent regenerateAllProviderSlots.
 */
export default async function SettingsPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["settings.manage"]) redirect("/pos");

  const provider = (await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
    select: {
      salonName: true,
      category: true,
      description: true,
      address: true,
      city: true,
      phone: true,
      photos: true,
      matriculeFiscal: true,
      receiptFooter: true,
      openingHours: true,
    } as never,
  })) as {
    salonName: string;
    category: string;
    description: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    photos: string[];
    matriculeFiscal: string | null;
    receiptFooter: string | null;
    openingHours: unknown;
  } | null;

  if (!provider) redirect("/pos");

  const hours = isValidOpeningHours(provider.openingHours)
    ? (provider.openingHours as OpeningHours)
    : null;

  return (
    <div className="h-full overflow-y-auto bg-pos-bg p-4 md:p-6" data-pos-theme>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-lg font-semibold text-pos-ink md:text-xl">Profil du salon</h1>
        <p className="mt-1 text-sm text-pos-ink-3">
          Ces informations apparaissent sur vos tickets et sur votre page publique.
        </p>

        <SettingsTabs
          profile={{
            salonName: provider.salonName,
            category: provider.category,
            description: provider.description,
            address: provider.address,
            city: provider.city,
            phone: provider.phone,
            photos: provider.photos ?? [],
            matriculeFiscal: provider.matriculeFiscal,
            receiptFooter: provider.receiptFooter,
          }}
          openingHours={hours}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Vérifier — le build compte ici**

```bash
npx tsc --noEmit
npx eslint "src/app/(pos)/pos/settings/page.tsx" src/components/pos/settings/settings-tabs.tsx
npm test
npm run build
```

Attendu : aucune erreur, 125 tests, **build réussi**.

Si le build échoue sur une connexion PostgreSQL refusée (`ECONNREFUSED` sur
`localhost:5433`) : le prérendu de `/` et `/sitemap.xml` interroge la base. Démarre un
PostgreSQL jetable — voir Task 8 Step 1 — puis relance. Ce n'est pas ton code.

Si le build échoue sur `caniuse-lite` ou `jose` manquants : `rm -rf node_modules && npm
install`, c'est une corruption connue (règle 7 de `CLAUDE.md`).

- [ ] **Step 4 : Commit**

```bash
git add "src/app/(pos)/pos/settings/page.tsx" src/components/pos/settings/settings-tabs.tsx
git commit -m "feat(settings): page profil a deux onglets, editable"
```

---

## Task 7 : Retirer le bouton mort et vérifier l'ensemble

**Files:** aucun — tâche de vérification

Le bouton « Modifier — bientôt » a disparu avec la réécriture de la Task 6. Cette tâche
confirme qu'il ne reste aucune trace de l'état lecture seule.

- [ ] **Step 1 : Chercher les restes**

```bash
grep -rn "bientôt\|bientot" src/app/\(pos\)/ src/components/pos/ || echo "aucune trace"
```

Attendu : `aucune trace`. S'il en reste ailleurs (rail, page d'accueil POS), **ne les
touche pas** — ce sont les onglets Colab et Store, volontairement verrouillés.

- [ ] **Step 2 : Vérification complète**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

Attendu : 125 tests, pas d'erreur de type nouvelle (seules restent celles de
`wizard-client.tsx` et `rewards.test.ts`), lint propre sur les fichiers touchés, build
réussi.

- [ ] **Step 3 : Commit s'il y a eu des correctifs**

Si rien n'a bougé, ne commite rien.

---

## Task 8 : Vérification manuelle sur base réelle

Aucun test automatisé ne couvre les composants React (pas de jsdom dans ce dépôt). Cette
checklist est la vraie vérification — **ne la saute pas**.

**Files:** aucun

- [ ] **Step 1 : Préparer une base jetable**

```bash
docker run -d --name salonista-lotc -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=beaute_marketplace -p 5433:5432 postgres:16
docker exec salonista-lotc pg_isready -U postgres
npx prisma migrate deploy
```

Le `DATABASE_URL` du `.env` pointe déjà sur `localhost:5433`.

Vérifie que le port 3000 est libre — un conteneur `users-service` l'occupe parfois :

```bash
docker ps --format "{{.Names}} {{.Ports}}"
```

- [ ] **Step 2 : Créer un salon avec un rendez-vous le samedi**

Il te faut : un salon avec des horaires incluant le samedi, une offre publiée, et **une
réservation confirmée un samedi à venir**. C'est le scénario central.

Crée le jeu de données via l'inscription prestataire puis la réservation depuis la page
publique du salon, ou par un script `npx tsx`. Le point non négociable : à la fin, il doit
exister un `TimeSlot` avec `bookedCount > 0` un samedi futur.

- [ ] **Step 3 : Dérouler la checklist**

Toute ligne qui échoue = la tâche n'est pas finie.

- [ ] `/pos/settings` s'ouvre sur l'onglet **Salon**, les champs sont pré-remplis.
- [ ] Modifier le nom du salon, Enregistrer → « Profil enregistré. », et le nouveau nom
      apparaît sur la page publique du salon.
- [ ] Ajouter une photo → visible sur la page publique.
- [ ] Pendant l'upload d'une photo, le bouton affiche **« Upload en cours… »** et reste
      **désactivé**.
- [ ] Taper 201 caractères dans le pied de ticket → le compteur passe en rouge et le
      bouton Enregistrer est **désactivé** (aucun appel réseau).
- [ ] Passer à l'onglet **Horaires** → l'éditeur affiche les horaires actuels.
- [ ] Élargir les horaires (ouvrir un jour fermé), Enregistrer → aucun dialogue, «
      Horaires enregistrés. », et de nouveaux créneaux apparaissent à la réservation.
- [ ] **Le test central** : fermer le samedi (supprimer les plages du samedi), Enregistrer
      → le dialogue liste le rendez-vous de samedi avec sa date et le nom du service.
- [ ] Cliquer **Annuler** → rien n'est enregistré, les horaires du samedi sont toujours là
      après rechargement de la page.
- [ ] Refermer le samedi, cliquer **Enregistrer quand même** → horaires enregistrés, et
      **le rendez-vous de samedi existe toujours** (visible dans `/pos` ou le panneau des
      RDV). C'est le point le plus important de toute la checklist.
- [ ] Se connecter **par PIN en OWNER**, aller dans Profil, modifier un champ → pas de
      401 (c'est le changement de la Task 2).
- [ ] Se connecter **par PIN en MANAGER**, tenter `/pos/settings` → redirection vers
      `/pos`.
- [ ] Sur iPhone (DevTools, 375px) : les deux onglets sont lisibles, l'éditeur d'horaires
      reste utilisable, le dialogue tient dans l'écran.

- [ ] **Step 4 : Nettoyer**

```bash
docker rm -f salonista-lotc
git status --short
```

Attendu : arbre propre, aucun fichier temporaire laissé derrière.

- [ ] **Step 5 : Commit si des correctifs ont été nécessaires**

```bash
git add -A
git commit -m "fix(settings): correctifs issus de la verification manuelle"
```

---

## Task 9 : Ouvrir la pull request

**Files:** aucun

- [ ] **Step 1 : Vérification finale**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

- [ ] **Step 2 : Pousser**

```bash
git push -u origin pos-settings
```

- [ ] **Step 3 : Ouvrir la PR**

`gh` n'est pas installé sur cette machine. Après le push, GitHub affiche une URL
`https://github.com/eyaalimi/salonista/pull/new/pos-settings` — ouvre-la dans le
navigateur et utilise ce corps :

```markdown
Rend le profil du salon et les horaires d'ouverture modifiables depuis la caisse. Dernier manque fonctionnel de la consolidation du portail prestataire (lots A et B livrés).

## Changements

- **`/pos/settings` devient éditable**, en deux onglets : Salon (9 champs) et Horaires. Les deux enregistrent séparément — éditer un téléphone ne peut jamais toucher un créneau de réservation.
- **Confirmation avant de réduire les horaires.** Si des rendez-vous déjà pris tombent hors des nouvelles plages, un dialogue les liste avant d'écrire. Ils sont honorés de toute façon (`regenerateOfferSlots` épargne les créneaux réservés) — le but est que le salon le sache avant de fermer le samedi.
- **La règle de conflit est une fonction pure testée** (`src/lib/booking-conflicts.ts`, 13 tests) : jour de semaine, plages multiples, bornes exactes d'ouverture et de fermeture.
- **`/api/provider/profile` accepte la session employé PIN.** Un propriétaire ouvre la caisse avec son code, pas son mot de passe : la garde PROVIDER-only rendait le profil non modifiable depuis la tablette. Route sans aucun appelant avant ce lot, donc rien à casser.
- **`photos` devient éditable** — colonne existante qu'aucune interface n'écrivait.

## Non inclus, volontairement

- Colab et Store restent verrouillés (décision commerciale).
- `lat`/`lng` non éditables : demanderait un géocodage.
- `/prestataire/fidelite` : **déjà** une redirection depuis le lot A, il n'y avait rien à nettoyer.

## Vérification

`npm test` 125/125 · `tsc --noEmit` (seules restent deux erreurs pré-existantes) · `eslint` propre · `npm run build` réussi.

Checklist manuelle déroulée, dont le test central : fermer le samedi alors qu'un rendez-vous y est pris → le dialogue l'annonce, et après confirmation **le rendez-vous existe toujours**.
```

**Ne merge pas toi-même** — un push sur `main` déclenche le déploiement automatique vers
Lightsail. Le merge est la décision du propriétaire.

---

## Notes de conception

**Pourquoi exporter `toMinutes` et `dayKeyFromDate` plutôt que les réécrire ?** Parce que
deux implémentations du même calcul de temps divergent au premier changement, et qu'une
divergence entre « quels créneaux j'engendre » et « quels créneaux je considère en
conflit » produirait des faux positifs invisibles en test.

**Pourquoi tester le début du rendez-vous et pas sa durée complète ?** Un rendez-vous qui
commence à 17h45 et déborde de dix minutes après la fermeture n'est pas un problème pour
le salon. Un rendez-vous qui commence un jour fermé, si. `isContinuousAvailable` (déjà
dans `opening-hours.ts`) répond à une autre question — « toute la prestation tient-elle
dans une plage ? » — utile à la réservation, pas ici.

**Pourquoi `update` et non `upsert` dans le PUT ?** L'ancienne route acceptait un
`userId` de session et pouvait créer un profil manquant. Avec `requirePermission`,
l'employé porte déjà un `providerId` : le profil existe forcément, et la branche `create`
serait du code mort qui masquerait une incohérence de données.
