# Accessibilité des sélecteurs à onglets — plan d'implémentation

> **Pour les agents :** SOUS-SKILL REQUISE — utilise superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** rendre chaque sélecteur à onglets correct selon ce qu'il fait réellement — l'un perd un rôle ARIA inapproprié, les deux autres gagnent la navigation clavier.

**Architecture :** trois fichiers, trois problèmes différents, environ 60 lignes au total. Aucune classe de style ne change : le rendu visuel est strictement identique avant et après.

**Stack :** Next.js 16.2, React 19, TypeScript.

---

## Contexte pour qui n'a jamais vu ce dépôt

### Le sujet n'est pas uniforme — c'est le point clé

Trois endroits portent `role="tablist"`. On pourrait croire qu'il suffit d'ajouter les flèches du clavier aux trois. **La lecture du code montre trois situations différentes**, dont une où le balisage lui-même est le défaut :

| Fichier | Ce qu'il fait vraiment | Problème |
|---|---|---|
| `role-tabs.tsx` | Change une phrase et un lien | **`tablist` inapproprié** |
| `offer-client.tsx` | Bascule inscription ↔ connexion | Pas de clavier |
| `settings-tabs.tsx` | Bascule un formulaire entier | Pas de clavier, **ni `aria-controls`** |

Ajouter les flèches partout renforcerait un balisage erroné dans un cas sur trois.

### Pourquoi `role-tabs.tsx` doit perdre son rôle d'onglets

Un `role="tab"` **promet** à un lecteur d'écran qu'un panneau associé existe et va changer quand on sélectionne l'onglet.

Or ce composant ne contrôle aucun panneau. Vérifié dans `src/app/(auth)/login/login-client.tsx` : le rôle choisi alimente seulement `current.tagline` (une phrase d'accroche, ligne 62) et `current.registerHref` (la cible d'un lien, ligne 144). Son propre commentaire le dit déjà :

> « IMPORTANT : il n'agit PAS sur l'authentification. `signIn("credentials")` ne prend aucun rôle […]. Ce sélecteur change l'accroche et la destination d'inscription — rien d'autre. »

Une utilisatrice non voyante y chercherait donc un contenu qui n'apparaît jamais. Il devient un **groupe de boutons** : `role="group"` + `aria-pressed`, ce qu'il est réellement.

`aria-pressed` est déjà utilisé ailleurs dans le projet (`offer-client.tsx`, `salon-client.tsx`) — le choix est cohérent avec l'existant.

### Le pattern clavier retenu

Pour les deux vrais sélecteurs, le pattern APG à **activation automatique** :

- **`tabIndex` mobile** (« roving tabindex ») : l'onglet actif porte `tabIndex={0}`, les autres `tabIndex={-1}`. Au clavier, `Tab` entre dans le groupe **une seule fois** au lieu de traverser chaque onglet.
- **Flèches gauche/droite** pour circuler, avec **bouclage** : du dernier on revient au premier.
- **Le focus suit la sélection** : appuyer sur une flèche change l'onglet actif immédiatement, sans avoir à valider par `Entrée`.

### Contraintes générales

- **Aucun test automatisé ne juge l'accessibilité ici.** Vitest tourne en `environment: "node"` sans jsdom, et aucun outil d'audit n'est installé. N'essaie pas d'en écrire. La vérification passe par `grep`, `tsc`, ESLint, le build, et **le contrôle clavier de l'utilisatrice**.
- **180 tests doivent rester au vert** — ce chantier n'en ajoute ni n'en retire aucun.
- **`tsc` n'est pas propre au départ :** 23 erreurs préexistent sur `main`. Filtre toujours sur les trois fichiers concernés.
- **ESLint : 52 problèmes sur `main`.** Ce nombre ne doit pas augmenter.
- **Aucune classe de style ne change.** Si tu te surprends à modifier une couleur, une taille ou un espacement, tu sors du périmètre.
- Interface en français, tutoiement.

### Ce qu'il ne faut toucher sous aucun prétexte

