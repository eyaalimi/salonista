# Portail unique prestataire — Lot A : Navigation — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire de la PWA POS le portail unique du prestataire — plus aucun renvoi vers `/prestataire`.

**Architecture :** Le rail POS passe à 14 entrées en 3 groupes, vertical sur toutes tailles d'écran. Deux pages teaser verrouillées (Collab, Store) collectent des inscriptions via un nouveau modèle `FeatureInterest`. Sept routes `/prestataire/*` deviennent des redirections 307. Les services créés en caisse partent sur le feed public par défaut, leur visibilité étant conditionnée à la présence d'une photo.

**Tech Stack :** Next.js 16.2 (App Router), React 19, Tailwind v4, Prisma 7 + PostgreSQL, NextAuth v4, lucide-react.

**Spec source :** [docs/superpowers/specs/2026-08-12-pos-portail-unique-design.md](../specs/2026-08-12-pos-portail-unique-design.md)

---

## Contraintes projet — à lire avant de commencer

1. **`npx prisma generate` est cassé en local** (paquet `effect` corrompu — règle 7 de CLAUDE.md). Le client généré dans `src/generated/prisma/` est **commité** et ne connaît pas les nouveaux modèles. Pour tout accès à `FeatureInterest`, utiliser le cast documenté ci-dessous. Le déploiement régénère correctement.

2. **Aucun framework de test dans le dépôt.** Pas de `vitest`, `jest` ni `playwright` — `npm test` n'existe pas. La vérification se fait par `npx tsc --noEmit` plus une checklist manuelle. Chaque tâche porte sa propre étape de vérification ; ne pas inventer de commande de test.

3. **`npx eslint` est cassé en local** (`es-abstract/2024/AddEntriesFromIterable` introuvable). Ne pas l'utiliser comme porte de qualité.

4. **`npx tsc --noEmit` remonte ~80 erreurs préexistantes** liées au client Prisma corrompu (`Property 'sale' does not exist`, `Property 'cashDrawerSession' does not exist`…). C'est attendu. La règle : **aucune erreur nouvelle sur les fichiers touchés par la tâche**. Toujours filtrer la sortie avec `grep` sur les fichiers concernés.

5. **L'interface est en français.** Libellés, messages d'erreur, commentaires de code destinés aux futurs mainteneurs : tout en français. Les messages de commit aussi, sans accents (convention du dépôt).

### Le cast Prisma pour les nouveaux modèles

`prisma.featureInterest` n'existe pas dans le client local. Le motif utilisé partout dans ce dépôt (voir [src/app/api/pos/customers/[id]/route.ts:95](../../../src/app/api/pos/customers/[id]/route.ts)) :

```ts
const rows = (await (prisma as never as {
  featureInterest: { findMany: (args: unknown) => Promise<Array<{ feature: string }>> };
}).featureInterest.findMany({
  where: { providerId },
  select: { feature: true },
})) as Array<{ feature: string }>;
```

Ne **pas** utiliser `@ts-expect-error` : le jour où le client est régénéré, la directive devient une erreur « unused ».

---

## Structure des fichiers

### Fichiers créés

