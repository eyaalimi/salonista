# Accès salon sans module caisse — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour exécuter tâche par tâche. Les étapes
> utilisent des cases à cocher (`- [ ]`).

**But :** un salon dont le module caisse n'est pas activé accède à son espace
métier (services, RDV, clientes, profil, fidélité, stats) au lieu de se heurter
à un écran « Module non activé ».

**Architecture :** le blocage descend du *layout* vers les seules pages de
caisse. `src/app/(pos)/layout.tsx` cesse de bloquer et passe la liste des
modules actifs au rail de navigation, qui masque les entrées inaccessibles.
Chaque page de caisse porte son propre garde, via le composant `ModuleGate` qui
existe déjà.

**Pile :** Next.js 16.2 (App Router, composants serveur), Prisma 7, React 19.

**Spec :** `docs/superpowers/specs/2026-08-19-acces-salon-sans-caisse-design.md`

---

## À lire avant de commencer

### Ce chantier touche un module en production

La caisse tourne chez de vrais salons. **Le risque n'est pas d'oublier une page
métier** — ce serait visible immédiatement — mais d'ouvrir une page de caisse à
un salon qui n'y a pas droit, ou de casser l'accès d'un salon qui paie.

Chaque tâche se termine par une vérification des deux cas.

### Aucun test de composant n'est possible

Vitest tourne en `environment: "node"`, sans jsdom ni
`@testing-library/react`. **N'essaie pas d'écrire un test de composant React :
il ne peut pas tourner.** Ce qui *est* testable : la logique pure. La tâche 1
ajoute de vrais tests unitaires sur la fonction de décision, qui concentre
justement tout le raisonnement de ce chantier.

Le reste se vérifie par `tsc`, ESLint, `build`, et contrôle manuel.

### Les repères chiffrés

| Contrôle | Valeur attendue | Commande |
|---|---|---|
| Erreurs `tsc` | **exactement 23** (préexistantes) | `npx tsc --noEmit 2>&1 \| grep -c "error TS"` |
| Problèmes ESLint | **52 au maximum** | `npm run lint` |
| Tests | **180 au vert**, plus ceux ajoutés en tâche 1 | `npm test` |

**Les 23 erreurs `tsc` préexistent sur `main`** (`wizard-client.tsx`,
`rewards.test.ts`). **Ne les corrige pas** — elles sont hors périmètre. Le
contrôle consiste à vérifier que le total ne bouge pas.

### Deux pièges repérés dans le code

**1. `/pos` est l'écran d'encaissement.** Ce n'est pas un tableau de bord :
c'est la caisse elle-même. Un salon sans le module qui atterrit là se cogne au
mur. D'où la redirection vers `/pos/calendar` (tâche 3).

**2. Cinq pages redirigent vers `/pos` quand une permission manque** —
`customers`, `services`, `settings`, `loyalty`, `analytics` font toutes
`redirect("/pos")`. Une fois que `/pos` redirige vers `/pos/calendar`, une
boucle devient possible si le calendrier renvoie à son tour vers `/pos`.
**Le calendrier ne redirige pas** (il affiche « Permission insuffisante » en
place), donc la boucle n'existe pas aujourd'hui — mais la tâche 3 vérifie ce
point explicitement, car il est fragile.

---

## Structure des fichiers

| Fichier | Rôle | Tâche |
|---|---|---|
| `src/lib/pos-access.ts` | **créé** — décide où mène `/pos` et quelles entrées le rail affiche | 1 |
| `src/lib/pos-access.test.ts` | **créé** — tests unitaires de la décision | 1 |
| `src/app/(pos)/layout.tsx` | **modifié** — cesse de bloquer, passe les modules au rail | 2 |
| `src/components/pos/rail.tsx` | **modifié** — masque les entrées de caisse | 2 |
| `src/app/(pos)/pos/page.tsx` | **modifié** — redirige vers le calendrier sans le module | 3 |
| `src/app/(pos)/pos/cash-drawer/page.tsx` | **modifié** — `ModuleGate` | 4 |
| `src/app/(pos)/pos/sales/page.tsx` | **modifié** — `ModuleGate` | 4 |
| `src/app/(pos)/pos/products/page.tsx` | **modifié** — `ModuleGate` | 4 |
| `src/app/(pos)/pos/employees/page.tsx` | **modifié** — `ModuleGate` | 4 |
| `src/app/(pos)/pos/commissions/page.tsx` | **modifié** — `ModuleGate` | 4 |
| `src/app/(pos)/pos/sync-issues/page.tsx` | **modifié** — `ModuleGate` | 4 |