- `signIn("credentials")` et la redirection par rôle dans `login-client.tsx`
- La logique `useState` des trois sélecteurs (`role`, `authMode`, `tab`)
- Les formulaires eux-mêmes : `SalonForm`, `HoursForm`, le formulaire d'inscription intégré de la fiche offre
- L'apparence : toutes les `className` restent identiques

---

## Structure des fichiers

| Fichier | Lignes | Action |
|---|---|---|
| `src/components/ui/role-tabs.tsx` | 41-77 | `tablist` → `group`, `aria-selected` → `aria-pressed` |
| `src/app/offre/[id]/offer-client.tsx` | 362-393 | `tabIndex` mobile + flèches |
| `src/components/pos/settings/settings-tabs.tsx` | tout (49 lignes) | `tabIndex` + flèches + `aria-controls` / `tabpanel` |

---

## Tâche 0 : vérifier le point de départ

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : confirmer la branche**

```bash
git branch --show-current
git status --short
```

Attendu : `fix-aria-tablist`, arbre propre. La branche part de `main` (55af317) et la spec y est déjà commitée.

- [ ] **Étape 2 : établir la ligne de base**

```bash
npm test 2>&1 | grep -E "Test Files|Tests "
npm run lint 2>&1 | tail -2
```

Attendu : **180 tests au vert** (13 fichiers), et `✖ 52 problems (40 errors, 12 warnings)`.

- [ ] **Étape 3 : constater l'état actuel**

```bash
grep -rn 'role="tablist"' src/ --include=*.tsx
grep -rc "onKeyDown\|ArrowLeft\|tabIndex" src/components/ui/role-tabs.tsx "src/app/offre/[id]/offer-client.tsx" src/components/pos/settings/settings-tabs.tsx
grep -c "tabpanel\|aria-controls" src/components/pos/settings/settings-tabs.tsx
```

Attendu : **3** `tablist` ; **0** gestion clavier dans les trois fichiers ; **0** lien onglet-panneau dans `settings-tabs`.

---

## Tâche 1 : `role-tabs.tsx` perd son rôle d'onglets

**Fichiers :**
- Modifier : `src/components/ui/role-tabs.tsx:41-77`

- [ ] **Étape 1 : remplacer le composant**

Remplace la fonction `RoleTabs` en entier (de `export function RoleTabs({` jusqu'à l'accolade fermante finale) par :