| Fichier | Responsabilité |
|---|---|
| `prisma/migrations/20260812090000_feature_interest/migration.sql` | DDL de la table `FeatureInterest` |
| `src/components/pos/locked-feature-page.tsx` | Gabarit partagé des pages teaser (présentation + bouton d'inscription) |
| `src/app/(pos)/pos/collab/page.tsx` | Teaser Collaborations |
| `src/app/(pos)/pos/store/page.tsx` | Teaser Boutique |
| `src/app/(pos)/pos/settings/page.tsx` | Profil salon en lecture seule (version complète au lot C) |
| `src/app/api/pos/interest/route.ts` | `GET` + `POST` de la liste d'attente |
| `src/app/(dashboard)/prestataire/**/page.tsx` (×7) | Redirections 307 |

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `prisma/schema.prisma` | Modèle `FeatureInterest` + relation inverse sur `ProviderProfile` |
| `src/components/pos/rail.tsx` | 14 entrées, 3 groupes, largeur adaptative, champ `locked` |
| `src/app/(pos)/layout.tsx` | Retour au rail latéral (retrait de `flex-col-reverse`) |
| `src/components/pos/pos-shell-client.tsx` | Repositionnement de la barre panier |
| `src/components/pos/services-list-client.tsx` | Badge à 3 états, liens internes |
| `src/app/api/offers/route.ts` | Auth employé, publication par défaut, validation assouplie, filtre photos |
| `src/app/api/offers/[id]/route.ts` | Auth employé |
| `src/app/page.tsx` | Filtre photos |
| `src/app/offres/page.tsx` | Filtre photos |
| `src/app/salon/[id]/page.tsx` | Filtre `publishedToMarketplace` + photos |

### Ordre des tâches

Les tâches 1 à 3 (données, API) précèdent l'interface : le badge de la tâche 8 dépend du comportement de publication de la tâche 3. Les tâches 4 à 6 (rail) sont indépendantes des tâches 7 à 9 et peuvent être menées dans l'un ou l'autre ordre.

---

## Tâche 0 : Créer la branche

- [ ] **Étape 1 : Vérifier que l'arbre de travail est propre**

```bash
git status --short
```

Attendu : aucune sortie. Si des fichiers sont modifiés, les commiter ou les remiser avant de continuer.

- [ ] **Étape 2 : Créer la branche depuis main à jour**

```bash
git checkout main
git pull
git checkout -b pos-portail-unique
```

Attendu : `Switched to a new branch 'pos-portail-unique'`

---

## Tâche 1 : Modèle FeatureInterest

**Fichiers :**
- Modifier : `prisma/schema.prisma`
- Créer : `prisma/migrations/20260812090000_feature_interest/migration.sql`

- [ ] **Étape 1 : Ajouter le modèle au schéma**

Ajouter à la fin de `prisma/schema.prisma` :

```prisma
/// Liste d'attente pour les fonctionnalites verrouillees (Collab, Store).
/// `feature` est une String et non un enum : ces valeurs bougent au gre des
/// idees produit, et une migration pour ajouter une option de teasing serait
/// disproportionnee.
model FeatureInterest {
  id         String   @id @default(cuid())
  providerId String
  feature    String
  createdAt  DateTime @default(now())

  provider ProviderProfile @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@unique([providerId, feature])
  @@index([feature])
}
```

- [ ] **Étape 2 : Ajouter la relation inverse sur ProviderProfile**

Dans `prisma/schema.prisma`, repérer le modèle `ProviderProfile` et la ligne `employees SalonEmployee[]`. Ajouter juste en dessous :

```prisma
  featureInterests      FeatureInterest[]
```

- [ ] **Étape 3 : Écrire la migration SQL**

Créer `prisma/migrations/20260812090000_feature_interest/migration.sql` :

```sql
-- CreateTable
CREATE TABLE "FeatureInterest" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureInterest_providerId_feature_key" ON "FeatureInterest"("providerId", "feature");

-- CreateIndex
CREATE INDEX "FeatureInterest_feature_idx" ON "FeatureInterest"("feature");

-- AddForeignKey
ALTER TABLE "FeatureInterest" ADD CONSTRAINT "FeatureInterest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Étape 4 : Vérifier la cohérence schéma / SQL à la main**

`npx prisma validate` échoue en local (règle 7). Relire les deux fichiers et confirmer point par point :

- les 4 colonnes du modèle existent dans le `CREATE TABLE` avec les mêmes noms
- `@@unique([providerId, feature])` correspond au `CREATE UNIQUE INDEX` sur les deux mêmes colonnes dans le même ordre
- `@@index([feature])` correspond au `CREATE INDEX`
- `onDelete: Cascade` correspond à `ON DELETE CASCADE`
- le nom du dossier de migration est bien postérieur à la dernière migration existante (`ls prisma/migrations | sort | tail -3`)

- [ ] **Étape 5 : Commiter**

```bash
git add prisma/schema.prisma prisma/migrations/20260812090000_feature_interest
git commit -m "feat(db): modele FeatureInterest pour la liste d'attente Collab et Store"
```

---

## Tâche 2 : API liste d'attente

**Fichiers :**
- Créer : `src/app/api/pos/interest/route.ts`

- [ ] **Étape 1 : Écrire la route**

Créer `src/app/api/pos/interest/route.ts` :

```ts
/**
 * Liste d'attente des fonctionnalites verrouillees (Collab, Store).
 *
 * GET  -> { features: string[] } : ce que ce salon a deja demande, pour que
 *         le bouton s'affiche dans son etat "deja inscrit" apres rechargement.
 * POST -> { ok: true } : enregistre l'interet. Idempotent grace a la
 *         contrainte unique (providerId, feature) : un double clic ne cree
 *         pas de doublon et renvoie 200 dans les deux cas.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, toResponse } from "@/lib/employee-session";

const FEATURES = ["COLLAB", "STORE"] as const;
type Feature = (typeof FEATURES)[number];

function isFeature(v: unknown): v is Feature {
  return typeof v === "string" && (FEATURES as readonly string[]).includes(v);
}

export async function GET() {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  // Cast : le client Prisma local ne connait pas encore FeatureInterest.
  const rows = (await (prisma as never as {
    featureInterest: { findMany: (args: unknown) => Promise<Array<{ feature: string }>> };
  }).featureInterest.findMany({
    where: { providerId: employee.providerId },
    select: { feature: true },
  })) as Array<{ feature: string }>;

  return Response.json({ features: rows.map((r) => r.feature) });
}

export async function POST(req: NextRequest) {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const body = (await req.json().catch(() => null)) as { feature?: unknown } | null;
  if (!body || !isFeature(body.feature)) {
    return Response.json(
      { error: "Fonctionnalité inconnue" },
      { status: 400 },
    );
  }

  await (prisma as never as {
    featureInterest: { upsert: (args: unknown) => Promise<unknown> };
  }).featureInterest.upsert({
    where: {
      providerId_feature: { providerId: employee.providerId, feature: body.feature },
    },
    create: { providerId: employee.providerId, feature: body.feature },
    update: {},
  });

  return Response.json({ ok: true });
}
```

- [ ] **Étape 2 : Vérifier le typage**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "pos/interest"
```

Attendu : aucune sortie. Si une erreur apparaît, c'est que le cast est mal formé — comparer avec le motif de `src/app/api/pos/customers/[id]/route.ts:95`.

- [ ] **Étape 3 : Commiter**

```bash
git add src/app/api/pos/interest/route.ts
git commit -m "feat(pos): API liste d'attente pour les fonctionnalites verrouillees"
```

---

## Tâche 3 : Auth employé et publication par défaut sur les routes offers

Cette tâche corrige un bug préexistant (401 pour les employés PIN) et bascule la publication par défaut. Les deux changements touchent les mêmes lignes, d'où leur regroupement.

**Fichiers :**
- Modifier : `src/app/api/offers/route.ts`
- Modifier : `src/app/api/offers/[id]/route.ts`

- [ ] **Étape 1 : Remplacer l'authentification du POST**

Dans `src/app/api/offers/route.ts`, remplacer le bloc d'authentification du `POST` (lignes 50-63) :

```ts
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let profile = await prisma.providerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) {
    profile = await prisma.providerProfile.create({
      data: { userId: session.user.id, salonName: session.user.name || "Mon Salon", category: "AUTRE" },
    });
  }
```

par :

```ts
export async function POST(req: NextRequest) {
  // Accepte les deux modes d'auth : session PROVIDER email/mot de passe ET
  // session employe par PIN. Sans cela un MANAGER connecte par PIN recevait
  // un 401 depuis /pos/services alors que la page lui accorde l'acces via
  // la permission products.manage.
  let employee;
  try {
    employee = await requirePermission("products.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const profile = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
  });
  if (!profile) {
    return NextResponse.json({ error: "Salon introuvable" }, { status: 404 });
  }
```

- [ ] **Étape 2 : Ajouter l'import correspondant**

En haut de `src/app/api/offers/route.ts`, ajouter après l'import de `prisma` :

```ts
import { requirePermission, toResponse } from "@/lib/employee-session";
```

`getServerSession` et `authOptions` restent utilisés par le `GET` — ne pas retirer ces imports.

- [ ] **Étape 3 : Basculer la publication par défaut**

Toujours dans `src/app/api/offers/route.ts`, remplacer la ligne 75 :

```ts
    publishedToMarketplace = false,
```

par :

```ts
    publishedToMarketplace = true,
```

- [ ] **Étape 4 : Assouplir la validation de publication**

Remplacer le bloc lignes 98-112 :

```ts
  const finalCategory = publishedToMarketplace
    ? category
    : (category ?? "AUTRE");

  if (publishedToMarketplace) {
    if (!category) missing.push("catégorie");
    if (
      originalPrice === undefined ||
      originalPrice === null ||
      Number(originalPrice) < Number(discountPrice)
    ) {
      missing.push("prix barré (≥ prix actuel)");
    }
    if (!photos || photos.length === 0) missing.push("au moins une photo");
  }
```

par :

```ts
  // Publier est desormais l'intention par defaut : la completude conditionne
  // la VISIBILITE dans le feed, pas la creation. Un service cree par l'ajout
  // rapide (nom + prix + duree + TVA) est donc publie mais masque du feed
  // tant qu'il n'a pas de photo — l'interface affiche un badge "Ajouter une
  // photo" pour le signaler. Le garde-fou de publication sera reimplemente
  // cote UI dans le drawer d'edition au lot B.
  const finalCategory = category ?? "AUTRE";
```

- [ ] **Étape 5 : Corriger les deux usages en aval de la variable supprimée**

Toujours dans le même fichier, ligne 131, remplacer :

```ts
      originalPrice: publishedToMarketplace ? originalPrice : (originalPrice ?? null),
```

par :

```ts
      originalPrice: originalPrice ?? null,
```

Puis lignes 141-144, remplacer :

```ts
  // Auto-generate slots based on opening hours and duration
  if (publishedToMarketplace) {
    await regenerateOfferSlots(offer.id);
  }
```

par :

```ts
  // Les creneaux sont generes pour tout service : ils servent aussi bien aux
  // reservations en ligne qu'au calendrier interne du POS.
  await regenerateOfferSlots(offer.id);
```

- [ ] **Étape 6 : Remplacer l'authentification du PUT**

Dans `src/app/api/offers/[id]/route.ts`, remplacer le bloc d'authentification du `PUT` :

```ts
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const profile = await prisma.providerProfile.findUnique({
    where: { userId: session.user.id },
  });

  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer || offer.providerId !== profile?.id) {
    return NextResponse.json({ error: "Offre introuvable" }, { status: 404 });
  }
```

par :

```ts
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Accepte session PROVIDER et session employe par PIN (cf. POST /api/offers).
  let employee;
  try {
    employee = await requirePermission("products.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer || offer.providerId !== employee.providerId) {
    return NextResponse.json({ error: "Offre introuvable" }, { status: 404 });
  }
```

- [ ] **Étape 7 : Ajouter l'import dans le fichier [id]**

En haut de `src/app/api/offers/[id]/route.ts`, ajouter après l'import de `prisma` :

```ts
import { requirePermission, toResponse } from "@/lib/employee-session";
```

Le `GET` de ce fichier utilise toujours `getServerSession` et `authOptions` pour contrôler l'accès aux offres non publiées — ne pas retirer ces imports.

- [ ] **Étape 8 : Vérifier le typage**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "api/offers"
```

Attendu : aucune sortie. Une erreur `Cannot find name 'publishedToMarketplace'` signifie qu'un usage de la variable supprimée à l'étape 4 a été oublié — relire les étapes 5.

- [ ] **Étape 9 : Commiter**

```bash
git add src/app/api/offers/route.ts "src/app/api/offers/[id]/route.ts"
git commit -m "fix(offers): auth employe PIN + publication marketplace par defaut

- POST et PUT acceptaient uniquement une session PROVIDER email/mot de passe,
  ce qui renvoyait un 401 aux employes PIN sur /pos/services alors que la page
  leur accorde l'acces via products.manage. Bascule sur requirePermission.
- publishedToMarketplace passe a true par defaut : le prestataire n'ayant plus
  que le portail POS, un service cree en caisse doit partir sur le feed.
- La validation stricte (categorie + prix barre + photo) est levee : la
  completude conditionne desormais la visibilite dans le feed, pas la creation."
```

---

## Tâche 4 : Filtre de visibilité du feed public

Le badge « Ajouter une photo » de la tâche 8 n'est honnête que si le feed masque réellement les offres sans photo. Sans cette tâche, tous les services de caisse apparaîtraient publiquement.

**Fichiers :**
- Modifier : `src/app/api/offers/route.ts:36`
- Modifier : `src/app/page.tsx:30`
- Modifier : `src/app/offres/page.tsx:37`
- Modifier : `src/app/salon/[id]/page.tsx:17`

- [ ] **Étape 1 : Filtrer l'API publique des offres**

Dans `src/app/api/offers/route.ts`, remplacer la ligne 36 :

```ts
  const where: Record<string, unknown> = { active: true, publishedToMarketplace: true };
```

par :

```ts
  // photos.isEmpty : une offre publiee mais sans photo reste masquee du feed.
  // C'est ce qui rend honnete le badge "Ajouter une photo" cote POS.
  const where: Record<string, unknown> = {
    active: true,
    publishedToMarketplace: true,
    photos: { isEmpty: false },
  };
```

- [ ] **Étape 2 : Filtrer la page d'accueil**

Dans `src/app/page.tsx`, remplacer la ligne 30 :

```ts
      where: { active: true, publishedToMarketplace: true } as never,
```

par :

```ts
      where: { active: true, publishedToMarketplace: true, photos: { isEmpty: false } } as never,
```

- [ ] **Étape 3 : Filtrer la liste des offres**

Dans `src/app/offres/page.tsx`, après la ligne 37 (`publishedToMarketplace: true,`), ajouter :

```ts
      photos: { isEmpty: false },
```

- [ ] **Étape 4 : Corriger la page salon**

Dans `src/app/salon/[id]/page.tsx`, remplacer la ligne 17 :

```ts
        where: { active: true },
```

par :

```ts
        // Bug preexistant : cette page ne filtrait pas sur
        // publishedToMarketplace, laissant fuir les services POS-only sur la
        // page publique du salon. Avec la publication par defaut, tous les
        // services de caisse s'y afficheraient.
        where: { active: true, publishedToMarketplace: true, photos: { isEmpty: false } },
```

- [ ] **Étape 5 : Vérifier le typage**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "app/page|offres/page|salon/|api/offers"
```

Attendu : aucune sortie. `photos: { isEmpty: false }` est déjà employé à [src/app/page.tsx:42](../../../src/app/page.tsx) sur ce même champ `String[]`, le motif est donc validé dans ce dépôt.

- [ ] **Étape 6 : Commiter**

```bash
git add src/app/api/offers/route.ts src/app/page.tsx src/app/offres/page.tsx "src/app/salon/[id]/page.tsx"
git commit -m "fix(marketplace): masquer du feed les offres sans photo

Complement de la publication par defaut : une offre publiee mais incomplete
reste invisible cote client. Corrige au passage un bug preexistant sur
/salon/[id] qui ne filtrait pas du tout sur publishedToMarketplace et laissait
fuir les services POS-only."
```

---

## Tâche 5 : Rail — structure à 14 entrées en 3 groupes

**Fichiers :**
- Modifier : `src/components/pos/rail.tsx`

- [ ] **Étape 1 : Remplacer intégralement le fichier**

Remplacer tout le contenu de `src/components/pos/rail.tsx` par :

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Calendar,
  Scissors,
  Users,
  Package,
  Receipt,
  Wallet,
  BarChart3,
  UserCog,
  Star,
  Coins,
  Settings,
  Handshake,
  ShoppingBag,
  Lock,
} from "lucide-react";

type Permission = string;

type RailItem = {
  href: string;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
  perm?: Permission;
  /**
   * Fonctionnalite pas encore livree : l'entree s'affiche grisee avec un
   * cadenas et mene a une page teaser. Elle ignore volontairement le filtre
   * de permission — l'offre commerciale doit etre visible par tous, pas
   * seulement par le proprietaire.
   */
  locked?: boolean;
};

