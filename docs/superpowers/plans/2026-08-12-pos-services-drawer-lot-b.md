# Lot B — Drawer d'édition des services — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre les neuf champs d'un service modifiables depuis la caisse, via un panneau latéral ouvert par `?edit=<id>`.

**Architecture:** Un composant client autonome `<ServiceEditDrawer>` charge sa propre offre par `GET /api/offers/[id]` et la sauvegarde par `PUT`. La liste des services l'ouvre en poussant `?edit=<id>` dans l'URL, ce qui rend le drawer atteignable aussi par lien collé. Côté serveur, la règle de validation de publication est extraite en fonction pure testable (`src/lib/offer-publish.ts`) sur le modèle de `src/lib/verify-authz.ts`, et le garde d'accès en lecture est étendu aux sessions employé PIN.

**Tech Stack:** Next.js 16.2 (App Router), React 19, Tailwind v4 (tokens `pos-*`), Prisma 7, Vitest (environnement `node`), TypeScript strict.

**Spec:** [docs/superpowers/specs/2026-08-12-pos-services-drawer-lot-b-design.md](../specs/2026-08-12-pos-services-drawer-lot-b-design.md)

---

## Contexte pour l'ingénieur

Tu travailles sur **Salonista**, une marketplace beauté tunisienne. La partie qui nous
occupe est la **PWA de caisse** (routes sous `/pos`), utilisée sur tablette par les
salons. Le lot A a rapatrié le portail prestataire dans cette PWA et supprimé les
anciennes pages `/prestataire/offres`. Résultat : `/pos/services` sait créer un service
et basculer deux champs, mais ne sait pas l'éditer. C'est ce que ce lot corrige.

**Cinq choses à savoir avant de toucher au code :**

1. **L'argent est en `Decimal(10, 3)`** — le dinar tunisien a 3 décimales (millimes).
   L'API renvoie les prix en `string` (`"35.000"`). Ne les convertis pas en `number`
   pour faire de l'arithmétique. Pour l'affichage, `formatDT()` de `src/lib/money.ts`
   produit `"35,000 DT"`.

2. **Deux modèles d'authentification coexistent.** Un propriétaire se connecte par
   email/mot de passe (session `PROVIDER`) ; une caissière se connecte par un code PIN
   (session avec `session.employee`). `getCurrentEmployee()` dans
   `src/lib/employee-session.ts` réconcilie les deux et renvoie toujours un employé avec
   ses permissions. **Toute route de la caisse doit passer par lui**, jamais par
   `session.user.role === "PROVIDER"` seul — sinon les caissières prennent un 401.

3. **Les photos uploadées ne passent pas par l'optimiseur Next.** Utilise
   `<UploadedImage>` (`src/components/uploaded-image.tsx`), jamais `<Image>`, pour tout
   chemin `/uploads/...`. `<ImageUpload>` le fait déjà correctement.

4. **Vitest tourne en `environment: "node"`** et n'inclut que `src/**/*.test.ts(x)`.
   Il n'y a **ni jsdom, ni @testing-library/react** dans ce dépôt. Les composants React
   ne sont donc pas testables unitairement ici, et **ce plan n'en ajoute pas** — c'est
   hors périmètre. Seule la Task 1 est en TDD, sur de la logique pure. Le reste est
   vérifié par `tsc`, ESLint, et la checklist manuelle de la Task 7.

5. **L'UI est en français.** Libellés, messages d'erreur, commentaires de code
   (le dépôt mélange les deux dans les commentaires ; suis le fichier que tu édites).

**Commandes utiles :**

```bash
npm test              # vitest run — 99 tests actuellement, doit rester vert
npx tsc --noEmit      # typecheck
npm run lint          # ESLint
npm run dev           # serveur de dev (Turbopack), port 3000
```

---

## Structure des fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/lib/offer-publish.ts` | Règle pure : quels champs manquent pour publier une offre | **Créer** |
| `src/lib/offer-publish.test.ts` | Tests de la règle ci-dessus | **Créer** |
| `src/components/pos/service-edit-drawer.tsx` | Le panneau d'édition, autonome (charge + sauvegarde) | **Créer** |
| `src/app/api/offers/[id]/route.ts` | Consommer la règle pure ; ouvrir le GET aux employés PIN | **Modifier** |
| `src/components/pos/services-list-client.tsx` | Ouvrir le drawer sur `?edit=`, patcher la ligne après save | **Modifier** |
| `src/app/(pos)/pos/services/page.tsx` | `<Suspense>` autour du composant client | **Modifier** |

Le drawer est un **fichier séparé** : `services-list-client.tsx` fait déjà 373 lignes,
y ajouter ~350 lignes le rendrait difficile à tenir en tête d'un seul regard.

---

## Task 0 : Créer la branche

**Files:** aucun

- [ ] **Step 1 : Vérifier que l'arbre est propre et qu'on est à jour sur main**

```bash
git status --short
git checkout main
git pull
```

Attendu : `git status --short` ne renvoie rien. Si l'arbre est sale, arrête-toi et
signale-le — ne commence pas par-dessus des changements non commités.

- [ ] **Step 2 : Créer la branche de travail**

```bash
git checkout -b pos-services-drawer
```

Attendu : `Switched to a new branch 'pos-services-drawer'`

---

## Task 1 : La règle de publication, en fonction pure (TDD)