```tsx
export function RoleTabs({
  value,
  onChange,
}: {
  value: RoleKey;
  onChange: (next: RoleKey) => void;
}) {
  return (
    // `group` et non `tablist` : ce selecteur ne controle aucun panneau. Il
    // change l'accroche affichee et la destination d'inscription — rien
    // d'autre (voir le commentaire en tete de fichier). Un `role="tab"`
    // promettrait a un lecteur d'ecran un panneau qui n'existe pas.
    <div
      role="group"
      aria-label="Je suis"
      className="flex gap-1 rounded-[var(--radius-pill)] bg-rose-soft p-1"
    >
      {ROLE_OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.key)}
            className={
              "ds-press ds-focus flex-1 min-h-[44px] px-3 " +
              "rounded-[var(--radius-pill)] text-sm font-semibold " +
              (active
                ? "bg-rose text-prune"
                : "bg-transparent text-prune hover:bg-white/60")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

Trois changements, et **aucun autre** :

- `role="tablist"` devient `role="group"`
- `role="tab"` disparaît de chaque bouton
- `aria-selected={active}` devient `aria-pressed={active}`

**Les `className` sont identiques au caractère près.** Le rendu ne bouge pas.

Pas de `tabIndex` mobile ici : dans un groupe de boutons, chaque bouton **doit** rester atteignable par `Tab`. C'est le comportement natif et le bon.

- [ ] **Étape 2 : vérifier**

```bash
grep -c 'role="tablist"\|role="tab"\|aria-selected' src/components/ui/role-tabs.tsx
grep -c 'role="group"\|aria-pressed' src/components/ui/role-tabs.tsx
grep -c "ROLE_OPTIONS\|RoleKey" src/components/ui/role-tabs.tsx
npx tsc --noEmit 2>&1 | grep -E "role-tabs"
```

Attendu : **0** pour le premier (plus aucun balisage d'onglets), **≥ 2** pour le deuxième, **≥ 3** pour le troisième (le type et les options sont intacts), aucune sortie de `tsc`.

Rappel : `npx tsc --noEmit` sans filtre affiche 23 erreurs préexistantes ailleurs — ignore-les, ne les corrige sous aucun prétexte.

- [ ] **Étape 3 : vérifier que la page de connexion fonctionne toujours**

```bash
grep -c "RoleTabs\|current.tagline\|current.registerHref" "src/app/(auth)/login/login-client.tsx"
grep -c "signIn" "src/app/(auth)/login/login-client.tsx"
npm test 2>&1 | grep -E "Tests "
```

Attendu : le premier ≥ 3 (le sélecteur et ses deux effets sont intacts), le deuxième ≥ 1 (**l'authentification n'a pas été touchée**), **180 tests au vert**.

- [ ] **Étape 4 : commit**

```bash
git add src/components/ui/role-tabs.tsx
git commit -m "fix(a11y): role-tabs devient un groupe de boutons, pas des onglets"
```

---

## Tâche 2 : navigation clavier sur les onglets de la fiche offre

**Fichiers :**
- Modifier : `src/app/offre/[id]/offer-client.tsx:362-393`

Ces onglets basculent entre « Nouveau client » et « J'ai déjà un compte », ce qui affiche deux champs de plus. C'est un vrai sélecteur : le balisage `tablist` est justifié, il lui manque le clavier.

- [ ] **Étape 1 : remplacer le bloc des deux onglets**

Repère le `<div role="tablist" aria-label="Type de compte">` (vers la ligne 363) et remplace-le, jusqu'à son `</div>` fermant, par :

```tsx
                    <div
                      role="tablist"
                      aria-label="Type de compte"
                      onKeyDown={(e) => {
                        // Fleches gauche/droite avec bouclage : le pattern APG
                        // attend qu'on circule entre onglets sans sortir du
                        // groupe. L'activation est automatique — le focus suit
                        // la selection, pas besoin de valider par Entree.
                        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                        e.preventDefault();
                        setAuthMode(authMode === "register" ? "login" : "register");
                      }}
                      className="mb-4 flex gap-1 rounded-[var(--radius-pill)] bg-rose-soft p-1"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={authMode === "register"}
                        tabIndex={authMode === "register" ? 0 : -1}
                        onClick={() => setAuthMode("register")}
                        className={`ds-press ds-focus min-h-[44px] flex-1 rounded-[var(--radius-pill)] px-3 text-sm font-semibold ${
                          authMode === "register"
                            ? "bg-rose text-prune"
                            : "bg-transparent text-prune hover:bg-white/60"
                        }`}
                      >
                        Nouveau client
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={authMode === "login"}
                        tabIndex={authMode === "login" ? 0 : -1}
                        onClick={() => setAuthMode("login")}
                        className={`ds-press ds-focus min-h-[44px] flex-1 rounded-[var(--radius-pill)] px-3 text-sm font-semibold ${
                          authMode === "login"
                            ? "bg-rose text-prune"
                            : "bg-transparent text-prune hover:bg-white/60"
                        }`}
                      >
                        J&apos;ai déjà un compte
                      </button>
                    </div>