export function Rail({ permissions }: { permissions: Record<Permission, boolean> }) {
  const pathname = usePathname();

  // Groupe 1 — CAISSE : le quotidien de la caissiere.
  const groupCaisse: RailItem[] = [
    { href: "/pos", label: "Caisse", shortcut: "1", icon: <LayoutGrid size={20} />, perm: "pos.sell" },
    { href: "/pos/calendar", label: "RDV", shortcut: "B", icon: <Calendar size={20} />, perm: "bookings.view" },
    { href: "/pos/customers", label: "Clients", shortcut: "C", icon: <Users size={20} />, perm: "customers.view" },
  ];

  // Groupe 2 — CATALOGUE : ce que le salon vend.
  const groupCatalogue: RailItem[] = [
    { href: "/pos/services", label: "Services", shortcut: "S", icon: <Scissors size={20} />, perm: "products.manage" },
    { href: "/pos/products", label: "Produits", shortcut: "P", icon: <Package size={20} />, perm: "inventory.view" },
  ];

  // Groupe 3 — GESTION : ce que le proprietaire consulte.
  const groupGestion: RailItem[] = [
    { href: "/pos/sales", label: "Ventes", shortcut: "V", icon: <Receipt size={20} />, perm: "pos.sell" },
    { href: "/pos/cash-drawer", label: "Tiroir", shortcut: "F", icon: <Wallet size={20} />, perm: "pos.cash_drawer" },
    { href: "/pos/loyalty", label: "Fidélité", shortcut: "L", icon: <Star size={20} />, perm: "rewards.adjust" },
    { href: "/pos/commissions", label: "Commissions", shortcut: "M", icon: <Coins size={20} />, perm: "employees.manage" },
    { href: "/pos/employees", label: "Équipe", shortcut: "E", icon: <UserCog size={20} />, perm: "employees.manage" },
    { href: "/pos/analytics", label: "Stats", shortcut: "A", icon: <BarChart3 size={20} />, perm: "analytics.view" },
    { href: "/pos/settings", label: "Profil", shortcut: "R", icon: <Settings size={20} />, perm: "settings.manage" },
  ];

  // Groupe 4 — VERROUILLE : teasing commercial.
  const groupLocked: RailItem[] = [
    { href: "/pos/collab", label: "Collab", shortcut: "", icon: <Handshake size={20} />, locked: true },
    { href: "/pos/store", label: "Store", shortcut: "", icon: <ShoppingBag size={20} />, locked: true },
  ];

  function renderItem(it: RailItem) {
    if (it.perm && !it.locked && !permissions[it.perm]) return null;
    const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href + "/"));

    return (
      <Link
        key={it.href}
        href={it.href}
        title={it.locked ? `${it.label} — bientôt disponible` : `${it.label}${it.shortcut ? ` (${it.shortcut})` : ""}`}
        aria-label={it.label}
        className={`group relative shrink-0 w-full flex flex-col items-center justify-center gap-1 rounded-lg transition-colors md:px-1 md:py-2 px-0 py-2.5 ${
          active
            ? "bg-pos-accent text-white"
            : it.locked
              ? "text-pos-ink-3 opacity-60 hover:opacity-100 hover:bg-pos-border/40"
              : "text-pos-ink-2 hover:bg-pos-border/60 hover:text-pos-ink"
        }`}
      >
        <span className="relative flex items-center justify-center">
          {it.icon}
          {it.locked && (
            <span className="absolute -bottom-1 -right-1.5 rounded-full bg-pos-rail p-[1px]">
              <Lock size={11} className="text-pos-ink-3" />
            </span>
          )}
        </span>
        {/* Sur mobile le libelle est masque visuellement mais reste lisible
            par les lecteurs d'ecran ; le title couvre l'appui long. */}
        <span
          className={`text-[11px] leading-none font-medium text-center md:not-sr-only sr-only ${
            active ? "text-white" : it.locked ? "text-pos-ink-3" : "text-pos-ink-2 group-hover:text-pos-ink"
          }`}
        >
          {it.label}
        </span>
      </Link>
    );
  }

  const separator = (key: string) => (
    <div key={key} className="my-2 h-px w-8 shrink-0 bg-pos-border-strong" />
  );

  return (
    <aside
      className="flex h-full shrink-0 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden border-r border-pos-border bg-pos-rail md:w-[80px] w-[56px] md:px-2 px-1 py-3"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      aria-label="Navigation principale"
    >
      {groupCaisse.map(renderItem)}
      {separator("sep-1")}
      {groupCatalogue.map(renderItem)}
      {separator("sep-2")}
      {groupGestion.map(renderItem)}
      {separator("sep-3")}
      {groupLocked.map(renderItem)}
    </aside>
  );
}
```

- [ ] **Étape 2 : Vérifier le typage**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "pos/rail"
```