**Jamais touchés :** `loyalty`, `analytics`, `calendar`, `customers`,
`services`, `settings` (pages métier, doivent rester accessibles) ;
`collab`, `store` (teasers commerciaux, hors périmètre — voir la spec) ;
`bienvenue` (assistant de démarrage) ; `src/lib/modules.ts` ;
`src/lib/permissions.ts` ; `getCurrentEmployee()`.

---

## Tâche 1 : la fonction de décision, avec ses tests

**Pourquoi d'abord :** tout le raisonnement du chantier tient dans une question
— « ce salon a-t-il la caisse, et sinon où l'envoyer ? ». L'isoler dans une
fonction pure la rend testable, alors que rien de ce qui suit ne l'est.

**Fichiers :**
- Créer : `src/lib/pos-access.ts`
- Créer : `src/lib/pos-access.test.ts`

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `src/lib/pos-access.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { posLandingPath, isCashSection } from "./pos-access";

describe("posLandingPath", () => {
  it("envoie vers la caisse quand le module POS est actif", () => {
    expect(posLandingPath(["POS"])).toBe(null);
  });

  it("envoie vers le calendrier quand le module POS est absent", () => {
    expect(posLandingPath([])).toBe("/pos/calendar");
  });

  it("envoie vers le calendrier quand seul REWARDS est actif", () => {
    expect(posLandingPath(["REWARDS"])).toBe("/pos/calendar");
  });

  it("envoie vers la caisse quand POS et REWARDS sont actifs", () => {
    expect(posLandingPath(["POS", "REWARDS"])).toBe(null);
  });
});

describe("isCashSection", () => {
  it("reconnait les pages de caisse", () => {
    expect(isCashSection("/pos/cash-drawer")).toBe(true);
    expect(isCashSection("/pos/sales")).toBe(true);
    expect(isCashSection("/pos/products")).toBe(true);
    expect(isCashSection("/pos/employees")).toBe(true);
    expect(isCashSection("/pos/commissions")).toBe(true);
    expect(isCashSection("/pos/sync-issues")).toBe(true);
  });

  it("reconnait la caisse elle-meme", () => {
    expect(isCashSection("/pos")).toBe(true);
  });

  it("ne bloque pas les pages metier", () => {
    expect(isCashSection("/pos/calendar")).toBe(false);
    expect(isCashSection("/pos/customers")).toBe(false);
    expect(isCashSection("/pos/services")).toBe(false);
    expect(isCashSection("/pos/settings")).toBe(false);
  });

  it("ne bloque pas la fidelite ni les stats", () => {
    expect(isCashSection("/pos/loyalty")).toBe(false);
    expect(isCashSection("/pos/analytics")).toBe(false);
  });

  it("ne bloque pas les teasers commerciaux", () => {
    expect(isCashSection("/pos/collab")).toBe(false);
    expect(isCashSection("/pos/store")).toBe(false);
  });
});
```

- [ ] **Étape 2 : vérifier qu'il échoue**

```bash
npx vitest run src/lib/pos-access.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./pos-access"`.

- [ ] **Étape 3 : écrire l'implémentation**

Créer `src/lib/pos-access.ts` :