```

Ce qui change, et **rien d'autre** :

- un `onKeyDown` sur le conteneur
- `tabIndex` sur chaque bouton : `0` si actif, `-1` sinon

**Les `className` sont identiques.** Avec deux onglets seulement, gauche et droite font la même chose — basculer vers l'autre — ce qui est le bouclage attendu.

Le `onKeyDown` est posé sur le **conteneur** et non sur chaque bouton : l'événement remonte depuis le bouton focalisé, une seule fonction suffit.

- [ ] **Étape 2 : vérifier**

```bash
grep -c "tabIndex" "src/app/offre/[id]/offer-client.tsx"
grep -c "ArrowLeft\|ArrowRight" "src/app/offre/[id]/offer-client.tsx"
grep -c "setAuthMode" "src/app/offre/[id]/offer-client.tsx"
npx tsc --noEmit 2>&1 | grep -E "offer-client"
```

Attendu : `tabIndex` **≥ 2**, les flèches **≥ 2**, `setAuthMode` **≥ 3** (les deux `onClick` plus le clavier), aucune sortie de `tsc`.

- [ ] **Étape 3 : vérifier que le parcours d'inscription est intact**

C'est le parcours des visiteuses venues d'un lien d'influenceuse — il ne doit pas bouger.

```bash
grep -c "autoVerify\|signIn(\"credentials\"\|updateSession\|createBooking" "src/app/offre/[id]/offer-client.tsx"
grep -c "tracking_ref\|trackingToken" "src/app/offre/[id]/offer-client.tsx"
npm test 2>&1 | grep -E "Tests "
```

Attendu : le premier **≥ 4**, le second **≥ 3**, **180 tests au vert**.

- [ ] **Étape 4 : commit**

```bash
git add "src/app/offre/[id]/offer-client.tsx"
git commit -m "fix(a11y): navigation clavier sur les onglets de la fiche offre"
```

---

## Tâche 3 : `settings-tabs.tsx`, le seul vrai tablist

**Fichiers :**
- Modifier : `src/components/pos/settings/settings-tabs.tsx` (le fichier entier, 49 lignes)

Ce composant bascule un formulaire complet contre un autre. Il lui manque le clavier **et** les liens entre onglet et panneau : sans `aria-controls`, un lecteur d'écran ne peut pas annoncer quel contenu l'onglet commande.

- [ ] **Étape 1 : remplacer le fichier**

Remplace tout le contenu de `src/components/pos/settings/settings-tabs.tsx` par :

```tsx
"use client";

import { useState } from "react";
import { SalonForm, type SalonProfile } from "@/components/pos/settings/salon-form";
import { HoursForm } from "@/components/pos/settings/hours-form";
import type { OpeningHours } from "@/lib/opening-hours";

type TabId = "salon" | "horaires";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "salon", label: "Salon" },
  { id: "horaires", label: "Horaires" },
];

export function SettingsTabs({
  profile,
  openingHours,
}: {
  profile: SalonProfile;
  openingHours: OpeningHours | null;
}) {
  const [tab, setTab] = useState<TabId>("salon");

  // Fleches gauche/droite avec bouclage, pattern APG a activation automatique :
  // le focus suit la selection, sans validation par Entree.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : (i - 1 + TABS.length) % TABS.length;
    setTab(TABS[next].id);
  }

  return (
    <>
      <div
        role="tablist"
        aria-label="Reglages du salon"
        onKeyDown={onKeyDown}
        className="mt-4 flex border-b border-pos-border"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`onglet-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panneau-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-b-2 border-pos-ink text-pos-ink"
                : "text-pos-ink-3 hover:text-pos-ink-2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panneau-${tab}`}
        aria-labelledby={`onglet-${tab}`}
        className="mt-6"
      >
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

Ce qui change :

- **Les onglets deviennent une liste `TABS`** au lieu d'une fonction `onglet(...)` répétée. Deux entrées aujourd'hui, mais la boucle rend la gestion des flèches possible — impossible à écrire proprement avec des appels dupliqués.
- **`tabIndex` mobile** et **flèches** avec bouclage par modulo.
- **`id` + `aria-controls` + `aria-labelledby` + `role="tabpanel"`** : le lien manquant entre onglet et contenu.
- **`aria-label="Reglages du salon"`** sur le conteneur : il n'en avait aucun.

**Les `className` sont identiques à l'original**, y compris les tokens `pos-*` de la caisse. Le rendu ne bouge pas.