Attendu : aucune sortie.

Les cinq icônes utilisées (`Handshake`, `ShoppingBag`, `Settings`, `Lock`, `Check`) ont été vérifiées présentes dans la version de `lucide-react` installée — aucune inquiétude de ce côté.

- [ ] **Étape 3 : Commiter**

```bash
git add src/components/pos/rail.tsx
git commit -m "feat(pos): rail a 14 entrees en 3 groupes avec sections verrouillees

Clients remonte dans le groupe CAISSE (usage quotidien), Profil apparait,
Collab et Store s'ajoutent grisees avec un cadenas. Le rail redevient vertical
sur toutes les tailles : 56px icones seules sur mobile, 80px avec libelles sur
desktop. Le libelle reste en sr-only sur mobile pour l'accessibilite."
```

---

## Tâche 6 : Layout — retour au rail latéral sur mobile

Le commit `9bf1594` avait transformé le rail en bottom-bar sur mobile. Le test sur iPhone a montré que ce n'est pas confortable ; on revient au rail latéral.

**Fichiers :**
- Modifier : `src/app/(pos)/layout.tsx`
- Modifier : `src/components/pos/pos-shell-client.tsx`

- [ ] **Étape 1 : Rétablir la disposition en ligne**

Dans `src/app/(pos)/layout.tsx`, remplacer :

