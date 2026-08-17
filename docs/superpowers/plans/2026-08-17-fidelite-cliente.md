# Refonte visuelle des pages de fidélité — plan d'implémentation

> **Pour les agents :** SOUS-SKILL REQUISE — utilise superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** aligner les deux pages de fidélité de l'espace cliente sur le design system, et brancher la pagination de l'historique qui existe côté serveur mais n'est pas utilisée.

**Architecture :** deux fichiers, 214 lignes, aucun composant créé. Le travail est visuel, plus trois corrections décidées : la pagination branchée, le tutoiement, et deux couleurs hors palette remplacées.

**Stack :** Next.js 16.2 (App Router), React 19, Tailwind v4.

---

## Contexte pour qui n'a jamais vu ce dépôt

### Où on en est

Une refonte visuelle a couvert le parcours public, puis la sidebar du tableau de bord, « Mes réservations » et « Mon profil ». **Les deux pages de fidélité sont restées à l'ancienne charte** — elles sont pourtant accessibles depuis la même sidebar, à un clic de « Mes réservations ».

### Le design system

Quatre couleurs : `rose` (#FF5C8A, **action principale**), `prune` (#3A1024, texte), `menthe` (#A8E6CF, disponibilités, **économies et gains**, confirmations), `creme` (#FFF6F1, fond). Plus `rose-soft`, `prune-soft`, `menthe-deep`, `hairline`. Trois règles absolues :

1. **Aucune ombre, aucun dégradé, aucun flou.**
2. **Une seule action rose pleine par vue.**
3. **Cibles tactiles ≥ 44px**, corps de texte ≥ 16px.

Trois classes utilitaires dans `src/app/globals.css` : `.ds-press` (transition + `scale(0.97)` + gère `:disabled`), `.ds-focus` (anneau rose au focus clavier), `.ds-display` (police de titre).

**Les tokens `brand-*` et `pos-*` ne doivent JAMAIS être supprimés de `globals.css`**, ni les classes `.luxury-*` : 142 fichiers en dépendent, dont la caisse en production. On cesse de les *utiliser* ici ; on ne les efface pas.

### Les primitifs disponibles

```tsx
<Button variant="primary" | "secondary" | "ghost" fullWidth={false} />  // min-h-48px, pill, rose par défaut
<Badge tone="menthe" | "rose" | "prune">…</Badge>                        // pill, majuscules
<Input label="…" id="…" />                                              // min-h-52px, label et id OBLIGATOIRES
<Card className="…">…</Card>                                            // radius-card, blanc, SANS bordure
```

### Contraintes générales

- **Aucun test de composant n'est possible.** Vitest tourne en `environment: "node"` sans jsdom. N'en écris pas. La vérification passe par `grep`, `tsc`, ESLint, le build et le contrôle visuel.
- **180 tests doivent rester au vert.**
- **`tsc` n'est pas propre au départ :** 23 erreurs préexistent sur `main`, ailleurs dans le projet. Filtre toujours sur nos fichiers.
- **ESLint : 52 problèmes sur `main`.** Ce nombre ne doit pas augmenter.
- Interface en français, **tutoiement**, casse de phrase.

### Ce qu'il ne faut toucher sous aucun prétexte

| Élément | Pourquoi |
|---|---|
| `dinarPerPoint`, `pointsPerDinar`, `Math.round(balance * dpp * 1000)` | **Calculs de points** — une erreur fausserait des soldes réels |
| `formatDT`, `fromMillimes` de `@/lib/money` | Formatage monétaire, 2 occurrences par fichier |
| Les **clés** de `REASON_LABELS` (`EARN_PURCHASE`, `REDEEM_PURCHASE`, `WELCOME_BONUS`, `BIRTHDAY_BONUS`, `MANUAL_ADJUSTMENT`, `EXPIRATION`, `REFUND_REVERSAL`) | **Valeurs de base de données.** Seules leurs valeurs affichées peuvent bouger. |
| Les appels `/api/cliente/fidelite` et `/api/cliente/fidelite/[walletId]` | Les données |
| `minPointsToRedeem`, `maxRedemptionPctPerSale`, `inactivityExpireMonths` | Règles du programme affichées |
| `use(params)` | Convention Next 16 pour les paramètres de route |

### La leçon des lots précédents

Sur trois lots, le découpage par bornes de sections a laissé à chaque fois une portion non couverte, restée en `brand-*` jusqu'au contrôle final.

**Vérifié avant d'écrire ce plan :** les occurrences de la liste vont de la ligne 29 à 70, celles du détail de 61 à 128 — **toutes tombent dans les bornes des tâches ci-dessous.** Aucun interstice possible.

Le contrôle reste néanmoins exigé à la fin de chaque tâche :

```bash
grep -c "brand-" <fichier>   # doit finir à 0
grep -c "luxury-" <fichier>  # doit finir à 0
```

---

## Structure des fichiers

| Fichier | Lignes | `brand-*` | `luxury-*` | Tâche |
|---|---|---|---|---|
| `src/app/(dashboard)/cliente/fidelite/page.tsx` | 80 | 13 | 3 | 1 |
| `src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx` | 134 | 15 | 4 | 2 et 3 |

Le détail est coupé en deux : la page (tâche 2), puis l'historique avec sa pagination (tâche 3) — c'est la partie qui change du comportement, elle mérite son propre diff.

---

## Tâche 0 : vérifier le point de départ

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : confirmer la branche**

```bash
git branch --show-current
git status --short
```

Attendu : `design-fidelite`, arbre propre. La branche part de `main` (f0516d6) et la spec y est déjà commitée.

- [ ] **Étape 2 : établir la ligne de base**

```bash
npm test 2>&1 | grep -E "Test Files|Tests "
npm run lint 2>&1 | tail -2
```

Attendu : **180 tests au vert** (13 fichiers), et `✖ 52 problems (40 errors, 12 warnings)`.

- [ ] **Étape 3 : noter les compteurs de départ**

```bash
grep -c "brand-" "src/app/(dashboard)/cliente/fidelite/page.tsx"
grep -c "luxury-" "src/app/(dashboard)/cliente/fidelite/page.tsx"
grep -c "brand-" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
grep -c "luxury-" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
```

Attendu : `13`, `3`, `15`, `4`. Tous doivent valoir **0** à la fin.

- [ ] **Étape 4 : confirmer que l'API pagine déjà**

```bash
grep -c 'searchParams.get("page")\|searchParams.get("pageSize")' "src/app/api/cliente/fidelite/[walletId]/route.ts"
grep -n "total," "src/app/api/cliente/fidelite/[walletId]/route.ts"
```

Attendu : **2** pour le premier, et une ligne `total,` dans la réponse. **Rien ne sera à changer côté serveur** — tout existe.

---

## Tâche 1 : la liste des cartes

**Fichiers :**
- Modifier : `src/app/(dashboard)/cliente/fidelite/page.tsx:28-79`

- [ ] **Étape 1 : l'état de chargement**

Ligne 29, remplace :

```tsx
    return <p className="p-6 text-sm text-brand-ink-soft">Chargement…</p>;
```

par :

```tsx
    return <p className="p-6 text-base text-prune-soft">Chargement…</p>;
```

- [ ] **Étape 2 : remplacer le rendu**

Remplace le bloc `return (` … `);` final (lignes 32 à 79) par :

```tsx
  return (
    <div className="mx-auto max-w-5xl p-6">
      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Fidélité</p>
      <h1 className="ds-display mb-6 text-3xl text-prune">Mes cartes de fidélité</h1>

      {wallets.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-10 text-center">
          <p className="mb-2 text-base text-prune">Tu n&apos;as encore aucune carte de fidélité.</p>
          <p className="text-sm text-prune-soft">
            Passe dans un salon partenaire pour commencer à gagner des points.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wallets.map((w) => {
            const dpp = Number(w.dinarPerPoint);
            const valueM = Math.round(w.balance * dpp * 1000);
            return (
              <Link
                key={w.id}
                href={`/cliente/fidelite/${w.id}`}
                className="ds-press ds-focus rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5 hover:border-rose"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-soft text-lg font-bold text-prune">
                    {w.provider.salonName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-prune">{w.provider.salonName}</p>
                    {w.provider.city && (
                      <p className="text-sm text-prune-soft">{w.provider.city}</p>
                    )}
                  </div>
                </div>
                <div className="rounded-[var(--radius-panel)] bg-menthe p-4 text-center">
                  <p className="ds-display text-3xl text-menthe-deep">{w.balance} pts</p>
                  <p className="mt-1 text-sm text-menthe-deep">≈ {formatDT(fromMillimes(valueM))}</p>
                </div>
                <p className="mt-4 text-sm text-prune-soft">
                  Dernière activité : {new Date(w.lastActivityAt).toLocaleDateString("fr-FR")}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
```

Ce qui change, et pourquoi :

- **Le solde passe au menthe.** Le design system réserve cette couleur aux disponibilités, aux **économies** et aux confirmations — des points de fidélité sont un gain. Le texte est en `menthe-deep`, le menthe pur n'ayant pas assez de contraste.
- **Le tutoiement** : « Vous n'avez encore aucune carte » devient « Tu n'as encore aucune carte », « Visitez un salon partenaire » devient « Passe dans un salon partenaire ».
- La carte gagne `.ds-press` et `.ds-focus` : c'est un `<Link>` cliquable, il lui faut un retour au clic et un anneau de focus.
- `min-w-0` et `truncate` sur le nom du salon : un nom long débordait de la carte.
- Les corps passent de `text-xs`/`text-sm` à `text-sm`/`text-base`.

**`dinarPerPoint`, le calcul `Math.round(w.balance * dpp * 1000)`, `formatDT` et `fromMillimes` sont repris à l'identique.** Ce sont des calculs de points : une erreur fausserait des soldes réels.

- [ ] **Étape 3 : vérifier**

```bash
grep -c "brand-" "src/app/(dashboard)/cliente/fidelite/page.tsx"
grep -c "luxury-" "src/app/(dashboard)/cliente/fidelite/page.tsx"
grep -c "formatDT\|fromMillimes" "src/app/(dashboard)/cliente/fidelite/page.tsx"
grep -c "dinarPerPoint" "src/app/(dashboard)/cliente/fidelite/page.tsx"
grep -c "Vous\|Visitez" "src/app/(dashboard)/cliente/fidelite/page.tsx"
npx tsc --noEmit 2>&1 | grep -E "fidelite/page"
```

Attendu : `brand-` et `luxury-` à **0** ; les fonctions monétaires **≥ 2** ; `dinarPerPoint` ≥ 2 ; **0** vouvoiement ; aucune sortie de `tsc`.

Rappel : `npx tsc --noEmit` sans filtre affiche 23 erreurs préexistantes ailleurs — ignore-les, ne les corrige sous aucun prétexte.

- [ ] **Étape 4 : commit**

```bash
git add "src/app/(dashboard)/cliente/fidelite/page.tsx"
git commit -m "feat(design): liste des cartes de fidelite au design system"
```

---

## Tâche 2 : le détail d'une carte

**Fichiers :**
- Modifier : `src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx:61-104`

L'historique et sa pagination sont traités en tâche 3.

- [ ] **Étape 1 : l'état de chargement**

Ligne 61, remplace :

```tsx
  if (!data) return <p className="p-6 text-sm text-brand-ink-soft">Chargement…</p>;
```

par :

```tsx
  if (!data) return <p className="p-6 text-base text-prune-soft">Chargement…</p>;
```

- [ ] **Étape 2 : l'en-tête, le solde et les règles**

Remplace les lignes 67 à 104 (de `  return (` jusqu'à la ligne `<p className="luxury-badge mb-3">Historique</p>` **incluse**) par :

```tsx
  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link
        href="/cliente/fidelite"
        className="ds-press ds-focus mb-4 inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] text-base font-semibold text-prune-soft hover:text-rose"
      >
        ← Mes cartes
      </Link>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-soft text-2xl font-bold text-prune">
          {data.provider.salonName.charAt(0)}
        </div>
        <div className="min-w-0">
          <h1 className="ds-display truncate text-2xl text-prune">{data.provider.salonName}</h1>
          {data.provider.city && (
            <p className="text-base text-prune-soft">{data.provider.city}</p>
          )}
        </div>
      </div>

      {/* Le solde en menthe : le design system reserve cette couleur aux
          economies et aux gains. Le rose est la couleur d'ACTION — un grand
          bloc rose non cliquable induirait en erreur. */}
      <div className="mb-6 rounded-[var(--radius-card)] bg-menthe p-8 text-center">
        <p className="ds-display text-5xl text-menthe-deep">{data.balance} pts</p>
        <p className="mt-2 text-base text-menthe-deep">≈ {formatDT(fromMillimes(valueM))}</p>
      </div>

      <div className="mb-6 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Règles du programme</p>
        <p className="text-base text-prune">1 TND dépensé = {ppd.toFixed(0)} pts • {Math.round(1 / dpp)} pts = 1 TND</p>
        <p className="text-base text-prune">Min échange : {data.program.minPointsToRedeem} pts • Max {data.program.maxRedemptionPctPerSale}% par achat</p>
        {data.program.inactivityExpireMonths && (
          <p className="mt-2 text-sm text-prune-soft">
            Tes points expirent après {data.program.inactivityExpireMonths} mois d&apos;inactivité.
          </p>
        )}
      </div>

      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Historique</p>
```

Points d'attention :

- Le lien « ← Mes cartes » gagne une **cible de 44px** — il n'en avait aucune.
- **`ppd`, `dpp`, `minPointsToRedeem`, `maxRedemptionPctPerSale`, `inactivityExpireMonths` sont repris à l'identique**, y compris `Math.round(1 / dpp)`. Ce sont les règles du programme.
- « Vos points expirent » devient « Tes points expirent ».
- `min-w-0` + `truncate` sur le nom du salon.

- [ ] **Étape 3 : vérifier**

```bash
grep -n "brand-\|luxury-" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
grep -c "minPointsToRedeem\|maxRedemptionPctPerSale\|inactivityExpireMonths" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
grep -c "formatDT\|fromMillimes" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
grep -c "Vos points" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
npx tsc --noEmit 2>&1 | grep -E "walletId"
```

Attendu : les seules lignes `brand-`/`luxury-` restantes doivent être **dans l'historique** (lignes ~107-130, traité en tâche 3) ; les règles du programme **≥ 4** ; les fonctions monétaires ≥ 2 ; **0** « Vos points » ; aucune sortie de `tsc`.

- [ ] **Étape 4 : commit**

```bash
git add "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
git commit -m "feat(design): detail d'une carte de fidelite au design system"
```

---

## Tâche 3 : l'historique et sa pagination

**C'est la seule tâche qui change du comportement, pas seulement du style.**

**Fichiers :**
- Modifier : `src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx` — les états, la fonction de chargement, et le bloc `<ul>` de l'historique

### Le défaut à corriger

L'API pagine déjà par tranches de 20 : elle accepte `page` et `pageSize`, et renvoie `total`. La page **déclare ces champs dans son type et ne les utilise jamais**.

Conséquence : au-delà de 20 transactions, une cliente fidèle ne voit jamais son historique ancien — **et rien ne le lui signale**.

- [ ] **Étape 1 : les états et le chargement**

Remplace le bloc des états et du `useEffect` (lignes 52 à 59) par :

```tsx
  const { walletId } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  // L'historique s'accumule : chaque « Voir plus » AJOUTE une page a la liste
  // au lieu de la remplacer. `data.transactions.items` ne sert donc que pour
  // la premiere page.
  const [items, setItems] = useState<Detail["transactions"]["items"]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetch(`/api/cliente/fidelite/${walletId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Detail | null) => {
        setData(d);
        setItems(d?.transactions.items ?? []);
        setPage(1);
      });
  }, [walletId]);

  async function chargerPlus() {
    if (!data) return;
    setLoadingMore(true);
    const suivante = page + 1;
    const res = await fetch(`/api/cliente/fidelite/${walletId}?page=${suivante}`);
    if (res.ok) {
      const d: Detail = await res.json();
      setItems((prev) => [...prev, ...d.transactions.items]);
      setPage(suivante);
    }
    setLoadingMore(false);
  }