```ts
import type { SubscriptionModule } from "@/generated/prisma/enums";

/**
 * Les sections reservees au module caisse.
 *
 * `/pos` lui-meme en fait partie : la racine de la PWA n'est pas un tableau
 * de bord, c'est l'ecran d'encaissement.
 *
 * Volontairement absentes : calendar, customers, services, settings (metier),
 * loyalty (module REWARDS, distinct), analytics (lit aussi les reservations
 * en ligne), collab et store (argumentaires commerciaux montres a tous).
 */
const CASH_SECTIONS = [
  "/pos/cash-drawer",
  "/pos/sales",
  "/pos/products",
  "/pos/employees",
  "/pos/commissions",
  "/pos/sync-issues",
] as const;

/**
 * Ou envoyer un salon qui ouvre `/pos` ?
 *
 * Retourne `null` si la caisse est accessible (aucune redirection), sinon le
 * chemin de repli. Le calendrier est le quotidien d'un salon qui ne vend pas
 * au comptoir : il y voit ses rendez-vous du jour.
 */
export function posLandingPath(activeModules: SubscriptionModule[]): string | null {
  return activeModules.includes("POS") ? null : "/pos/calendar";
}

/** Ce chemin releve-t-il du module caisse ? */
export function isCashSection(pathname: string): boolean {
  if (pathname === "/pos") return true;
  return CASH_SECTIONS.some(
    (s) => pathname === s || pathname.startsWith(s + "/"),
  );
}
```

- [ ] **Étape 4 : vérifier que les tests passent**

```bash
npx vitest run src/lib/pos-access.test.ts
```

Attendu : 9 tests au vert.

- [ ] **Étape 5 : vérifier les repères**

```bash
npm test 2>&1 | tail -5
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Attendu : tous les tests au vert (180 + 9 nouveaux) ; `tsc` affiche
**exactement 23**.

- [ ] **Étape 6 : commit**

```bash
git add src/lib/pos-access.ts src/lib/pos-access.test.ts
git commit -m "feat(pos): fonction de decision d'acces sans module caisse"
```

---

## Tâche 2 : le layout cesse de bloquer, le rail s'adapte

**Le cœur du correctif.** Après cette tâche, un salon sans le module atteint
enfin ses pages métier.

**Fichiers :**
- Modifier : `src/app/(pos)/layout.tsx:30-53`
- Modifier : `src/components/pos/rail.tsx:40,44-48,51-54,57-65,73-74,116-129`

- [ ] **Étape 1 : retirer les deux blocages du layout**

Dans `src/app/(pos)/layout.tsx`, remplacer **tout le bloc des lignes 30 à 53**
(du `const moduleActive` jusqu'à l'accolade fermante du second `if`) par :

```tsx
  // Les modules ne bloquent plus l'acces a la PWA : un salon sans le module
  // caisse garde son espace metier (RDV, clientes, services, profil). Le
  // blocage est porte page par page, par les seules pages de caisse.
  const activeModules = await getActiveModules(employee.providerId);
```

Puis, dans les imports (ligne 5), remplacer :

```tsx
import { hasModule } from "@/lib/modules";
```

par :

```tsx
import { getActiveModules } from "@/lib/modules";
```

**Le garde `pos.sell` disparait aussi** : il bloquait le layout entier, donc un
employe sans cette permission perdait aussi ses pages metier. Chaque page de
caisse porte deja son propre controle de permission.

- [ ] **Étape 2 : passer les modules au rail**

Toujours dans `src/app/(pos)/layout.tsx`, à la ligne du `<Rail>` (ligne 79
avant modification) :

```tsx
            <Rail permissions={employee.permissions} activeModules={activeModules} />
```

- [ ] **Étape 3 : le rail accepte et applique les modules**

Dans `src/components/pos/rail.tsx` :

Ajouter l'import du type en haut du fichier, après les imports `lucide-react` :

```tsx
import type { SubscriptionModule } from "@/generated/prisma/enums";
```

Ajouter un champ au type `RailItem` (après `locked?: boolean;`, ligne 37) :

```tsx
  /**
   * Module requis pour que l'entree soit utile. Sans lui, l'entree est
   * masquee : mieux vaut ne rien montrer qu'un lien vers un mur.
   */
  module?: SubscriptionModule;