```tsx
          {/* Mobile: rail becomes a bottom bar. Desktop: side rail 80px. */}
          <div className="flex-1 min-h-0 flex md:flex-row flex-col-reverse overflow-hidden">
```

par :

```tsx
          {/* Rail lateral a toutes les tailles : 56px sur mobile, 80px sur
              desktop. La bottom-bar mobile a ete abandonnee apres test sur
              iPhone — elle n'etait pas confortable a l'usage. */}
          <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
```

- [ ] **Étape 2 : Repositionner la barre panier**

Dans `src/components/pos/pos-shell-client.tsx`, repérer le conteneur de la barre panier mobile :

```tsx
        <div
          className="md:hidden fixed inset-x-0 z-40 px-3"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 72px)" }}
        >
```

Le remplacer par :

```tsx
        <div
          className="md:hidden fixed z-40 pr-3"
          style={{
            // Decalee de la largeur du rail (56px) pour ne pas le recouvrir.
            // Plus de bottom-bar a eviter : la barre se colle au bas de l'ecran.
            left: "56px",
            right: 0,
            bottom: "calc(env(safe-area-inset-bottom) + 12px)",
          }}
        >
```

- [ ] **Étape 3 : Vérifier le typage**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "pos-shell|\(pos\)/layout"
```

Attendu : aucune sortie.

- [ ] **Étape 4 : Vérifier visuellement**

```bash
npm run dev
```

Ouvrir `http://localhost:3000/pos`, activer l'inspecteur en mode iPhone SE (375 × 667) :

- le rail est à gauche, vertical, 56px, icônes seules
- les 14 entrées sont atteignables en faisant défiler le rail verticalement
- les 3 traits séparateurs sont visibles
- Collab et Store sont grisées avec un cadenas en bas à droite de l'icône
- en ajoutant un article au panier, la barre panier apparaît en bas **sans recouvrir le rail**

Arrêter le serveur avec Ctrl+C.

- [ ] **Étape 5 : Commiter**

```bash
git add "src/app/(pos)/layout.tsx" src/components/pos/pos-shell-client.tsx
git commit -m "fix(pos): retour au rail lateral sur mobile

La bottom-bar introduite au commit 9bf1594 n'etait pas confortable sur iPhone.
Le rail redevient lateral a toutes les tailles ; la barre panier se recale au
bas de l'ecran, decalee de 56px pour ne pas recouvrir le rail."
```

---

## Tâche 7 : Pages teaser Collab et Store

**Fichiers :**
- Créer : `src/components/pos/locked-feature-page.tsx`
- Créer : `src/app/(pos)/pos/collab/page.tsx`
- Créer : `src/app/(pos)/pos/store/page.tsx`

- [ ] **Étape 1 : Écrire le gabarit partagé**

Créer `src/components/pos/locked-feature-page.tsx` :

```tsx
"use client";

import { useEffect, useState } from "react";
import { Lock, Check } from "lucide-react";

/**
 * Gabarit des pages de fonctionnalites pas encore livrees.
 *
 * Le bouton "Etre prevenu" enregistre une ligne FeatureInterest : cela donne
 * une liste d'attente qualifiee avant meme d'avoir code la fonctionnalite,
 * ce qui sert de signal de priorisation.
 */
export function LockedFeaturePage({
  feature,
  title,
  tagline,
  bullets,
}: {
  feature: "COLLAB" | "STORE";
  title: string;
  tagline: string;
  bullets: string[];
}) {
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);

  // Recharge l'etat pour que le bouton reste sur "deja inscrit" apres un
  // rafraichissement de page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/pos/interest", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { features: string[] };
        if (!cancelled) setRegistered(data.features.includes(feature));
      } catch {
        // Silencieux : l'echec du prechargement laisse simplement le bouton
        // dans son etat par defaut, l'upsert cote serveur reste idempotent.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [feature]);

  async function register() {
    if (busy || registered) return;
    setBusy(true);
    try {
      const res = await fetch("/api/pos/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature }),
      });
      if (res.ok) setRegistered(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-pos-bg md:p-8 p-4">
      <div className="mx-auto max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-pos-border bg-pos-card px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-pos-ink-3">
          <Lock size={12} />
          Bientôt disponible
        </span>

        <h1 className="luxury-heading mt-4 text-3xl text-pos-ink">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-pos-ink-2">{tagline}</p>

        <div className="relative mt-8 overflow-hidden rounded-2xl border border-pos-border">
          <div
            aria-hidden="true"
            className="flex h-48 items-center justify-center bg-gradient-to-br from-pos-card via-pos-bg to-pos-border blur-[2px]"
          >
            <span className="text-6xl opacity-30">{feature === "COLLAB" ? "🤝" : "🛍️"}</span>
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-pos-bg to-transparent" />
        </div>

        <ul className="mt-8 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 text-sm text-pos-ink-2">
              <Check size={16} className="mt-0.5 shrink-0 text-pos-accent" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={register}
          disabled={busy || registered}
          className={`mt-8 w-full rounded-xl py-4 text-sm font-semibold transition ${
            registered
              ? "cursor-default border border-pos-border bg-pos-card text-pos-ink-2"
              : "bg-pos-ink text-pos-bg active:scale-[0.99] disabled:opacity-60"
          }`}
        >
          {registered ? "✓ Vous serez prévenu·e" : busy ? "…" : "Être prévenu·e au lancement"}
        </button>

        <p className="mt-3 text-center text-xs text-pos-ink-3">
          Nous vous contacterons dès que cette fonctionnalité sera disponible.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Étape 2 : Écrire la page Collab**

Créer `src/app/(pos)/pos/collab/page.tsx` :

```tsx
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/employee-session";
import { LockedFeaturePage } from "@/components/pos/locked-feature-page";

export const metadata = { title: "Collaborations — Salonista" };