```

**Ne touche pas au `use(params)`** — c'est la convention Next 16 pour les paramètres de route.

- [ ] **Étape 2 : l'historique et le bouton**

Remplace le bloc `<ul>` … `</ul>` (lignes ~105 à 131, jusqu'aux balises fermantes finales `</div>` et `);`) par :

```tsx
      <ul className="space-y-2">
        {items.length === 0 && (
          <p className="text-base text-prune-soft">Aucune transaction.</p>
        )}
        {items.map((t) => (
          <li key={t.id} className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-4">
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">
                {REASON_LABELS[t.reason] ?? t.reason}
              </span>
              {/* Gain en menthe-deep, retrait en prune : un echange de points
                  n'est PAS une erreur. Le rose, seule couleur d'alerte du
                  systeme, serait un contresens. */}
              <span
                className={
                  t.delta < 0 ? "font-semibold text-prune" : "font-semibold text-menthe-deep"
                }
              >
                {t.delta > 0 ? "+" : ""}
                {t.delta} pts
              </span>
            </div>
            <p className="text-sm text-prune-soft">
              {new Date(t.createdAt).toLocaleString("fr-FR")} · solde après : {t.balanceAfter} pts
              {t.sale && ` · Reçu ${t.sale.receiptNumber}`}
            </p>
            {t.note && <p className="mt-1 text-sm text-prune">« {t.note} »</p>}
          </li>
        ))}
      </ul>

      {/* Le bouton ne s'affiche que s'il reste des transactions a charger.
          Sur un jeu de donnees de test (moins de 20 transactions), il sera
          absent — c'est le comportement correct, pas une panne. */}
      {items.length < data.transactions.total && (
        <div className="mt-4 text-center">
          <Button variant="ghost" onClick={chargerPlus} disabled={loadingMore}>
            {loadingMore ? "Chargement…" : "Voir plus"}
          </Button>
          <p className="mt-2 text-sm text-prune-soft">
            {items.length} sur {data.transactions.total} transactions
          </p>
        </div>
      )}
    </div>
  );
}
```

Trois points :

- **Le bouton est en variante fantôme**, pas rose : il n'y a aucune action primaire sur cette page, et un bouton rose plein pour « Voir plus » donnerait une importance qu'il n'a pas.
- **Le compteur « N sur M »** dit à la cliente combien il reste — c'est ce qui manquait le plus.
- Les mouvements quittent `emerald-700` et `amber-700`, tous deux hors palette.

- [ ] **Étape 3 : importer `Button`**

En haut du fichier, après la ligne 5, ajoute :

```tsx
import { Button } from "@/components/ui/button";
```

- [ ] **Étape 4 : la chasse aux interstices**

```bash
grep -n "brand-" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
grep -n "luxury-" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
```

**Attendu : aucune sortie.** Si une ligne apparaît, c'est du code entre deux bornes de tâches qu'aucune n'a couvert — c'est arrivé sur trois lots précédents. Corrige-le avec les mêmes conventions : `luxury-heading` → `ds-display text-prune`, `luxury-badge` → `text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft`, `text-brand-ink` → `text-prune`, `text-brand-ink-soft` → `text-prune-soft`, `border-brand-line` → `border-2 border-hairline`.

- [ ] **Étape 5 : vérifier la pagination et les protections**

```bash
grep -c "chargerPlus\|setItems\|setPage" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
grep -c "transactions.total" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
grep -c "EARN_PURCHASE\|REDEEM_PURCHASE\|WELCOME_BONUS" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
grep -c "use(params)" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
grep -n -E "amber-|emerald-|gray-" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
npx tsc --noEmit 2>&1 | grep -E "walletId"
npm test 2>&1 | grep -E "Tests "
```

Attendu : la pagination **≥ 5** ; `transactions.total` ≥ 1 ; les **clés** de `REASON_LABELS` ≥ 3 (**intactes, non accentuées**) ; `use(params)` ≥ 1 ; aucune couleur hors palette ; aucune sortie de `tsc` ; **180 tests au vert**.

- [ ] **Étape 6 : commit**

```bash
git add "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
git commit -m "feat(design): historique de fidelite au design system et pagination branchee"
```

---

## Tâche 4 : vérification finale

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : tous les compteurs à zéro**

```bash
for f in "src/app/(dashboard)/cliente/fidelite/page.tsx" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"; do
  echo "$f : brand=$(grep -c 'brand-' "$f") luxury=$(grep -c 'luxury-' "$f") interdits=$(grep -c -E 'shadow|gradient|blur' "$f") horsPalette=$(grep -c -E 'amber-|blue-|emerald-|red-|gray-|green-|yellow-' "$f")"