**Pourquoi cette tâche existe.** La validation de publication est aujourd'hui inline
dans `PUT /api/offers/[id]` (lignes 85-106), mêlée à Prisma et à `NextResponse`. On ne
peut donc pas la tester sans base de données. Le dépôt a déjà résolu exactement ce
problème pour l'autorisation avec `src/lib/verify-authz.ts` : une fonction pure sans
import Prisma, testée en isolation, consommée par la route. On applique le même
découpage.

Au passage, la règle change : **le prix barré devient facultatif**. Un salon peut
publier un service à son prix plein, sans promotion. La photo reste obligatoire — sans
elle, l'offre est de toute façon filtrée du feed par `photos: { isEmpty: false }`, et la
publier ne produirait qu'un statut mensonger.

**Files:**
- Create: `src/lib/offer-publish.ts`
- Create: `src/lib/offer-publish.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Crée `src/lib/offer-publish.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { missingForPublish } from "./offer-publish";

describe("missingForPublish", () => {
  const complet = {
    category: "COIFFURE",
    originalPrice: "50.000",
    discountPrice: "35.000",
    photos: ["/uploads/a.jpg"],
  };

  it("ne renvoie rien quand tout est present", () => {
    expect(missingForPublish(complet)).toEqual([]);
  });

  it("exige une categorie", () => {
    expect(missingForPublish({ ...complet, category: null })).toEqual(["catégorie"]);
  });

  it("exige au moins une photo", () => {
    expect(missingForPublish({ ...complet, photos: [] })).toEqual(["au moins une photo"]);
  });

  it("accepte un prix barre absent — la promotion est facultative", () => {
    expect(missingForPublish({ ...complet, originalPrice: null })).toEqual([]);
  });

  it("refuse un prix barre inferieur au prix de vente", () => {
    expect(
      missingForPublish({ ...complet, originalPrice: "20.000", discountPrice: "35.000" }),
    ).toEqual(["prix barré ≥ prix actuel"]);
  });

  it("accepte un prix barre egal au prix de vente", () => {
    expect(
      missingForPublish({ ...complet, originalPrice: "35.000", discountPrice: "35.000" }),
    ).toEqual([]);
  });

  it("compare les prix en millimes, sans derive flottante", () => {
    // 0.1 + 0.2 === 0.30000000000000004 en flottant : la comparaison doit
    // passer par des entiers pour que 0.300 barre 0.300 soit accepte.
    expect(
      missingForPublish({ ...complet, originalPrice: "0.300", discountPrice: "0.300" }),
    ).toEqual([]);
  });

  it("accepte les Decimal de Prisma (objets avec toString)", () => {
    const decimalLike = (s: string) => ({ toString: () => s });
    expect(
      missingForPublish({
        ...complet,
        originalPrice: decimalLike("50.000"),
        discountPrice: decimalLike("35.000"),
      }),
    ).toEqual([]);
  });

  it("cumule les manques dans un ordre stable", () => {
    expect(
      missingForPublish({
        category: null,
        originalPrice: "10.000",
        discountPrice: "35.000",
        photos: [],
      }),
    ).toEqual(["catégorie", "prix barré ≥ prix actuel", "au moins une photo"]);
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
npx vitest run src/lib/offer-publish.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./offer-publish"`.

- [ ] **Step 3 : Écrire l'implémentation minimale**

Crée `src/lib/offer-publish.ts` :

```ts
import { toMillimes, type Money } from "@/lib/money";

/**
 * Etat d'une offre du point de vue de la publication sur le feed public.
 * Volontairement structurel (pas de type Prisma) pour que ce module reste
 * importable par vitest sans initialiser Prisma — cf. src/lib/verify-authz.ts,
 * meme contrainte.
 */
export type PublishCandidate = {
  category: string | null | undefined;
  originalPrice: Money | null | undefined;
  discountPrice: Money;
  photos: string[] | null | undefined;
};

/**
 * Liste, en francais, ce qui empeche de publier cette offre sur salonista.tn.
 * Tableau vide = publiable.
 *
 * Le prix barre est FACULTATIF : un salon peut publier au prix plein, sans
 * promotion. On ne le valide que s'il est fourni, et seulement pour refuser
 * l'incoherence d'affichage "barre 20 DT / paye 35 DT".
 *
 * La photo, elle, est obligatoire : le feed filtre sur photos.isEmpty, donc
 * publier sans photo produirait un statut mensonger (marque "en ligne", jamais
 * visible).
 */
export function missingForPublish(offer: PublishCandidate): string[] {
  const missing: string[] = [];

  if (!offer.category) {
    missing.push("catégorie");
  }

  if (offer.originalPrice != null) {
    // Comparaison en millimes entiers : le dinar a 3 decimales et la
    // comparaison flottante derive (cf. src/lib/money.ts).
    if (toMillimes(offer.originalPrice) < toMillimes(offer.discountPrice)) {
      missing.push("prix barré ≥ prix actuel");
    }
  }

  if (!offer.photos || offer.photos.length === 0) {
    missing.push("au moins une photo");
  }

  return missing;
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

```bash
npx vitest run src/lib/offer-publish.test.ts
```

Attendu : PASS, 9 tests.

- [ ] **Step 5 : Lancer la suite complète (aucune régression)**

```bash
npm test
```

Attendu : 108 tests passent (99 existants + 9 nouveaux), 7 fichiers.

- [ ] **Step 6 : Commit**

```bash
git add src/lib/offer-publish.ts src/lib/offer-publish.test.ts
git commit -m "feat(offers): regle de publication en fonction pure testable

Le prix barre devient facultatif : un salon peut publier au prix plein.
La photo reste obligatoire — sans elle le feed filtre l'offre de toute
facon, et la publier ne produirait qu'un statut mensonger."
```

---

## Task 2 : Brancher la règle pure dans la route PUT

**Files:**
- Modify: `src/app/api/offers/[id]/route.ts:85-106`

- [ ] **Step 1 : Ajouter l'import**

En haut de `src/app/api/offers/[id]/route.ts`, après l'import de `employee-session`
(ligne 6), ajoute :

```ts
import { missingForPublish } from "@/lib/offer-publish";
```

- [ ] **Step 2 : Remplacer le bloc de validation inline**

Remplace **intégralement** le bloc `if (isPublishTransition) { … }` (lignes 85-106,
depuis `if (isPublishTransition) {` jusqu'à l'accolade fermante avant
`let nextDuration`) par :

```ts
  if (isPublishTransition) {
    const missing = missingForPublish({
      category: body.category ?? offer.category,
      originalPrice: body.originalPrice ?? offer.originalPrice,
      discountPrice: body.discountPrice ?? offer.discountPrice,
      photos: body.photos ?? offer.photos,
    });
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Publication impossible — champs manquants : ${missing.join(", ")}` },
        { status: 400 },
      );
    }
  }
```

Ne touche **pas** aux lignes 70-83 (`existingPublished`, `willBePublished`,
`isPublishTransition`) : ce sont les garde-fous du lot A. `willBePublished` est réutilisé
plus bas ligne 141 et ligne 149 — le supprimer casse la route.

- [ ] **Step 3 : Typecheck**

```bash
npx tsc --noEmit
```

Attendu : aucune erreur dans `src/app/api/offers/[id]/route.ts` ni
`src/lib/offer-publish.ts`.

- [ ] **Step 4 : Vérifier qu'aucun test ne régresse**

```bash
npm test
```

Attendu : 108 tests passent.

- [ ] **Step 5 : Commit**

```bash
git add src/app/api/offers/[id]/route.ts
git commit -m "refactor(offers): PUT consomme missingForPublish"
```

---

## Task 3 : Ouvrir le GET aux sessions employé PIN

**Pourquoi.** Le garde d'accès aux offres non publiées (lignes 26-44) n'autorise que
`ADMIN` et `PROVIDER`. Une caissière connectée par PIN n'a pas de session `PROVIDER` :
elle reçoit un 404 sur toute offre hors ligne — c'est-à-dire précisément celles que le
drawer sert à corriger. Sans cette tâche, la Task 5 ne peut pas fonctionner pour une
caissière.

Aucune permission particulière n'est exigée pour **lire** : la liste des services est
déjà visible par toute la caisse (`/pos/services` exige `products.manage` pour la page,
mais la fiche ne révèle rien de plus que la liste).

**Files:**
- Modify: `src/app/api/offers/[id]/route.ts:26-44`

- [ ] **Step 1 : Ajouter la branche employé dans le garde**

Dans le bloc `if (!isPublished) { … }`, après la branche `PROVIDER` (qui se termine
ligne 40 par l'accolade fermante du `else if`), insère une troisième branche. Le bloc
complet devient :

```ts
  // Check if unpublished — if so, only allow provider-owner, employee, or admin
  const isPublished = (offer as { publishedToMarketplace?: boolean }).publishedToMarketplace ?? false;
  if (!isPublished) {
    const session = await getServerSession(authOptions);
    let allowed = false;
    if (session?.user?.role === "ADMIN") {
      allowed = true;
    } else if (session?.user?.role === "PROVIDER") {
      const profile = await prisma.providerProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (profile?.id === offer.providerId) {
        allowed = true;
      }
    } else {
      // Session employe par PIN : pas de session PROVIDER, mais un droit
      // legitime de lire la fiche de son propre salon. Sans cette branche,
      // une caissiere prend un 404 sur toute offre hors ligne — donc
      // precisement celles que le drawer d'edition sert a corriger.
      const employee = await getCurrentEmployee();
      if (employee?.providerId === offer.providerId) {
        allowed = true;
      }
    }
    if (!allowed) {
      return NextResponse.json({ error: "Offre introuvable" }, { status: 404 });
    }
  }
```

- [ ] **Step 2 : Étendre l'import de `employee-session`**

Ligne 6, `requirePermission` et `toResponse` sont déjà importés. Ajoute
`getCurrentEmployee` :

```ts
import { getCurrentEmployee, requirePermission, toResponse } from "@/lib/employee-session";
```

- [ ] **Step 3 : Typecheck et lint**

```bash
npx tsc --noEmit && npm run lint
```

Attendu : aucune erreur nouvelle.

- [ ] **Step 4 : Commit**

```bash
git add src/app/api/offers/[id]/route.ts
git commit -m "fix(offers): le GET d'une offre hors ligne accepte la session employe PIN"
```

---

## Task 4 : Le drawer d'édition

**Files:**
- Create: `src/components/pos/service-edit-drawer.tsx`

Le modèle à suivre est `src/components/pos/customer-detail-drawer.tsx` : backdrop
`fixed inset-0 z-40`, panneau `fixed top-0 right-0 z-50 h-full w-full max-w-[480px]`,
fermeture par `Escape`, chargement au montage avec état `loading` / `error`.

Deux garde-fous **non négociables** :

- **Le bouton Enregistrer est désactivé pendant un upload** (`uploading` alimenté par
  `onUploadingChange`). Sans ça, un utilisateur rapide enregistre `photos: []` alors que
  le fichier est bien monté — c'est une race condition déjà rencontrée et documentée
  (règle 7 de `CLAUDE.md`).
- **La case Publier est désactivée sans photo**, avec la mention « Ajoutez une photo
  pour publier ». C'est le pendant client de la validation de la Task 1 : l'utilisateur
  voit pourquoi il ne peut pas, au lieu de récolter un 400.

- [ ] **Step 1 : Créer le fichier**

Crée `src/components/pos/service-edit-drawer.tsx` :

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import { ImageUpload } from "@/components/image-upload";

/** Forme minimale renvoyee par GET /api/offers/[id] et attendue par la liste. */
export type ServiceOffer = {
  id: string;
  title: string;
  description: string | null;
  discountPrice: string;
  originalPrice: string | null;
  category: string | null;
  durationMinutes: number;
  taxRate: string;
  active: boolean;
  publishedToMarketplace: boolean;
  photos: string[];
};

const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

const CATEGORIES = [
  { value: "COIFFURE", label: "Coiffure" },
  { value: "ESTHETIQUE", label: "Esthétique" },
  { value: "ONGLERIE", label: "Onglerie" },
  { value: "MASSAGE", label: "Massage" },
  { value: "PARFUMERIE", label: "Parfumerie" },
  { value: "AUTRE", label: "Autre" },
];

const TAX_PRESETS = [0, 7, 13, 19];

type FormState = {
  title: string;
  description: string;
  discountPrice: string;
  originalPrice: string;
  category: string;
  durationMinutes: number;
  taxRate: number;
  active: boolean;
  publishedToMarketplace: boolean;
  photos: string[];
};

export function ServiceEditDrawer({
  offerId,
  onClose,
  onSaved,
}: {
  offerId: string;
  onClose: () => void;
  onSaved: (updated: ServiceOffer) => void;
}) {
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showVitrine, setShowVitrine] = useState(false);

  // Chargement autonome : le drawer doit pouvoir s'ouvrir sur une URL collee,
  // sans que la liste ait ete hydratee au prealable.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/offers/${offerId}`);
        if (cancelled) return;
        if (!res.ok) {
          setError(
            res.status === 404 ? "Service introuvable." : "Impossible de charger le service.",
          );
          return;
        }
        const o = (await res.json()) as ServiceOffer;
        if (cancelled) return;
        setForm({
          title: o.title,
          description: o.description ?? "",
          discountPrice: String(o.discountPrice),
          originalPrice: o.originalPrice == null ? "" : String(o.originalPrice),
          category: o.category ?? "AUTRE",
          durationMinutes: o.durationMinutes,
          taxRate: Number(o.taxRate),
          active: o.active,
          publishedToMarketplace: o.publishedToMarketplace,
          photos: o.photos ?? [],
        });
        // La vitrine s'ouvre d'office quand il reste du travail : sans photo,
        // le service est marque en ligne mais filtre du feed.
        setShowVitrine(o.photos.length === 0);
      } catch {
        if (!cancelled) setError("Erreur réseau.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [offerId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) =>
      setForm((f) => (f ? { ...f, [key]: value } : f)),
    [],
  );

  const hasPhoto = (form?.photos.length ?? 0) > 0;

  async function save() {
    if (!form || busy || uploading) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          discountPrice: form.discountPrice,
          // Prix barre facultatif : chaine vide => null, pas 0.
          originalPrice: form.originalPrice.trim() === "" ? null : form.originalPrice,
          category: form.category,
          durationMinutes: form.durationMinutes,
          taxRate: form.taxRate,
          active: form.active,
          publishedToMarketplace: form.publishedToMarketplace,
          photos: form.photos,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Enregistrement impossible.");
        return;
      }
      onSaved({ ...json, photos: json.photos ?? [] } as ServiceOffer);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!form || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Désactivation impossible.");
        return;
      }
      onSaved({ ...json, photos: json.photos ?? [] } as ServiceOffer);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  const statut = !form
    ? null
    : form.publishedToMarketplace && hasPhoto
      ? { label: "En ligne", cls: "bg-green-50 text-green-800" }
      : form.publishedToMarketplace
        ? { label: "Incomplet", cls: "bg-amber-50 text-amber-800" }
        : { label: "Hors ligne", cls: "bg-pos-border text-pos-ink-2" };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30"
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Modifier le service"
        className="fixed top-0 right-0 z-50 h-full w-full max-w-[480px] bg-pos-surface shadow-2xl overflow-y-auto flex flex-col"
        data-pos-theme
      >
        <div className="sticky top-0 z-10 bg-pos-surface border-b border-pos-border px-5 py-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-pos-ink">Modifier le service</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full border border-pos-border text-pos-ink-2 hover:bg-pos-highlight"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <p className="p-5 text-sm text-pos-ink-3">Chargement…</p>
        ) : !form ? (
          <p className="p-5 text-sm text-red-600">{error ?? "Erreur"}</p>
        ) : (
          <>
            <div className="flex-1 p-5 space-y-5">
              {error && (
                <div className="px-3 py-2 rounded bg-red-50 text-red-800 text-sm">{error}</div>
              )}

              {/* ---- Section essentiel : ce qu'une caissiere corrige au quotidien ---- */}
              <label className="block">
                <span className="block text-xs uppercase tracking-wider text-pos-ink-3 mb-1">
                  Nom du service
                </span>
                <input
                  className="w-full px-3 py-2 rounded border border-pos-border bg-white text-sm"
                  value={form.title}
                  onChange={(e) => patch("title", e.target.value)}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs uppercase tracking-wider text-pos-ink-3 mb-1">
                    Prix (DT)
                  </span>
                  <input
                    type="number"
                    step="0.001"
                    className="w-full px-3 py-2 rounded border border-pos-border bg-white text-sm"
                    value={form.discountPrice}
                    onChange={(e) => patch("discountPrice", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs uppercase tracking-wider text-pos-ink-3 mb-1">
                    Durée
                  </span>
                  <select
                    className="w-full px-3 py-2 rounded border border-pos-border bg-white text-sm"
                    value={form.durationMinutes}
                    onChange={(e) => patch("durationMinutes", Number(e.target.value))}
                  >
                    {ALLOWED_DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} min
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <label className="block">
                  <span className="block text-xs uppercase tracking-wider text-pos-ink-3 mb-1">
                    TVA
                  </span>
                  <select
                    className="w-full px-3 py-2 rounded border border-pos-border bg-white text-sm"
                    value={form.taxRate}
                    onChange={(e) => patch("taxRate", Number(e.target.value))}
                  >
                    {TAX_PRESETS.map((t) => (
                      <option key={t} value={t}>
                        {t === 0 ? "Sans TVA" : `${t} %`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 px-3 py-2 rounded border border-pos-border bg-white text-sm">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => patch("active", e.target.checked)}
                  />
                  <span>Actif en caisse</span>
                </label>
              </div>

              {/* ---- Section vitrine : repliee sauf s'il reste du travail ---- */}
              <div className="border-t border-pos-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowVitrine((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 text-left"
                  aria-expanded={showVitrine}
                >
                  <span className="flex items-center gap-1 text-xs uppercase tracking-wider text-pos-ink-3">
                    {showVitrine ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Vitrine en ligne
                  </span>
                  {statut && (
                    <span className={`rounded px-2 py-0.5 text-xs ${statut.cls}`}>
                      {statut.label}
                    </span>
                  )}
                </button>

                {showVitrine && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <span className="block text-xs uppercase tracking-wider text-pos-ink-3 mb-1">
                        Photos
                      </span>
                      <ImageUpload
                        images={form.photos}
                        onChange={(photos) => patch("photos", photos)}
                        onUploadingChange={setUploading}
                        max={5}
                      />
                      {!hasPhoto && (
                        <p className="mt-2 text-xs text-amber-700">
                          Une photo est nécessaire pour apparaître sur salonista.tn.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="block text-xs uppercase tracking-wider text-pos-ink-3 mb-1">
                          Catégorie
                        </span>
                        <select
                          className="w-full px-3 py-2 rounded border border-pos-border bg-white text-sm"
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
                        <span className="block text-xs uppercase tracking-wider text-pos-ink-3 mb-1">
                          Prix barré
                        </span>
                        <input
                          type="number"
                          step="0.001"
                          placeholder="facultatif"
                          className="w-full px-3 py-2 rounded border border-pos-border bg-white text-sm"
                          value={form.originalPrice}
                          onChange={(e) => patch("originalPrice", e.target.value)}
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="block text-xs uppercase tracking-wider text-pos-ink-3 mb-1">
                        Description
                      </span>
                      <textarea
                        rows={3}
                        className="w-full px-3 py-2 rounded border border-pos-border bg-white text-sm"
                        value={form.description}
                        onChange={(e) => patch("description", e.target.value)}
                      />
                    </label>

                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={form.publishedToMarketplace}
                        disabled={!hasPhoto}
                        onChange={(e) => patch("publishedToMarketplace", e.target.checked)}
                      />
                      <span className={hasPhoto ? "text-pos-ink" : "text-pos-ink-3"}>
                        Publier sur salonista.tn
                        {!hasPhoto && (
                          <span className="block text-xs text-pos-ink-3">
                            Ajoutez une photo pour publier.
                          </span>
                        )}
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-pos-surface border-t border-pos-border px-5 py-4 flex items-center justify-between gap-3">
              {form.active ? (
                <button
                  type="button"
                  onClick={deactivate}
                  disabled={busy}
                  className="text-sm text-pos-ink-3 underline underline-offset-2 hover:text-pos-ink disabled:opacity-50"
                >
                  Désactiver ce service
                </button>
              ) : (
                <span className="text-xs text-pos-ink-3">Service désactivé</span>
              )}
              <button
                type="button"
                onClick={save}
                disabled={busy || uploading || !form.title.trim()}
                className="px-4 py-2 rounded bg-pos-ink text-pos-bg text-sm font-medium disabled:opacity-50"
              >
                {uploading ? "Upload en cours…" : busy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
```

- [ ] **Step 2 : Vérifier que `lucide-react` exporte bien ces trois icônes**

```bash
grep -o "ChevronDown\|ChevronRight\|\bX\b" node_modules/lucide-react/dist/lucide-react.d.ts | sort -u
```

Attendu : les trois noms apparaissent. `X` est déjà utilisé par
`customer-detail-drawer.tsx` ; `ChevronDown` et `ChevronRight` ne sont encore importés
nulle part dans ce dépôt — c'est normal, tu es le premier à en avoir besoin. Ne cherche
donc pas d'usage existant dans `src/`, il n'y en a pas.

- [ ] **Step 3 : Typecheck et lint**

```bash
npx tsc --noEmit && npm run lint
```

Attendu : aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add src/components/pos/service-edit-drawer.tsx
git commit -m "feat(pos): drawer d'edition complete d'un service

Deux sections : l'essentiel toujours visible (titre, prix, duree, TVA,
actif), la vitrine repliable (photos, categorie, prix barre, description,
publication) ouverte d'office quand il manque une photo."
```

---

## Task 5 : Ouvrir le drawer depuis la liste

**Files:**
- Modify: `src/components/pos/services-list-client.tsx`

Trois chemins convergent sur `?edit=<id>` : le clic sur une ligne, le clic sur un badge
`Photo manquante` / `Hors ligne` (les `<Link>` écrits au lot A, jusqu'ici inertes), et
l'URL collée. Après sauvegarde on **patche la ligne en mémoire** plutôt que de recharger
la liste : la caisse peut tenir une centaine de services sur une tablette lente.

- [ ] **Step 1 : Étendre le type `Offer` et les imports**

Remplace les lignes 1-17 de `src/components/pos/services-list-client.tsx` par :

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ServiceEditDrawer, type ServiceOffer } from "@/components/pos/service-edit-drawer";

type Offer = {
  id: string;
  title: string;
  discountPrice: string;
  durationMinutes: number;
  taxRate: string;
  active: boolean;
  publishedToMarketplace: boolean;
  photos: string[];
};

const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];
```

- [ ] **Step 2 : Ajouter l'état de navigation dans le composant**

Juste après `const newNameRef = useRef<HTMLInputElement>(null);` (ligne 65 d'origine),
insère :

```tsx
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const openEdit = useCallback(
    (id: string) => router.push(`/pos/services?edit=${id}`, { scroll: false }),
    [router],
  );
  const closeEdit = useCallback(
    () => router.push("/pos/services", { scroll: false }),
    [router],
  );

  // Patch local plutot que rechargement : la caisse peut tenir une centaine
  // de services sur une tablette lente.
  const applySaved = useCallback(
    (u: ServiceOffer) => {
      setOffers((arr) =>
        arr.map((x) =>
          x.id === u.id
            ? {
                ...x,
                title: u.title,
                discountPrice: String(u.discountPrice),
                durationMinutes: u.durationMinutes,
                taxRate: String(u.taxRate),
                active: u.active,
                publishedToMarketplace: u.publishedToMarketplace,
                photos: u.photos ?? [],
              }
            : x,
        ),
      );
      closeEdit();
    },
    [closeEdit],
  );
```

- [ ] **Step 3 : Rendre la ligne de tableau cliquable**

Dans le `<tr>` du tableau desktop (ligne 278 d'origine), ajoute `onClick` et le style de
curseur. Le `<tr>` devient :

```tsx
              <tr
                key={o.id}
                onClick={() => openEdit(o.id)}
                className="border-t border-pos-border hover:bg-pos-surface/60 cursor-pointer"
              >
```

Les cellules TVA et Actif contiennent des contrôles interactifs : il faut empêcher leur
clic de remonter jusqu'à la ligne, sinon basculer une case ouvre aussi le drawer.
Remplace la cellule TVA (`<td>` du bouton, lignes 287-303 d'origine) par :

```tsx
                <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => toggleTax(o)}
                    disabled={toggling === o.id}
                    title="Cliquer pour activer/désactiver la TVA"
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      Number(o.taxRate) > 0
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-pos-bg text-pos-ink-3 hover:bg-pos-border/40"
                    }`}
                  >
                    {Number(o.taxRate) > 0
                      ? `${Number(o.taxRate).toFixed(2)}%`
                      : "Sans TVA"}
                  </button>
                </td>
```

et la cellule Actif (lignes 304-312 d'origine) par :

```tsx
                <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={o.active}
                    onChange={() => toggleActive(o)}
                    disabled={toggling === o.id}
                    aria-label={`Actif — ${o.title}`}
                  />
                </td>
```

et la cellule Statut (lignes 313-315 d'origine) par :

```tsx
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <StatusBadge offer={o} />
                </td>
```

- [ ] **Step 4 : Rendre la carte mobile cliquable**

Dans la liste mobile, la `<div>` de carte (ligne 324 d'origine) devient :

```tsx
          <div
            key={o.id}
            onClick={() => openEdit(o.id)}
            className="rounded-lg border border-pos-border bg-pos-surface p-3 cursor-pointer"
          >
```

Puis protège les deux contrôles qu'elle contient. Le `<label>` Actif (lignes 335-344
d'origine) devient :

```tsx
              <label
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 flex items-center gap-1 text-xs text-pos-ink-2"
              >
                <input
                  type="checkbox"
                  checked={o.active}
                  onChange={() => toggleActive(o)}
                  disabled={toggling === o.id}
                  aria-label={`Actif — ${o.title}`}
                />
                Actif
              </label>
```

et la barre TVA + badge (lignes 346-362 d'origine) devient :

```tsx
            <div
              className="flex items-center gap-2 flex-wrap"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => toggleTax(o)}
                disabled={toggling === o.id}
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  Number(o.taxRate) > 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-pos-bg text-pos-ink-3 border border-pos-border"
                }`}
              >
                {Number(o.taxRate) > 0
                  ? `TVA ${Number(o.taxRate).toFixed(2)}%`
                  : "Sans TVA"}
              </button>
              <StatusBadge offer={o} compact />
            </div>
```

- [ ] **Step 5 : Monter le drawer**

Le `return` du composant se termine par le bloc mobile `<div className="md:hidden …">`,
puis `</div>` (le conteneur racine `h-full bg-pos-bg`), puis `);`. Insère le drawer
**entre** la fermeture du bloc mobile et celle du conteneur racine — soit juste après le
`)}` qui clôt `{offers.length === 0 && (…)}` et son `</div>` :

```tsx
      {editId && (
        <ServiceEditDrawer
          offerId={editId}
          onClose={closeEdit}
          onSaved={applySaved}
        />
      )}
```

- [ ] **Step 6 : Mettre à jour le commentaire périmé de `StatusBadge`**

Le commentaire lignes 19-26 annonce que `?edit=` est ignoré. Remplace la dernière phrase
du bloc (`Le clic mènera au drawer d'edition au lot B ; au lot A le parametre ?edit= est
simplement ignore.`) par :

```
 * Le clic ouvre le drawer d'edition via ?edit=<id>.
```

- [ ] **Step 7 : Typecheck et lint**

```bash
npx tsc --noEmit && npm run lint
```

Attendu : aucune erreur. Si ESLint signale `useSearchParams` hors `<Suspense>`, c'est
normal — la Task 6 le corrige. Un échec de **build** sur ce point est attendu à ce stade.

- [ ] **Step 8 : Commit**

```bash
git add src/components/pos/services-list-client.tsx
git commit -m "feat(pos): ouvrir le drawer d'edition depuis la liste des services"
```

---

## Task 6 : Envelopper la page dans `<Suspense>`

**Pourquoi.** Next.js 16 exige qu'un composant appelant `useSearchParams()` soit sous une
frontière `<Suspense>`, sinon le build échoue au prérendu (règle 3 de `CLAUDE.md`).
`ServicesListClient` vient d'en gagner un à la Task 5.

**Précédent exact dans le dépôt** : `src/app/(pos)/pos/analytics/page.tsx` fait déjà
cela — même layout POS, même garde `getCurrentEmployee`, `<Suspense>` autour d'un
composant client qui lit `useSearchParams` (voir `analytics-client.tsx`). Lis-le avant
d'écrire. La seule différence ci-dessous est le `fallback`, non nul, parce que la liste
des services est le contenu principal de la page et qu'un écran vide donnerait
l'impression d'un bug sur une tablette lente.

**Files:**
- Modify: `src/app/(pos)/pos/services/page.tsx`

- [ ] **Step 1 : Ajouter l'import et la frontière**

Remplace le contenu de `src/app/(pos)/pos/services/page.tsx` par :

```tsx
import { Suspense } from "react";
import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ServicesListClient } from "@/components/pos/services-list-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Services — Salonista" };

export default async function ServicesPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["products.manage"]) redirect("/pos");

  const offers = await prisma.offer.findMany({
    where: { providerId: employee.providerId },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      discountPrice: true,
      durationMinutes: true,
      taxRate: true,
      active: true,
      publishedToMarketplace: true,
      photos: true,
    } as never,
  });

  // ServicesListClient lit ?edit= via useSearchParams : Next 16 exige une
  // frontiere Suspense, sinon le prerendu echoue au build.
  return (
    <Suspense
      fallback={
        <div className="h-full bg-pos-bg p-6 text-sm text-pos-ink-3" data-pos-theme>
          Chargement des services…
        </div>
      }
    >
      <ServicesListClient initialOffers={offers as never} />
    </Suspense>
  );
}
```

- [ ] **Step 2 : Vérifier que le build passe**

```bash
npm run build
```

Attendu : build réussi. C'est l'étape qui prouve que la frontière `<Suspense>` est
correctement posée — `tsc` seul ne détecte pas ce problème.

Si le build échoue sur `caniuse-lite` ou `jose` (déjà vu sur ce dépôt), fais
`rm -rf node_modules && npm install` puis relance : c'est une corruption de
`node_modules`, pas une régression de ton code (règle 7 de `CLAUDE.md`).

- [ ] **Step 3 : Lancer la suite de tests**

```bash
npm test
```

Attendu : 108 tests passent.

- [ ] **Step 4 : Commit**

```bash
git add "src/app/(pos)/pos/services/page.tsx"
git commit -m "fix(pos): frontiere Suspense autour de la liste des services"
```

---

## Task 7 : Vérification manuelle sur base réelle

Aucun test automatisé ne couvre le drawer (pas de jsdom dans ce dépôt). Cette checklist
est la vérification réelle — **ne la saute pas**.

**Files:** aucun

- [ ] **Step 1 : Démarrer le serveur de dev**

```bash
npm run dev
```

Attendu : `Ready on http://localhost:3000`.

Il te faut un salon avec des services, dont au moins un publié sans photo (issu de
l'ajout rapide). Si la base locale est vide, crée un salon via l'inscription
prestataire, puis ajoute deux services depuis `/pos/services` — l'ajout rapide les publie
par défaut sans photo, ce qui est exactement le cas à tester.

- [ ] **Step 2 : Dérouler la checklist**

Coche chaque ligne au fur et à mesure. Toute ligne qui échoue = la tâche n'est pas finie.

- [ ] Ouvrir un service publié sans photo → le drawer s'ouvre, section **Vitrine
      dépliée d'office**, badge **Incomplet**.
- [ ] Modifier le prix, Enregistrer → 200, le drawer se ferme, **la ligne de la liste
      affiche le nouveau prix sans rechargement de page**.
- [ ] Rouvrir ce service, ajouter une photo, **laisser le prix barré vide**, cocher
      *Publier* → Enregistrer renvoie 200. (C'est le changement de la Task 1 : avant, un
      400 réclamait le prix barré.)
- [ ] Ouvrir `/offres` dans un autre onglet → le service y apparaît.
- [ ] Rouvrir le service, décocher *Publier*, Enregistrer → il disparaît de `/offres`,
      badge **Hors ligne** dans la liste.
- [ ] Sur un service sans photo, la case *Publier* est **grisée** et affiche « Ajoutez
      une photo pour publier ».
- [ ] Saisir un prix barré **inférieur** au prix de vente sur un service hors ligne, puis
      cocher *Publier* → 400 avec le message « prix barré ≥ prix actuel ».
- [ ] Pendant qu'un upload de photo est en cours, le bouton affiche **« Upload en
      cours… »** et reste **désactivé**.
- [ ] Se déconnecter, se reconnecter **par PIN en MANAGER**, ouvrir un service **hors
      ligne** → le drawer charge sans 404. (C'est le changement de la Task 3.)
- [ ] Coller `http://localhost:3000/pos/services?edit=<id>` dans un onglet neuf → le
      drawer s'ouvre déjà chargé.
- [ ] Cliquer sur la case *Actif* d'une ligne du tableau → elle bascule **sans** ouvrir
      le drawer. Idem pour le bouton TVA.
- [ ] Cliquer *Désactiver ce service* → le service quitte la grille de vente
      (`/pos/vente`), et une vente passée le référençant reste consultable dans
      l'historique.
- [ ] `Échap` ferme le drawer ; le clic sur le fond sombre aussi.
- [ ] En largeur mobile (DevTools, iPhone SE 375px) : le drawer occupe **tout l'écran**,
      le rail vertical de gauche reste accessible après fermeture.

- [ ] **Step 3 : Commit final si des correctifs ont été nécessaires**

```bash
git add -A
git commit -m "fix(pos): correctifs issus de la verification manuelle du drawer"
```

Si rien n'a bougé, ne commite rien.

---

## Task 8 : Ouvrir la pull request

**Files:** aucun

- [ ] **Step 1 : Vérification finale complète**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

Attendu : 108 tests, aucune erreur de type, aucune erreur de lint, build réussi.

- [ ] **Step 2 : Pousser et ouvrir la PR**

```bash
git push -u origin pos-services-drawer
gh pr create --base main --title "Lot B — drawer d'edition des services dans la caisse" --body "Rend les neuf champs d'un service modifiables depuis la PWA de caisse.

## Changements

- Nouveau \`<ServiceEditDrawer>\` : deux sections (essentiel toujours visible, vitrine repliable), ouvert par \`?edit=<id>\`.
- La regle de publication passe en fonction pure testee (\`src/lib/offer-publish.ts\`, 9 tests) — **le prix barre devient facultatif**, la photo reste obligatoire.
- \`GET /api/offers/[id]\` accepte desormais la session employe PIN : sans ca, une caissiere prenait un 404 sur les offres hors ligne, soit precisement celles que le drawer sert a corriger.
- \`<Suspense>\` autour de la liste (requis par Next 16 des lors qu'on lit \`useSearchParams\`).

## Non inclus, volontairement

- **Pas de suppression de service.** \`BookingItem.offer\` porte \`onDelete: Cascade\` : supprimer une offre detruirait l'historique de reservation et les commissions associees. Le drawer propose **Desactiver**. \`DELETE /api/offers/[id]\` reste donc en auth PROVIDER seule — route morte pour la caisse.
- Le profil du salon et les horaires d'ouverture → lot C.

## Verification

\`npm test\` (108), \`tsc --noEmit\`, \`npm run lint\`, \`npm run build\`, plus la checklist manuelle de la Task 7 du plan."
```

Attendu : l'URL de la PR s'affiche.

**Ne merge pas toi-même** — le déploiement se déclenche automatiquement sur push vers
`main` (GitHub Actions SSH vers Lightsail). Le merge est la décision du propriétaire.

---

## Notes de conception

**Pourquoi extraire `missingForPublish` plutôt que juste modifier la condition inline ?**
Parce que c'est la seule partie de ce lot qui soit testable dans ce dépôt. Vitest tourne
en `environment: "node"` sans jsdom : les composants React ne sont pas testables ici, mais
une règle métier pure l'est. `src/lib/verify-authz.ts` a déjà établi ce découpage pour
l'autorisation, avec le même commentaire sur l'import Prisma différé. On suit le
précédent.

**Pourquoi pas de suppression ?** `BookingItem.offer` porte `onDelete: Cascade` :
supprimer un service détruit l'historique de réservation qui le référence, et par cascade
les `Commission` associées. `SaleItem.offer` porte `onDelete: SetNull`, donc les ventes
survivraient — mais l'asymétrie suffit à écarter la suppression depuis une caisse tenue
par une employée.

**Dette assumée, consciemment.** `<ImageUpload>` est stylé aux tokens marketplace
(`brand-gold`, `brand-bordeaux`) et non aux tokens POS : la zone de dépôt détonnera
légèrement dans le drawer. Le composant est partagé avec les pages publiques ; le
paramétrer sortirait du périmètre. À traiter si le rendu gêne à l'usage.