export default async function CollabPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");

  return (
    <LockedFeaturePage
      feature="COLLAB"
      title="Collaborations influenceuses"
      tagline="Recevez des propositions de créatrices de contenu locales et ne payez qu'à la réservation effective."
      bullets={[
        "Une seule commission par conversion, jamais d'avance",
        "Suivi des clics et des réservations générées",
        "Aucun engagement mensuel",
      ]}
    />
  );
}
```

- [ ] **Étape 3 : Écrire la page Store**

Créer `src/app/(pos)/pos/store/page.tsx` :

```tsx
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/employee-session";
import { LockedFeaturePage } from "@/components/pos/locked-feature-page";

export const metadata = { title: "Boutique — Salonista" };

export default async function StorePage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");

  return (
    <LockedFeaturePage
      feature="STORE"
      title="Boutique professionnelle"
      tagline="Commandez vos produits professionnels directement depuis votre caisse, à tarif négocié."
      bullets={[
        "Tarifs négociés auprès des fournisseurs",
        "Réception en un geste : le stock se met à jour tout seul",
        "Livraison suivie partout en Tunisie",
      ]}
    />
  );
}
```

- [ ] **Étape 4 : Vérifier le typage**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "locked-feature|pos/collab|pos/store"
```

Attendu : aucune sortie.

- [ ] **Étape 5 : Vérifier le comportement**

```bash
npm run dev
```

Ouvrir `http://localhost:3000/pos/collab` :

- la page s'affiche avec le badge « Bientôt disponible »
- cliquer sur « Être prévenu·e au lancement » — le bouton passe à « ✓ Vous serez prévenu·e »
- rafraîchir la page — le bouton est **toujours** dans l'état « ✓ Vous serez prévenu·e »
- cliquer une seconde fois ne produit rien (bouton désactivé)

Vérifier en base qu'une seule ligne existe :

```bash
sudo -u postgres psql salonista_dev -c 'SELECT "providerId", feature FROM "FeatureInterest";'
```

Attendu : exactement une ligne avec `feature = COLLAB`. Si la base locale n'est pas accessible sous ce nom, adapter le nom de base ; à défaut, se contenter de la vérification par l'interface ci-dessus.

Arrêter le serveur avec Ctrl+C.

- [ ] **Étape 6 : Commiter**

```bash
git add src/components/pos/locked-feature-page.tsx "src/app/(pos)/pos/collab" "src/app/(pos)/pos/store"
git commit -m "feat(pos): pages teaser Collab et Store avec liste d'attente

Gabarit partage LockedFeaturePage : accroche, apercu floute, arguments et
bouton d'inscription. L'etat inscrit est recharge au montage pour survivre a
un rafraichissement."
```

---

## Tâche 8 : Badge de statut à trois états et liens internes

**Fichiers :**
- Modifier : `src/components/pos/services-list-client.tsx`

- [ ] **Étape 1 : Ajouter le champ photos au type Offer**

Dans `src/components/pos/services-list-client.tsx`, remplacer le type `Offer` :

```tsx
type Offer = {
  id: string;
  title: string;
  discountPrice: string;
  durationMinutes: number;
  taxRate: string;
  active: boolean;
  publishedToMarketplace: boolean;
};
```

par :

```tsx
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
```

- [ ] **Étape 2 : Ajouter le composant de badge**

Toujours dans `src/components/pos/services-list-client.tsx`, ajouter juste avant `export function ServicesListClient` :

```tsx
/**
 * Badge de statut marketplace a trois etats.
 *
 * Un service publie sans photo est cree mais masque du feed public (le filtre
 * photos.isEmpty s'en charge cote serveur) : le badge ambre signale au
 * prestataire ce qu'il lui reste a faire. Le clic mènera au drawer d'edition
 * au lot B ; au lot A le parametre ?edit= est simplement ignore.
 */
function StatusBadge({ offer, compact }: { offer: Offer; compact?: boolean }) {
  const published = offer.publishedToMarketplace;
  const hasPhoto = offer.photos.length > 0;

  if (published && hasPhoto) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-0.5 text-xs text-green-800">
        En ligne
      </span>
    );
  }

  if (published && !hasPhoto) {
    return (
      <Link
        href={`/pos/services?edit=${offer.id}`}
        className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100"
      >
        {compact ? "Photo manquante" : "Ajouter une photo"}
      </Link>
    );
  }

  return (
    <Link
      href={`/pos/services?edit=${offer.id}`}
      className="inline-flex items-center gap-1 rounded bg-pos-border px-2 py-0.5 text-xs text-pos-ink-2 hover:bg-pos-border/70"
    >
      Hors ligne
    </Link>
  );
}
```

- [ ] **Étape 3 : Utiliser le badge dans le tableau desktop**

Remplacer le contenu de la cellule de statut du tableau :