```

Changer la signature (ligne 40) :

```tsx
export function Rail({
  permissions,
  activeModules,
}: {
  permissions: Record<Permission, boolean>;
  activeModules: SubscriptionModule[];
}) {
```

Marquer les entrées de caisse. Remplacer `groupCaisse` (lignes 44-48) :

```tsx
  // Groupe 1 — CAISSE : le quotidien de la caissiere.
  const groupCaisse: RailItem[] = [
    { href: "/pos", label: "Caisse", shortcut: "1", icon: <LayoutGrid size={20} />, perm: "pos.sell", module: "POS" },
    { href: "/pos/calendar", label: "RDV", shortcut: "B", icon: <Calendar size={20} />, perm: "bookings.view" },
    { href: "/pos/customers", label: "Clients", shortcut: "C", icon: <Users size={20} />, perm: "customers.view" },
  ];
```

Remplacer `groupCatalogue` (lignes 51-54) :

```tsx
  // Groupe 2 — CATALOGUE : ce que le salon vend.
  const groupCatalogue: RailItem[] = [
    { href: "/pos/services", label: "Services", shortcut: "S", icon: <Scissors size={20} />, perm: "products.manage" },
    { href: "/pos/products", label: "Produits", shortcut: "P", icon: <Package size={20} />, perm: "inventory.view", module: "POS" },
  ];
```

Remplacer `groupGestion` (lignes 57-65) :

```tsx
  // Groupe 3 — GESTION : ce que le proprietaire consulte.
  const groupGestion: RailItem[] = [
    { href: "/pos/sales", label: "Ventes", shortcut: "V", icon: <Receipt size={20} />, perm: "pos.sell", module: "POS" },
    { href: "/pos/cash-drawer", label: "Tiroir", shortcut: "F", icon: <Wallet size={20} />, perm: "pos.cash_drawer", module: "POS" },
    { href: "/pos/loyalty", label: "Fidélité", shortcut: "L", icon: <Star size={20} />, perm: "rewards.adjust" },
    { href: "/pos/commissions", label: "Commissions", shortcut: "M", icon: <Coins size={20} />, perm: "employees.manage", module: "POS" },
    { href: "/pos/employees", label: "Équipe", shortcut: "E", icon: <UserCog size={20} />, perm: "employees.manage", module: "POS" },
    { href: "/pos/analytics", label: "Stats", shortcut: "A", icon: <BarChart3 size={20} />, perm: "analytics.view" },
    { href: "/pos/settings", label: "Profil", shortcut: "R", icon: <Settings size={20} />, perm: "settings.manage" },
  ];
```

**`loyalty`, `analytics` et `settings` n'ont volontairement pas de `module`** :
ce sont des pages métier qui restent visibles sans la caisse.

Appliquer le filtre dans `renderItem` (ligne 74) :

```tsx
    if (it.perm && !it.locked && !permissions[it.perm]) return null;
    if (it.module && !activeModules.includes(it.module)) return null;
```

- [ ] **Étape 4 : éviter les séparateurs orphelins**

Sans le module caisse, le groupe 1 perd son entrée « Caisse » et le groupe 3
perd quatre entrées sur sept. Des séparateurs peuvent alors se retrouver côte à
côte ou en tête de rail.

Remplacer le bloc de rendu final (lignes 116-129) :

```tsx
  const groups = [groupCaisse, groupCatalogue, groupGestion, groupLocked]
    .map((g) => g.map(renderItem).filter(Boolean))
    .filter((g) => g.length > 0);

  return (
    <aside
      className="flex h-full shrink-0 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden border-r border-pos-border bg-pos-rail md:w-[80px] w-[56px] md:px-2 px-1 py-3"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      aria-label="Navigation principale"
    >
      {groups.map((g, i) => (
        <Fragment key={i}>
          {i > 0 && separator(`sep-${i}`)}
          {g}
        </Fragment>
      ))}
    </aside>
  );
```

Ajouter `Fragment` à l'import React en haut du fichier :

```tsx
import { Fragment } from "react";
```

- [ ] **Étape 5 : vérifier les repères**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx tsc --noEmit 2>&1 | grep -E "pos-access|rail\.tsx|\(pos\)/layout"
npm run lint 2>&1 | tail -3
npm test 2>&1 | tail -5
```

Attendu : **exactement 23** erreurs ; **aucune sortie** sur le second filtre
(nos fichiers sont propres) ; ESLint **≤ 52** ; tests au vert.

- [ ] **Étape 6 : vérifier qu'aucun blocage ne subsiste dans le layout**

```bash
grep -n "hasModule\|Module non activé\|pos.sell" "src/app/(pos)/layout.tsx"
```

Attendu : **aucune sortie**.

- [ ] **Étape 7 : commit**

```bash
git add "src/app/(pos)/layout.tsx" src/components/pos/rail.tsx
git commit -m "fix(pos): le module caisse ne bloque plus l'acces a l'espace salon"
```

---

## Tâche 3 : `/pos` renvoie au calendrier sans le module

Sans cette tâche, un salon sans caisse se connecte et atterrit sur l'écran
d'encaissement — un mur, malgré la tâche 2.

**Fichiers :**
- Modifier : `src/app/(pos)/pos/page.tsx`

- [ ] **Étape 1 : lire la page**

```bash
head -30 "src/app/(pos)/pos/page.tsx"
```

Repérer l'appel à `getCurrentEmployee()` et le premier `redirect`.

- [ ] **Étape 2 : ajouter la redirection**

Ajouter aux imports :

```tsx
import { getActiveModules } from "@/lib/modules";
import { posLandingPath } from "@/lib/pos-access";
```

Puis, **immédiatement après** le garde `if (!employee) redirect("/salon-pin");` :

```tsx
  // Sans le module caisse, `/pos` (l'ecran d'encaissement) n'a pas de sens :
  // on envoie le salon vers son quotidien, ses rendez-vous du jour.
  const landing = posLandingPath(await getActiveModules(employee.providerId));
  if (landing) redirect(landing);
```

- [ ] **Étape 3 : vérifier qu'aucune boucle de redirection n'existe**

Cinq pages font `redirect("/pos")` quand une permission manque. Si l'une
d'elles était la cible du repli, un salon sans le module tournerait en rond.

```bash
grep -n 'redirect("/pos")' "src/app/(pos)/pos/calendar/page.tsx"
```

Attendu : **aucune sortie** — le calendrier affiche « Permission
insuffisante. » en place plutôt que de rediriger. **Si cette commande retourne
quelque chose, arrête-toi et signale-le** : la cible de repli doit être changée.

- [ ] **Étape 4 : vérifier les repères**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -3
```

Attendu : **exactement 23** ; ESLint **≤ 52**.

- [ ] **Étape 5 : commit**

```bash
git add "src/app/(pos)/pos/page.tsx"
git commit -m "fix(pos): sans caisse, /pos ouvre le calendrier des RDV"
```

---

## Tâche 4 : chaque page de caisse porte son garde

Le blocage retiré du layout doit revenir sur les six pages qui en ont réellement
besoin. **Sans cette tâche, le chantier ouvre la caisse à des salons qui n'y ont
pas droit** — c'est la tâche qui protège le module payant.

**Fichiers (6) :**
- Modifier : `src/app/(pos)/pos/cash-drawer/page.tsx`
- Modifier : `src/app/(pos)/pos/sales/page.tsx`
- Modifier : `src/app/(pos)/pos/products/page.tsx`
- Modifier : `src/app/(pos)/pos/employees/page.tsx`
- Modifier : `src/app/(pos)/pos/commissions/page.tsx`
- Modifier : `src/app/(pos)/pos/sync-issues/page.tsx`

- [ ] **Étape 1 : d'abord corriger les redirections vers `/pos`**

**À faire avant d'ajouter le moindre garde.** Quatre de ces six pages font
`redirect("/pos")` quand une permission manque — `cash-drawer:10`,
`employees:10`, `commissions:11`, `sync-issues:11`. Depuis la tâche 3, `/pos`
renvoie lui-même vers `/pos/calendar` pour un salon sans le module. La chaîne
reste finie (deux sauts, puis le calendrier qui ne redirige pas), donc **il n'y
a pas de boucle** — mais un employé sans permission traverserait deux
redirections pour rien.

Dans ces quatre fichiers, remplacer `redirect("/pos")` par :

```tsx
redirect("/pos/calendar");
```

Vérifier :

```bash
grep -rn 'redirect("/pos")' "src/app/(pos)/pos/cash-drawer/page.tsx" \
  "src/app/(pos)/pos/employees/page.tsx" \
  "src/app/(pos)/pos/commissions/page.tsx" \
  "src/app/(pos)/pos/sync-issues/page.tsx"
```

Attendu : **aucune sortie**.

- [ ] **Étape 2 : appliquer le garde aux cinq pages qui ont un `employee`**

Concerne `cash-drawer`, `products`, `employees`, `commissions`, `sync-issues`.
**`sales` est traitée à l'étape 3 — elle a une forme différente.**

Ajouter l'import :

```tsx
import { ModuleGate } from "@/components/module-gate";
```

Puis envelopper le contenu retourné. Sur l'exemple de `cash-drawer/page.tsx`,
dont le corps complet devient :

```tsx
export default async function CashDrawerListPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["pos.cash_drawer"]) redirect("/pos/calendar");
  return (
    <ModuleGate module="POS" providerId={employee.providerId}>
      <CashDrawerListClient />
    </ModuleGate>
  );
}
```

**Trois précautions :**

1. **Ne touche à rien d'autre.** Pas de restyle, pas de renommage, pas de
   correction annexe. Ces pages sont en production.
2. **Le garde va après `getCurrentEmployee()`**, car `providerId` en dépend.
3. **Garde les contrôles de permission existants.** Module et permission sont
   deux questions différentes : « ce salon a-t-il payé ? » et « cet employé
   a-t-il le droit ? ». Laisse les retours anticipés **au-dessus** du
   `ModuleGate` — inutile de vérifier l'abonnement d'un employé qui n'a de toute
   façon pas la permission.

- [ ] **Étape 3 : le cas particulier de `sales`**

`src/app/(pos)/pos/sales/page.tsx` fait 7 lignes, **n'appelle pas
`getCurrentEmployee()` et n'est même pas `async`**. Le motif de l'étape 2 ne
s'y applique pas : `employee.providerId` n'y existe pas. Elle doit d'abord
récupérer l'employé.

Remplacer **tout le fichier** par :

```tsx
import { redirect } from "next/navigation";
import { SalesListClient } from "@/components/pos/sales-list-client";
import { getCurrentEmployee } from "@/lib/employee-session";
import { ModuleGate } from "@/components/module-gate";