`SalonForm` et `HoursForm` sont appelés exactement comme avant, avec les mêmes props.

- [ ] **Étape 2 : vérifier**

```bash
grep -c "aria-controls\|aria-labelledby\|tabpanel" src/components/pos/settings/settings-tabs.tsx
grep -c "tabIndex\|ArrowLeft\|ArrowRight" src/components/pos/settings/settings-tabs.tsx
grep -c "SalonForm\|HoursForm" src/components/pos/settings/settings-tabs.tsx
grep -c "pos-border\|pos-ink" src/components/pos/settings/settings-tabs.tsx
npx tsc --noEmit 2>&1 | grep -E "settings-tabs"
```

Attendu : liens onglet-panneau **≥ 3**, clavier **≥ 3**, les deux formulaires **≥ 4** (import + usage), les tokens de style **≥ 3** (**l'apparence est préservée**), aucune sortie de `tsc`.

- [ ] **Étape 3 : commit**

```bash
git add src/components/pos/settings/settings-tabs.tsx
git commit -m "fix(a11y): settings-tabs, clavier et liens onglet-panneau"
```

---

## Tâche 4 : vérification finale

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : le balisage est correct partout**

```bash
grep -rn 'role="tablist"' src/ --include=*.tsx
```

Attendu : **exactement deux** — `offer-client.tsx` et `settings-tabs.tsx`. `role-tabs.tsx` ne doit plus apparaître : il est devenu un groupe de boutons.

```bash
grep -n 'role="group"' src/components/ui/role-tabs.tsx
```

Attendu : une ligne.

- [ ] **Étape 2 : les deux vrais sélecteurs ont le clavier**

```bash
grep -c "ArrowLeft" "src/app/offre/[id]/offer-client.tsx" src/components/pos/settings/settings-tabs.tsx
grep -c "tabIndex" "src/app/offre/[id]/offer-client.tsx" src/components/pos/settings/settings-tabs.tsx
```

Attendu : chaque fichier ≥ 1 pour les flèches, ≥ 2 pour `tabIndex`.

- [ ] **Étape 3 : l'apparence n'a pas bougé**

C'est le contrôle qui distingue ce chantier d'une refonte : **aucune classe ne doit avoir changé.**

```bash
git diff main..HEAD -- src/ | grep -E "^[+-].*className" | grep -vE "^[+-].*(role=|aria-|tabIndex)" | head -20
```

Attendu : les lignes affichées doivent aller **par paires identiques** (une `-`, une `+` au contenu de `className` équivalent). Toute classe qui apparaît d'un seul côté signale un changement visuel non voulu.

- [ ] **Étape 4 : la logique protégée est intacte**

```bash
grep -c "signIn" "src/app/(auth)/login/login-client.tsx"
grep -c "autoVerify\|updateSession\|createBooking" "src/app/offre/[id]/offer-client.tsx"
grep -c "tracking_ref\|trackingToken" "src/app/offre/[id]/offer-client.tsx"
grep -c "SalonForm\|HoursForm" src/components/pos/settings/settings-tabs.tsx
```

Attendu : tous ≥ 1. Si l'un vaut 0, une protection a sauté.

- [ ] **Étape 5 : types, lint, tests, build**

```bash
npx tsc --noEmit 2>&1 | grep -E "role-tabs|offer-client|settings-tabs"
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -2
npm test 2>&1 | grep -E "Test Files|Tests "
npm run build 2>&1 | grep -E "Compiled successfully|Failed to compile"
```

Attendu : **aucune sortie du premier grep** ; le second doit afficher **23** — le nombre exact d'erreurs préexistantes. S'il dépasse, ce chantier a introduit une régression. ESLint à **52 problèmes** ; **180 tests au vert** ; `✓ Compiled successfully`.

Si le prérendu échoue ensuite sur `PrismaClientKnownRequestError` / `ECONNREFUSED`, c'est que la base n'est pas démarrée — ce n'est pas un défaut du code.

- [ ] **Étape 6 : pousser**

```bash
git status --short   # doit etre vide
git push -u origin fix-aria-tablist
```

`gh` n'est pas installé : la PR s'ouvre depuis l'URL affichée après le push.

---

## Contrôle clavier — pour l'utilisatrice

**C'est le vrai test de ce chantier.** Aucun outil automatique n'est installé pour juger l'accessibilité, et rien ne se voit à la souris.

Sur chaque écran, navigue **uniquement au clavier** :

1. **Page de connexion** — `Tab` jusqu'aux boutons « Cliente / Salon / Influenceuse ». Chacun doit être atteignable par `Tab` (c'est un groupe de boutons, pas des onglets), et `Entrée` ou `Espace` le sélectionne. L'accroche sous le titre change.
2. **Fiche offre, formulaire de réservation** — ouvre « Réserver maintenant », déconnectée. `Tab` jusqu'aux onglets « Nouveau client / J'ai déjà un compte » : **un seul `Tab` doit entrer dans le groupe**, puis les **flèches gauche/droite** basculent d'un onglet à l'autre. Les champs affichés changent immédiatement.
3. **Réglages de la caisse** (`/pos/settings`) — même chose entre « Salon » et « Horaires » : un `Tab` pour entrer, les flèches pour circuler, le formulaire change.
4. **L'apparence** — compare avec ce que tu connais : **rien ne doit avoir bougé**. Ni couleur, ni taille, ni position.