done
```

Attendu : **0 partout**, sur les quatre colonnes.

- [ ] **Étape 2 : les calculs de points sont intacts**

```bash
grep -c "dinarPerPoint\|pointsPerDinar" "src/app/(dashboard)/cliente/fidelite/page.tsx" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
grep -c "formatDT\|fromMillimes" "src/app/(dashboard)/cliente/fidelite/page.tsx" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
grep -c "Math.round" "src/app/(dashboard)/cliente/fidelite/page.tsx" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
```

Attendu : tous ≥ 1 dans chaque fichier. Si l'un vaut 0, un calcul de points a disparu — **c'est le risque le plus grave de ce lot**, il fausserait des soldes réels.

- [ ] **Étape 3 : plus aucun vouvoiement**

```bash
grep -n "Vous \|Vos \|Visitez\|Votre " "src/app/(dashboard)/cliente/fidelite/page.tsx" "src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx"
```

Attendu : **aucune sortie**.

- [ ] **Étape 4 : types, lint, tests, build**

```bash
npx tsc --noEmit 2>&1 | grep -E "fidelite"
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -2
npm test 2>&1 | grep -E "Test Files|Tests "
npm run build 2>&1 | grep -E "Compiled successfully|Failed to compile"
```

Attendu : **aucune sortie du premier grep** ; le second doit afficher **23** — le nombre exact d'erreurs préexistantes. S'il dépasse, ce lot a introduit une régression. ESLint à **52 problèmes** ; **180 tests au vert** ; `✓ Compiled successfully`.

Si le prérendu échoue ensuite sur `PrismaClientKnownRequestError` / `ECONNREFUSED`, c'est que la base n'est pas démarrée — ce n'est pas un défaut du code.

- [ ] **Étape 5 : pousser**

```bash
git status --short   # doit etre vide
git push -u origin design-fidelite
```

`gh` n'est pas installé : la PR s'ouvre depuis l'URL affichée après le push.

---

## Contrôle visuel — pour l'utilisatrice

1. **La liste des cartes** — le solde de chaque carte est maintenant dans un bloc menthe. Les cartes réagissent au clic.
2. **Le détail d'une carte** — le grand solde en menthe, les règles du programme dans une carte bordée.
3. **L'historique** — les gains en vert foncé, les retraits en prune. Plus d'ambre ni d'émeraude.
4. **La pagination** — **elle ne se verra probablement pas.** Le bouton « Voir plus » n'apparaît que si une carte a plus de 20 transactions. Sur des données de test, c'est normal qu'il soit absent : c'est le comportement correct, pas une panne.
5. **Le tutoiement** — « Tu n'as encore aucune carte », « Tes points expirent après N mois ».

---

## Réserve honnête

**La pagination est la seule partie de ce lot qu'on ne pourra pas voir fonctionner.** Le code sera correct, mais son effet restera invisible tant qu'aucune carte n'aura dépassé 20 transactions.

C'est l'inverse du reste du lot, dont le résultat se voit immédiatement. Pour la tester vraiment, il faudrait un jeu de données avec un historique fourni.

---

## Ce que ce plan ne fait pas

- Les pages `paiement` (355 lignes) et `reservation` (189) de l'espace cliente — un lot suivant.
- Il ne modifie **rien côté serveur** : l'API paginait déjà, elle n'a pas besoin d'être touchée.
- Il ne modifie aucun calcul de points, aucune règle de programme.
- Il n'accentue ni ne renomme les **clés** de `REASON_LABELS` — ce sont des valeurs de base de données.
- Il ne supprime aucun token `brand-*` ni `pos-*` de `globals.css`, ni aucune classe `.luxury-*`.