export const metadata = { title: "Ventes — Salonista" };

export default async function SalesPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  return (
    <ModuleGate module="POS" providerId={employee.providerId}>
      <SalesListClient />
    </ModuleGate>
  );
}
```

**Ce fichier passe de synchrone à `async`.** C'est nécessaire — `ModuleGate`
interroge la base — et sans conséquence : Next.js gère les composants serveur
asynchrones nativement, et `SalesListClient` reste inchangé.

- [ ] **Étape 4 : vérifier que les six pages sont couvertes**

```bash
for p in cash-drawer sales products employees commissions sync-issues; do
  printf "%-14s %s\n" "$p" "$(grep -c 'ModuleGate' "src/app/(pos)/pos/$p/page.tsx")"
done
```

Attendu : chaque ligne affiche **2** (l'import et l'usage).

- [ ] **Étape 5 : vérifier qu'aucune page métier n'a été gardée par erreur**

C'est le contrôle miroir : la tâche 4 ne doit **pas** déborder.

```bash
for p in calendar customers services settings loyalty analytics collab store; do
  printf "%-12s %s\n" "$p" "$(grep -c 'ModuleGate' "src/app/(pos)/pos/$p/page.tsx")"
done
```

Attendu : chaque ligne affiche **0**. Une valeur non nulle signifie qu'une page
métier vient d'être bloquée — exactement le bug que ce chantier corrige.

- [ ] **Étape 6 : vérifier les repères**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx tsc --noEmit 2>&1 | grep -E "\(pos\)/pos/(cash-drawer|sales|products|employees|commissions|sync-issues)"
npm run lint 2>&1 | tail -3
npm test 2>&1 | tail -5
```