```tsx
                <td className="px-3 py-2">
                  {o.publishedToMarketplace ? (
                    <Link
                      href={`/prestataire/offres/${o.id}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-800 text-xs"
                    >
                      Publié·e en ligne
                    </Link>
                  ) : (
                    <Link
                      href={`/prestataire/offres/${o.id}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-pos-border text-pos-ink-2 text-xs"
                    >
                      POS uniquement · Publier en ligne →
                    </Link>
                  )}
                </td>
```

par :

```tsx
                <td className="px-3 py-2">
                  <StatusBadge offer={o} />
                </td>
```

- [ ] **Étape 4 : Utiliser le badge dans les cartes mobile**

Remplacer le bloc équivalent dans la liste mobile :

```tsx
              {o.publishedToMarketplace ? (
                <Link
                  href={`/prestataire/offres/${o.id}`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-800 text-xs"
                >
                  En ligne
                </Link>
              ) : (
                <Link
                  href={`/prestataire/offres/${o.id}`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-pos-border text-pos-ink-2 text-xs"
                >
                  POS uniquement →
                </Link>
              )}
```

par :

```tsx
              <StatusBadge offer={o} compact />
```

- [ ] **Étape 5 : Remonter le champ photos depuis la page serveur**

Dans `src/app/(pos)/pos/services/page.tsx`, ajouter `photos: true,` dans le `select`, après `publishedToMarketplace: true,` :

```tsx
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
```

- [ ] **Étape 6 : Renseigner photos à la création**

Toujours dans `src/components/pos/services-list-client.tsx`, dans `saveNew`, la réponse de l'API est poussée dans l'état local. L'API renvoie l'offre complète, `photos` est donc présent — mais par sécurité si le champ manquait, le badge planterait sur `offer.photos.length`. Remplacer :

```tsx
      setOffers((o) =>
        [...o, json].sort((a, b) => a.title.localeCompare(b.title, "fr"))
      );
```

par :

```tsx
      setOffers((o) =>
        [...o, { ...json, photos: json.photos ?? [] }].sort((a, b) =>
          a.title.localeCompare(b.title, "fr"),
        ),
      );
```

- [ ] **Étape 7 : Vérifier qu'aucun lien ne fuit plus**

```bash
grep -rn "/prestataire" src/components/pos/ "src/app/(pos)/"
```

Attendu : **aucune sortie**. C'est le critère de vérification n°1 du spec.

- [ ] **Étape 8 : Vérifier le typage**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "services-list|pos/services"
```

Attendu : aucune sortie.

- [ ] **Étape 9 : Commiter**

```bash
git add src/components/pos/services-list-client.tsx "src/app/(pos)/pos/services/page.tsx"
git commit -m "feat(pos): badge de statut marketplace a trois etats

En ligne (vert) / Ajouter une photo (ambre) / Hors ligne (gris). Le badge
ambre signale un service publie mais masque du feed faute de photo. Les
quatre liens qui renvoyaient vers /prestataire/offres pointent desormais
vers /pos/services?edit=."
```

---

## Tâche 9 : Page profil en lecture seule

Cible de la redirection `/prestataire/profil`. Version complète au lot C.

**Fichiers :**
- Créer : `src/app/(pos)/pos/settings/page.tsx`

- [ ] **Étape 1 : Écrire la page**

Créer `src/app/(pos)/pos/settings/page.tsx` :

```tsx
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profil du salon — Salonista" };

/**
 * Profil du salon en lecture seule.
 *
 * Cible de la redirection /prestataire/profil des le lot A pour ne livrer
 * aucune 404. L'edition (formulaire complet + horaires d'ouverture) arrive
 * au lot C.
 */
export default async function SettingsPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["settings.manage"]) redirect("/pos");

  const provider = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
    select: {
      salonName: true,
      category: true,
      description: true,
      address: true,
      city: true,
      phone: true,
      matriculeFiscal: true,
    } as never,
  }) as {
    salonName: string;
    category: string;
    description: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    matriculeFiscal: string | null;
  } | null;

  if (!provider) redirect("/pos");

  const rows: Array<{ label: string; value: string | null }> = [
    { label: "Nom du salon", value: provider.salonName },
    { label: "Catégorie", value: provider.category },
    { label: "Description", value: provider.description },
    { label: "Adresse", value: provider.address },
    { label: "Ville", value: provider.city },
    { label: "Téléphone", value: provider.phone },
    { label: "Matricule fiscal", value: provider.matriculeFiscal },
  ];

  return (
    <div className="h-full overflow-y-auto bg-pos-bg md:p-6 p-4">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-lg font-semibold text-pos-ink md:text-xl">Profil du salon</h1>
        <p className="mt-1 text-sm text-pos-ink-3">
          Ces informations apparaissent sur vos tickets et sur votre page publique.
        </p>

        <dl className="mt-6 divide-y divide-pos-border overflow-hidden rounded-lg border border-pos-border bg-pos-card">
          {rows.map((r) => (
            <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.14em] text-pos-ink-3">{r.label}</dt>
              <dd className="text-right text-sm text-pos-ink">
                {r.value?.trim() ? r.value : <span className="text-pos-ink-4">Non renseigné</span>}
              </dd>
            </div>
          ))}
        </dl>

        <button
          type="button"
          disabled
          className="mt-6 w-full cursor-not-allowed rounded-xl border border-pos-border bg-pos-card py-3 text-sm font-medium text-pos-ink-3"
        >
          Modifier — bientôt
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Étape 2 : Vérifier le typage**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "pos/settings"
```

Attendu : aucune sortie.

- [ ] **Étape 3 : Commiter**

```bash
git add "src/app/(pos)/pos/settings"
git commit -m "feat(pos): page profil du salon en lecture seule

Cible de la redirection /prestataire/profil des le lot A pour ne livrer aucune
404. Le formulaire d'edition et les horaires d'ouverture arrivent au lot C."
```

---

## Tâche 10 : Redirections /prestataire vers /pos

**Fichiers :**
- Modifier : les 7 `page.tsx` sous `src/app/(dashboard)/prestataire/`

Chaque fichier existant est **remplacé** par une redirection. Le code des pages n'est pas supprimé du dépôt — il est écrasé, et l'historique Git le conserve pour les lots B et C.

- [ ] **Étape 1 : Sauvegarder les pages à réutiliser aux lots B et C**

Les lots B et C ont besoin du code de `offres/[id]` (formulaire complet) et `profil` (horaires d'ouverture). Les copier avant écrasement :

```bash
mkdir -p docs/superpowers/reference/lot-a-pages-remplacees
cp "src/app/(dashboard)/prestataire/offres/[id]/page.tsx" docs/superpowers/reference/lot-a-pages-remplacees/offres-id-page.tsx.txt
cp "src/app/(dashboard)/prestataire/offres/page.tsx" docs/superpowers/reference/lot-a-pages-remplacees/offres-page.tsx.txt
cp "src/app/(dashboard)/prestataire/profil/page.tsx" docs/superpowers/reference/lot-a-pages-remplacees/profil-page.tsx.txt
cp "src/app/(dashboard)/prestataire/collaborations/page.tsx" docs/superpowers/reference/lot-a-pages-remplacees/collaborations-page.tsx.txt
```

L'extension `.txt` évite que Next.js ou TypeScript ne traite ces fichiers comme des routes.

- [ ] **Étape 2 : Rediriger le tableau de bord**

Remplacer tout le contenu de `src/app/(dashboard)/prestataire/page.tsx` par :

```tsx
import { redirect } from "next/navigation";

/**
 * Le portail prestataire est desormais la PWA POS. Cette redirection est
 * conservee pour que les liens deja envoyes par email aux salons pilotes,
 * les favoris et l'indexation continuent de fonctionner.
 */
export default function ProviderDashboardRedirect() {
  redirect("/pos");
}
```

- [ ] **Étape 3 : Rediriger la fidélité**

Remplacer tout le contenu de `src/app/(dashboard)/prestataire/fidelite/page.tsx` par :

```tsx
import { redirect } from "next/navigation";

export default function ProviderLoyaltyRedirect() {
  redirect("/pos/loyalty");
}
```

- [ ] **Étape 4 : Rediriger les réservations**

Remplacer tout le contenu de `src/app/(dashboard)/prestataire/reservations/page.tsx` par :

```tsx
import { redirect } from "next/navigation";