---

## Deux defauts du plan, trouves par la revue finale

Le plan decrivait un pattern qui, tel qu'ecrit, **ne fonctionnait pas**.

### 1. Le focus ne suivait pas la selection

Le plan annoncait « le focus suit la selection » et se contentait d'appeler
`setTab` / `setAuthMode`. **Changer l'etat React ne deplace pas le focus du
DOM.** Apres le rendu, le bouton qui avait le focus passait a `tabIndex={-1}` :
la navigation se desynchronisait des la deuxieme fleche.

Correction : un `.focus()` explicite sur l'onglet cible, dans les deux
selecteurs. Dans `settings-tabs` via un `useRef` indexe par identifiant ; dans
`offer-client` en visant le bouton voisin par `querySelectorAll('[role="tab"]')`,
pour ne pas ajouter deux refs a un fichier de 570 lignes.

**La lecon :** un pattern ARIA ne se resume pas a ses attributs. `tabIndex`
mobile sans `.focus()` est un demi-pattern, et un demi-pattern clavier ne
fonctionne pas.

### 2. `aria-controls` pointait dans le vide

Les deux onglets de `settings-tabs` referencaient `panneau-salon` et
`panneau-horaires`, mais **un seul panneau etait monte a la fois** — l'onglet
inactif pointait donc vers un `id` absent du DOM.

Correction : les deux panneaux sont rendus en permanence, l'inactif masque par
`hidden`. C'est le pattern APG standard, et il apporte un benefice non prevu —
les formulaires ne sont plus demontes a chaque bascule, donc **une saisie en
cours survit au changement d'onglet**.

### Ce que la revue a valide

`role="group"` + `aria-pressed` sur `role-tabs` est le bon choix : trois options
mutuellement exclusives qui ne pilotent aucun panneau. `radiogroup` aurait
impose une navigation par fleches dont ce selecteur n'a pas besoin.

## Ce que ce plan ne fait pas

- Il ne change **aucune apparence** : pas une couleur, pas une taille, pas un espacement.
- Il ne touche ni `signIn("credentials")`, ni la redirection par rôle, ni le parcours d'inscription intégré de la fiche offre.
- Il ne modifie ni `SalonForm`, ni `HoursForm`, ni aucun formulaire.
- Il n'ajoute pas de panneau à `role-tabs.tsx` pour justifier son ancien balisage : ce serait inventer une fonctionnalité pour satisfaire une étiquette.
- Il n'installe aucun outil d'audit d'accessibilité — ce serait un chantier séparé.