Attendu : **exactement 23** ; **aucune sortie** sur le second filtre ; ESLint
**≤ 52** ; tests au vert.

Le second filtre compte : `sales` vient de passer en `async`, et c'est
exactement le genre de changement qu'une erreur de type révélerait.

- [ ] **Étape 7 : commit**

```bash
git add "src/app/(pos)/pos/cash-drawer/page.tsx" "src/app/(pos)/pos/sales/page.tsx" \
  "src/app/(pos)/pos/products/page.tsx" "src/app/(pos)/pos/employees/page.tsx" \
  "src/app/(pos)/pos/commissions/page.tsx" "src/app/(pos)/pos/sync-issues/page.tsx"
git commit -m "feat(pos): chaque page de caisse porte son propre garde de module"
```

---

## Tâche 5 : vérification d'ensemble

**Fichiers :** aucun (vérification seule).

- [ ] **Étape 1 : la compilation complète**

```bash
npm run build
```

Attendu : succès. C'est le seul contrôle qui exerce réellement le rendu des
pages serveur.

- [ ] **Étape 2 : les trois repères, une dernière fois**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -3
npm test 2>&1 | tail -5
```

Attendu : **23** ; **≤ 52** ; tous au vert.

- [ ] **Étape 3 : relire le diff en entier**

```bash
git diff main --stat
git diff main -- "src/app/(pos)/layout.tsx"
```

Vérifier qu'aucun fichier hors du tableau « Structure des fichiers » n'apparaît.

- [ ] **Étape 4 : préparer le contrôle manuel**

Ce contrôle **exige deux comptes** — un salon avec le module caisse actif, un
sans. Sans les deux, on ne peut pas vérifier que le correctif marche **et**
qu'il n'a rien cassé.

Écrire dans le message de la PR la liste à cocher :

```
Salon SANS le module caisse :
- [ ] La connexion mène au calendrier des RDV, pas à un mur
- [ ] Le rail montre : RDV, Clients, Services, Fidélité, Stats, Profil
- [ ] Le rail NE montre PAS : Caisse, Produits, Ventes, Tiroir, Commissions, Équipe
- [ ] Aucun séparateur orphelin (deux traits collés, ou un trait en haut du rail)
- [ ] /pos/cash-drawer saisi à la main affiche « Module non activé », pas une erreur

Salon AVEC le module caisse (non-régression) :
- [ ] La connexion mène à l'écran d'encaissement, comme avant
- [ ] Le rail est identique à avant le chantier
- [ ] Un encaissement complet fonctionne
- [ ] Le tiroir et le rapport Z fonctionnent
```

- [ ] **Étape 5 : pousser et ouvrir la PR**

```bash
git push -u origin fix-acces-salon-sans-caisse
```

`gh` n'est pas installé : ouvrir la PR depuis l'interface GitHub, en collant la
liste à cocher de l'étape 4.

---

## Ce que ce plan ne fait pas

- **Reconnecter les collaborations.** `/pos/collab` reste un argumentaire
  commercial. La vraie page existe dans l'historique (343 lignes, commit
  `cf930a9`) et l'API fonctionne, mais la porter est un chantier distinct.
- **Réhabiliter `/prestataire`.** Les sept coquilles de redirection restent.
  L'accès passe par la PWA, qui s'ouvre aussi bien dans un navigateur.
- **Toucher au design de la PWA.** Aucun restyle : c'est un correctif
  fonctionnel.
- **Corriger les 23 erreurs `tsc`** ni les 52 problèmes ESLint préexistants.