export default function ProviderBookingsRedirect() {
  redirect("/pos/calendar");
}
```

- [ ] **Étape 5 : Rediriger les collaborations**

Remplacer tout le contenu de `src/app/(dashboard)/prestataire/collaborations/page.tsx` par :

```tsx
import { redirect } from "next/navigation";

export default function ProviderCollabRedirect() {
  redirect("/pos/collab");
}
```

- [ ] **Étape 6 : Rediriger la liste des offres**

Remplacer tout le contenu de `src/app/(dashboard)/prestataire/offres/page.tsx` par :

```tsx
import { redirect } from "next/navigation";

export default function ProviderOffersRedirect() {
  redirect("/pos/services");
}
```

- [ ] **Étape 7 : Rediriger l'édition d'une offre**

Remplacer tout le contenu de `src/app/(dashboard)/prestataire/offres/[id]/page.tsx` par :

```tsx
import { redirect } from "next/navigation";

/**
 * Le parametre ?edit= est ignore par /pos/services au lot A ; il ouvrira le
 * drawer d'edition au lot B.
 */
export default async function ProviderOfferEditRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/pos/services?edit=${id}`);
}
```

- [ ] **Étape 8 : Rediriger le profil**

Remplacer tout le contenu de `src/app/(dashboard)/prestataire/profil/page.tsx` par :

```tsx
import { redirect } from "next/navigation";

export default function ProviderProfileRedirect() {
  redirect("/pos/settings");
}
```

- [ ] **Étape 9 : Supprimer le composant client orphelin de la fidélité**

`fidelite-client.tsx` n'est plus importé par personne (659 lignes). Le supprimer :

```bash
git rm "src/app/(dashboard)/prestataire/fidelite/fidelite-client.tsx"
```

- [ ] **Étape 10 : Vérifier le typage**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "prestataire"
```

Attendu : aucune sortie. Les erreurs préexistantes de ces fichiers disparaissent puisque le code est remplacé.

- [ ] **Étape 11 : Vérifier les redirections**

```bash
npm run dev
```

Se connecter avec un compte PROVIDER, puis visiter chaque URL et confirmer la cible :

| URL visitée | Doit arriver sur |
|---|---|
| `/prestataire` | `/pos` |
| `/prestataire/fidelite` | `/pos/loyalty` |
| `/prestataire/reservations` | `/pos/calendar` |
| `/prestataire/collaborations` | `/pos/collab` |
| `/prestataire/offres` | `/pos/services` |
| `/prestataire/offres/abc123` | `/pos/services?edit=abc123` |
| `/prestataire/profil` | `/pos/settings` |

Aucune ne doit afficher de 404 ni de page blanche.

Arrêter le serveur avec Ctrl+C.

- [ ] **Étape 12 : Commiter**

```bash
git add "src/app/(dashboard)/prestataire" docs/superpowers/reference
git commit -m "feat(pos): redirections /prestataire vers /pos

Les 7 routes du portail prestataire redirigent vers leur equivalent POS.
Les liens deja envoyes par email, les favoris et l'indexation continuent de
fonctionner. Le code des pages remplacees est conserve sous
docs/superpowers/reference pour les lots B et C ; fidelite-client.tsx est
supprime, plus aucun import ne le reference."
```

---

## Tâche 11 : Vérification finale du lot

- [ ] **Étape 1 : Vérifier l'absence de fuite vers l'ancien portail**

```bash
grep -rn "/prestataire" src/components/pos/ "src/app/(pos)/"
```

Attendu : aucune sortie.

- [ ] **Étape 2 : Vérifier l'absence d'erreur de typage nouvelle**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "rail|locked-feature|pos/interest|pos/collab|pos/store|pos/settings|services-list|api/offers|prestataire|salon/|offres/page"
```

Attendu : aucune sortie. Toute ligne renvoyée est une régression introduite par ce lot.

- [ ] **Étape 3 : Vérifier que le projet compile**

```bash
npm run build
```

Attendu : `Compiled successfully`. C'est la vérification la plus proche de la production, puisque le build régénère le client Prisma.

Si le build échoue sur `prisma generate` (paquet `effect` corrompu en local, règle 7), noter l'échec et s'en remettre à la vérification par `tsc` de l'étape 2 — le pipeline de déploiement régénère correctement.

- [ ] **Étape 4 : Dérouler la checklist fonctionnelle du spec**

```bash
npm run dev
```

Connecté en tant que PROVIDER :

1. Le rail affiche 14 entrées en 3 groupes, à 56px sur mobile et 80px sur desktop
2. Collab et Store sont grisées, cliquables, et mènent à leur teaser
3. « Être prévenu » enregistre l'inscription ; un second clic ne duplique rien
4. Créer un service via l'ajout rapide sur `/pos/services` : il porte le badge ambre « Ajouter une photo »
5. Ce service **n'apparaît pas** sur `/`, `/offres` ni `/salon/<id-du-salon>`
6. Un service antérieur au changement garde le badge « Hors ligne »
7. Les 7 redirections `/prestataire/*` aboutissent

Puis, connecté par PIN avec un employé **MANAGER** (via `/salon-pin`) :

8. `/pos/services` s'affiche, l'ajout rapide fonctionne **sans 401**, les bascules TVA et actif fonctionnent

Arrêter le serveur avec Ctrl+C.

- [ ] **Étape 5 : Pousser la branche**

```bash
git push -u origin pos-portail-unique
```

Ne **pas** fusionner dans `main` sans validation de l'utilisateur : le déploiement se déclenche automatiquement sur `main` et applique la migration en production.

---

## Récapitulatif des tâches

| # | Tâche | Fichiers | Nature |
|---|---|---|---|
| 0 | Créer la branche | — | git |
| 1 | Modèle `FeatureInterest` | 2 | données |
| 2 | API liste d'attente | 1 | backend |
| 3 | Auth employé + publication par défaut | 2 | backend |
| 4 | Filtre de visibilité du feed | 4 | backend |
| 5 | Rail 14 entrées | 1 | interface |
| 6 | Rail latéral sur mobile | 2 | interface |
| 7 | Pages teaser | 3 | interface |
| 8 | Badge à 3 états | 2 | interface |
| 9 | Page profil lecture seule | 1 | interface |
| 10 | Redirections | 8 | routage |
| 11 | Vérification finale | — | contrôle |

Les tâches 1 à 4 sont séquentielles (données → API). Les tâches 5 à 9 sont indépendantes entre elles. La tâche 10 dépend des tâches 7 et 9 (ses cibles doivent exister). La tâche 11 clôt le lot.
