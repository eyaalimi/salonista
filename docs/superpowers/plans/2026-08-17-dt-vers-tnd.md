# « DT » vers « TND » — plan d'implémentation

> **Pour les agents :** SOUS-SKILL REQUISE — utilise superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** une seule notation monétaire — TND — sur tout le site : public, tableaux de bord, caisse, tickets imprimés, e-mails.

**Architecture :** une ligne dans `formatDT()` traite 132 usages d'un coup, tickets thermiques compris. Restent 57 occurrences d'affichage en dur, plus 4 assertions de test à mettre à jour. Aucun montant, aucun calcul, aucun format numérique ne bouge — seul le suffixe change.

**Stack :** Next.js 16.2, React 19, Vitest, Prisma 7.

---

## Contexte pour qui n'a jamais vu ce dépôt

**Le problème.** Une refonte visuelle a fait passer les pages publiques à « TND ». Le reste du site dit encore « DT ». Une cliente voit donc « 45 TND » sur la fiche offre, puis reçoit un e-mail de confirmation qui affiche « 45 DT ».

Le cas le plus visible est indexé : la méta-description de chaque fiche offre (`src/app/offre/[id]/page.tsx:32`) contient « DT », donc **les résultats Google affichent une notation différente de la page qu'ils annoncent**.

**La monnaie ne change pas.** « DT » et « TND » désignent tous deux le dinar tunisien. C'est une question de notation, pas de conversion : aucun montant, aucun taux, aucune donnée en base n'est concerné.

### La structure du chantier — lis ceci avant tout

Le dépôt contient 253 occurrences de « DT » dans 57 fichiers. Ce nombre est trompeur :

| Catégorie | Nombre | Traitement |
|---|---|---|
| Appels à `formatDT()` | 132 | **une seule ligne** à changer |
| Affichage en dur | **57** | à corriger un par un |
| Assertions de test | 4 | à mettre à jour |
| Commentaires et libellés de test | ~27 | **à ne pas toucher** |
| Identifiants, chaînes encodées | reste | **à ne jamais toucher** |

**Le décompte a été corrigé en cours de préparation.** La spec annonçait 85 occurrences en dur ; en excluant les commentaires (`// 100 DT × 3 pts/DT`) et les libellés de test, il en reste **57** réellement affichées (le motif en remonte 58, dont un commentaire en fin de ligne dans `pos-sale-create.ts`). Les commentaires n'apparaissent nulle part à l'écran : les changer gonflerait le diff sans bénéfice.

### La contrainte critique : jamais de remplacement global

Un `sed` sur « DT » casserait quatre choses :

| Motif | Rôle | Conséquence |
|---|---|---|
| `formatDT` (132×) | nom de fonction | code cassé |
| `MILLIMES_PER_DT` | constante de `money.ts` | code cassé |
| `CDTBQAAtQoAINQFAAC…` | chaîne encodée dans `booking-detail-drawer.tsx` et `src/generated/` | **donnée corrompue** |
| `DDTHH` | format de date ISO | horodatages faussés |

**Le motif sûr**, vérifié : `[0-9)}\`"'] DT` — un « DT » précédé d'un chiffre, d'une accolade fermante, d'un backtick ou d'un guillemet. Il isole l'affichage et ne touche **aucune** occurrence dans `src/generated/`.

### Contraintes générales

- **Aucun test de composant n'est possible.** Vitest tourne en `environment: "node"` sans jsdom. La vérification passe par `grep`, les tests existants, `tsc`, ESLint et le build.
- **180 tests doivent rester au vert** — avec les 4 assertions de `money.test.ts` mises à jour. Sans cette mise à jour, la suite échoue : c'est attendu, pas un accident.
- **`tsc` n'est pas propre au départ :** 23 erreurs préexistent sur `main`, dans `src/components/pos/onboarding/wizard-client.tsx` et `src/lib/rewards/rewards.test.ts`. Elles ne viennent pas de ce chantier. Filtre toujours.
- **ESLint : 52 problèmes sur `main`.** Ce nombre ne doit pas augmenter.
- **`src/generated/prisma/` ne doit jamais être édité** — le dossier est régénéré à chaque build, toute modification serait écrasée.
- Interface en français, tutoiement.

### Note sur les branches

`fix-contraste-rose` n'est pas encore mergée. **Aucun fichier n'est commun aux deux branches** — vérifié par comparaison des listes. Les deux peuvent être mergées dans n'importe quel ordre, sans conflit.

---

## Structure des fichiers

### La ligne qui traite 132 usages

`src/lib/money.ts:119` — la dernière ligne de `formatDT()`. Elle alimente :

- **La totalité des tickets thermiques** : `receipt-content.tsx` et `z-report-content.tsx` n'ont aucun « DT » en dur, tout passe par cette fonction.
- La caisse, les analyses, les rapports Z.

### Les 57 occurrences d'affichage en dur

Comptage verifie par zone, chaque nombre issu du meme filtre :

| Zone | Occurrences | Tache |
|---|---|---|
| Caisse + API + page de verification | **25** | 4 |
| Tableaux de bord (admin, cliente, influenceuse) | **27** | 3 |
| E-mails (`mail.ts`) + meta-description (`offre/[id]/page.tsx`) | **4** | 2 |
| `money.ts` — la ligne de `formatDT` | **1** | 1 |
| **Total** | **57** | |

Les deux lignes de documentation de `money.ts` (110-111) decrivent le format et
sont mises a jour avec la fonction, en tache 1.

### Ce qu'il ne faut PAS toucher

| Élément | Emplacement | Raison |
|---|---|---|
| `formatDT`, `MILLIMES_PER_DT` | partout | identifiants — ne pas renommer |
| Chaînes encodées | `booking-detail-drawer.tsx`, `src/generated/` | données binaires |
| `DDTHH` | formats de date | horodatages |
| Commentaires `// … DT` | `rewards.test.ts` (8), `offer-publish.test.ts`, `program.ts` (2), `pos-sale-create.ts`, `offer-publish.ts` | invisibles à l'écran |
| Libellé de test | `rewards.test.ts:179` | invisible pour l'utilisateur |
| `src/generated/prisma/` | tout le dossier | régénéré à chaque build |

---

## Tâche 0 : vérifier le point de départ

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : confirmer la branche**

```bash
git branch --show-current
git status --short
```

Attendu : `fix-dt-vers-tnd`, arbre propre. La branche part de `main` (f64fec8) et la spec y est déjà commitée.

- [ ] **Étape 2 : établir la ligne de base**

```bash
npm test 2>&1 | grep -E "Test Files|Tests "
npm run lint 2>&1 | tail -2
```

Attendu : **180 tests au vert** (13 fichiers), et `✖ 52 problems (40 errors, 12 warnings)`.

- [ ] **Étape 3 : compter ce qui doit disparaître**

```bash
grep -rn "[0-9)}\`\"'] DT\b" src/ --include=*.ts --include=*.tsx 2>/dev/null | grep -v "generated/" | grep -vE ":\s*//|:\s*\*|\* " | grep -v "\.test\.ts" | wc -l
```

Attendu : **58**. Mais **une seule de ces 58 est un faux positif** :
`src/lib/pos-sale-create.ts:84` est un commentaire en fin de ligne
(`const TOTAL_TOLERANCE_MILLIMES = 1; // 0.001 DT`) que le filtre ne rattrape
pas, le `//` n'etant pas en debut de ligne.

**Il y a donc 57 occurrences reellement affichees**, et le compteur doit
descendre a **1** — pas a 0. Ce commentaire ne se voit nulle part et ne doit pas
etre modifie.

Le filtrage exclut les commentaires en debut de ligne (`//`, `*`) et les
fichiers de test, qui ne s'affichent pas.

---

## Tâche 1 : la fonction `formatDT` et ses tests

C'est la tâche la plus rentable du chantier : une ligne pour 132 usages, tickets imprimés compris.

**Fichiers :**
- Modifier : `src/lib/money.ts:107-120`, `src/lib/money.test.ts:114-122`

- [ ] **Étape 1 : mettre à jour les tests EN PREMIER**

C'est l'ordre correct : le test décrit le comportement attendu, on le change avant l'implémentation.

Dans `src/lib/money.test.ts`, remplace le bloc `describe("formatDT", …)` (lignes 114-122 environ) — les quatre assertions passent de « DT » à « TND » :

```ts
describe("formatDT", () => {
  it("formats with a comma separator and the TND suffix", () => {
    expect(formatDT("12.500")).toBe("12,500 TND");
    expect(formatDT("0.000")).toBe("0,000 TND");
    expect(formatDT("1234.567")).toBe("1234,567 TND");
  });
  it("keeps the minus sign in front", () => {
    expect(formatDT("-5.000")).toBe("-5,000 TND");
  });
});
```

Adapte les libellés `it(...)` s'ils diffèrent — l'important est que les **quatre valeurs attendues** deviennent « TND ». Ne change ni le séparateur virgule, ni les trois décimales, ni la position du signe négatif : le test continue de les protéger.

- [ ] **Étape 2 : lancer les tests pour les voir échouer**

```bash
npm test 2>&1 | grep -E "Tests |FAIL"
```

Attendu : **4 tests en échec**, avec des messages du type `expected "12,500 DT" to be "12,500 TND"`. C'est le comportement recherché : les tests décrivent maintenant ce que le code doit faire.

- [ ] **Étape 3 : changer la fonction**

Dans `src/lib/money.ts`, remplace le bloc de documentation et la ligne 119 :

```ts
/**
 * Tunisian Dinar formatting for human display.
 *
 * "12,500 DT" (3 decimals, comma decimal separator, " DT" suffix).
 * Negative amounts show as "-1,500 DT".
 */
export function formatDT(amount: Money): string {
  const m = toMillimes(amount);
  const sign = m < 0 ? "-" : "";
  const abs = Math.abs(m);
  const whole = Math.floor(abs / MILLIMES_PER_DT);
  const frac = abs % MILLIMES_PER_DT;
  return `${sign}${whole},${String(frac).padStart(3, "0")} DT`;
}
```

par :

```ts
/**
 * Tunisian Dinar formatting for human display.
 *
 * "12,500 TND" (3 decimals, comma decimal separator, " TND" suffix).
 * Negative amounts show as "-1,500 TND".
 *
 * Le nom `formatDT` est conserve volontairement : le renommer toucherait
 * 132 sites d'appel pour un gain de lisibilite seul. "DT" et "TND"
 * designent la meme monnaie, le dinar tunisien.
 */
export function formatDT(amount: Money): string {
  const m = toMillimes(amount);
  const sign = m < 0 ? "-" : "";
  const abs = Math.abs(m);
  const whole = Math.floor(abs / MILLIMES_PER_DT);
  const frac = abs % MILLIMES_PER_DT;
  return `${sign}${whole},${String(frac).padStart(3, "0")} TND`;
}
```

**Ne renomme pas la fonction.** `MILLIMES_PER_DT` reste également inchangé — c'est une constante interne, invisible à l'écran.

- [ ] **Étape 4 : les tests repassent**

```bash
npm test 2>&1 | grep -E "Test Files|Tests "
```

Attendu : **180 tests au vert**.

- [ ] **Étape 5 : vérifier que les tickets sont couverts**

```bash
grep -c "formatDT" src/components/pos/thermal/receipt-content.tsx
grep -c "formatDT" src/components/pos/thermal/z-report-content.tsx
grep -n "[0-9)}\`\"'] DT\b" src/components/pos/thermal/*.tsx
```

Attendu : les deux premiers ≥ 5 (les tickets appellent bien la fonction) ; le troisième **aucune sortie** (aucun « DT » en dur dans les tickets). Ils affichent donc « TND » sans autre modification.

- [ ] **Étape 6 : commit**

```bash
git add src/lib/money.ts src/lib/money.test.ts
git commit -m "feat(money): formatDT affiche TND au lieu de DT"
```

---

## Tâche 2 : les e-mails et la méta-description SEO

Les deux endroits qui sortent du site : ce qu'on envoie aux clientes, et ce que Google indexe.

**Fichiers :**
- Modifier : `src/lib/mail.ts:155,193,324`, `src/app/offre/[id]/page.tsx:32`

- [ ] **Étape 1 : les gabarits d'e-mail**

Dans `src/lib/mail.ts`, trois occurrences affichent un montant suivi de « DT », aux lignes **155**, **193** et **324**. Remplace « DT » par « TND » dans chacune.

Repères :
- ligne 155 : une cellule `<td>` de tableau, prix d'une réservation
- ligne 193 : `Votre paiement de <strong …>${data.price} DT</strong> a été reçu.`
- ligne 324 : une cellule `<td>` équivalente à la 155

**Ne touche à rien d'autre dans ces gabarits** — ni au HTML, ni aux styles inline, ni aux entités (`&eacute;`, `&ccedil;`). Ce sont des e-mails : leur rendu dépend de clients de messagerie capricieux, et le HTML y est volontairement verbeux.

- [ ] **Étape 2 : la méta-description indexée par Google**

Dans `src/app/offre/[id]/page.tsx`, ligne 32, remplace les **deux** « DT » de la chaîne :

```ts
    description: `${offer.title} à ${Number(offer.discountPrice).toFixed(0)} DT au lieu de ${Number(offer.originalPrice).toFixed(0)} DT (-${discount}%) chez ${offer.provider.salonName}${offer.provider.city ? `, ${offer.provider.city}` : ""}. Réservez en ligne sur Salonista.`,
```

par :

```ts
    description: `${offer.title} à ${Number(offer.discountPrice).toFixed(0)} TND au lieu de ${Number(offer.originalPrice).toFixed(0)} TND (-${discount}%) chez ${offer.provider.salonName}${offer.provider.city ? `, ${offer.provider.city}` : ""}. Réservez en ligne sur Salonista.`,
```

C'est le texte affiché dans les résultats de recherche Google. Il disait « DT » alors que la page dit « TND ».

- [ ] **Étape 3 : vérifier**

```bash
grep -n "[0-9)}\`\"'] DT\b" src/lib/mail.ts "src/app/offre/[id]/page.tsx"
npx tsc --noEmit 2>&1 | grep -E "mail.ts|offre/\[id\]/page"
npm test 2>&1 | grep -E "Tests "
```

Attendu : aucune sortie des deux premiers, **180 tests au vert**. Rappel : `tsc` sans filtre affiche 23 erreurs préexistantes — ignore-les.

- [ ] **Étape 4 : commit**

```bash
git add src/lib/mail.ts "src/app/offre/[id]/page.tsx"
git commit -m "feat(money): TND dans les e-mails et la meta-description"
```

---

## Tâche 3 : les tableaux de bord

27 occurrences : admin, cliente, influenceuse.

**Fichiers :**
- Modifier : `src/app/(dashboard)/admin/commissions/page.tsx` (7), `admin/reservations/page.tsx` (4), `admin/offres/page.tsx` (2), `admin/page.tsx` (1), `influenceuse/gains/page.tsx` (3), `influenceuse/page.tsx` (2), `influenceuse/collaborations/page.tsx` (2), `cliente/paiement/page.tsx` (3), `cliente/reservation/page.tsx` (1), `cliente/page.tsx` (1), `cliente/fidelite/[walletId]/page.tsx` (1)

- [ ] **Étape 1 : localiser puis remplacer**

```bash
grep -rn "[0-9)}\`\"'] DT\b" "src/app/(dashboard)" --include=*.tsx
```

Cette commande liste les 27 emplacements avec leur ligne. Pour chacun, remplace « DT » par « TND ».

**Le motif à respecter :** ne remplace que les « DT » précédés d'un chiffre, d'une accolade fermante `}`, d'un backtick ou d'un guillemet — ce sont les montants affichés. Les commentaires et les noms de variables ne bougent pas.

- [ ] **Étape 2 : vérifier**

```bash
grep -rn "[0-9)}\`\"'] DT\b" "src/app/(dashboard)" --include=*.tsx
npx tsc --noEmit 2>&1 | grep -E "dashboard"
npm test 2>&1 | grep -E "Tests "
```

Attendu : aucune sortie des deux premiers, **180 tests au vert**.

- [ ] **Étape 3 : commit**

```bash
git add "src/app/(dashboard)"
git commit -m "feat(money): TND dans les tableaux de bord"
```

---

## Tâche 4 : la caisse

22 occurrences dans 10 fichiers, plus 3 hors caisse. C'est la partie utilisée en production par des salons.

**Fichiers :**
- Modifier : `src/components/pos/cash-drawer-indicator.tsx` (5), `analytics-client.tsx` (4), `services-list-client.tsx` (2), `products-list-client.tsx` (2), `pos-shell-client.tsx` (2), `onboarding/step4-loyalty.tsx` (2), `cash-drawer-detail-client.tsx` (2), `reception-modal.tsx` (1), `loyalty-client.tsx` (1), `commissions-client.tsx` (1), `cash-drawer-list-client.tsx` (1), `src/app/api/pos/drawer/expenses/route.ts` (1), `src/app/verification/page.tsx` (1)

- [ ] **Étape 1 : localiser puis remplacer**

```bash
grep -rn "[0-9)}\`\"'] DT\b" src/components/pos src/app/api src/app/verification --include=*.tsx --include=*.ts
```

Remplace « DT » par « TND » à chacun de ces emplacements.

**Attention particulière sur `booking-detail-drawer.tsx` :** ce fichier contient une chaîne encodée du type `CDTBQAAtQoAINQFAAC…`. Le motif ne la capture pas (pas d'espace avant « DT »), mais ne t'en approche pas. Si un doute survient, vérifie que la ligne modifiée affiche bien un montant.

- [ ] **Étape 2 : vérifier que la chaîne encodée est intacte**

```bash
grep -c "CDTBQAAtQoAINQFAAC" src/components/pos/booking-detail-drawer.tsx
grep -rn "[0-9)}\`\"'] DT\b" src/components/pos src/app/api src/app/verification --include=*.tsx --include=*.ts
npx tsc --noEmit 2>&1 | grep -E "components/pos|api/pos|verification"
npm test 2>&1 | grep -E "Tests "
```

Attendu : le premier ≥ 1 (**la chaîne encodée existe toujours**) ; le deuxième aucune sortie ; le troisième aucune sortie ; **180 tests au vert**.

- [ ] **Étape 3 : commit**

```bash
git add src/components/pos src/app/api src/app/verification
git commit -m "feat(money): TND dans la caisse"
```

---

## Tâche 5 : vérification finale

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : plus aucun « DT » affiché**

```bash
grep -rn "[0-9)}\`\"'] DT\b" src/ --include=*.ts --include=*.tsx 2>/dev/null | grep -v "generated/" | grep -vE ":\s*//|:\s*\*|\* " | grep -v "\.test\.ts"
```

Attendu : **une seule ligne** — `src/lib/pos-sale-create.ts:84`, le commentaire
en fin de ligne `// 0.001 DT`. Il est invisible a l'ecran et reste volontairement
inchange.

Toute autre ligne signalerait un oubli.

- [ ] **Étape 2 : ce qui devait survivre a survécu**

```bash
grep -rc "formatDT" src/lib/money.ts
grep -c "MILLIMES_PER_DT" src/lib/money.ts
grep -c "CDTBQAAtQoAINQFAAC" src/components/pos/booking-detail-drawer.tsx
git diff main..HEAD --name-only | grep -c "generated/"
```

Attendu : `formatDT` ≥ 1 (**la fonction garde son nom**), `MILLIMES_PER_DT` ≥ 3, la chaîne encodée ≥ 1, et **0** fichier de `src/generated/` modifié.

- [ ] **Étape 3 : les commentaires n'ont pas été touchés**

```bash
grep -c "DT" src/lib/rewards/rewards.test.ts
grep -c "DT" src/lib/rewards/program.ts
```

Attendu : `rewards.test.ts` ≥ 8 et `program.ts` ≥ 2 — ce sont des commentaires explicatifs, invisibles à l'écran. Les changer aurait gonflé le diff sans bénéfice.

- [ ] **Étape 4 : types, lint, tests**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -2
npm test 2>&1 | grep -E "Test Files|Tests "
```

Attendu : **23** erreurs `tsc` exactement (les préexistantes — si le nombre dépasse, ce chantier a introduit une régression) ; ESLint à **52 problèmes** ; **180 tests au vert**.

- [ ] **Étape 5 : le build**

```bash
npm run build 2>&1 | grep -E "Compiled successfully|Failed to compile"
```

Attendu : `✓ Compiled successfully`.

Si le prérendu échoue ensuite sur `PrismaClientKnownRequestError` / `ECONNREFUSED`, c'est que la base n'est pas démarrée — **ce n'est pas un défaut du code**. Pour un build complet :

```bash
docker run -d --name salonista-tnd -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=beaute_marketplace -p 5433:5432 postgres:16-alpine
until docker exec salonista-tnd pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
npx prisma migrate deploy && npm run db:seed && npm run build
```

Nettoie ensuite : `docker rm -f salonista-tnd`.

- [ ] **Étape 6 : le rendu des tickets, contrôlé sur le code compilé**

Les tickets thermiques n'ont aucun « DT » en dur : ils héritent du changement de `formatDT()`. Vérifie que le bundle porte bien la nouvelle chaîne :

```bash
grep -rl "TND" .next/server 2>/dev/null | head -3
grep -rho "},\" TND\"\|,\" TND\"" .next/server 2>/dev/null | head -2
```

Attendu : au moins un fichier compilé contient « TND ». Si `.next/` n'existe pas, c'est que le build n'a pas abouti — reprends l'étape 5.

- [ ] **Étape 7 : pousser**

```bash
git status --short   # doit etre vide
git push -u origin fix-dt-vers-tnd
```

`gh` n'est pas installé : la PR s'ouvre depuis l'URL affichée après le push.

---

## Contrôle visuel — pour l'utilisatrice

1. **Un ticket de caisse imprimé** — c'est le changement le plus visible pour les salons. Fais une vente de test et imprime : tous les montants doivent dire « TND ».
2. **Un rapport Z** — même contrôle, depuis `/pos/cash-drawer/[id]/rapport`.
3. **Un e-mail de confirmation** — réserve et paie ; l'e-mail reçu doit dire « TND ».
4. **Ton espace cliente**, un tableau de bord admin, l'espace influenceuse.
5. **Dans Google**, plus tard : la méta-description d'une fiche offre dira « TND » au prochain passage du robot. Ce n'est pas immédiat.

---

## Ce que ce plan ne fait pas

- **Il ne renomme pas `formatDT`** en `formatTND` : 132 sites d'appel pour un gain de lisibilité seul.
- Il ne touche ni aux montants, ni aux calculs, ni au format numérique (virgule, trois décimales) — **seul le suffixe change**.
- Il ne touche pas à `src/generated/prisma/`, régénéré à chaque build.
- Il ne modifie pas les ~27 commentaires mentionnant « DT », invisibles à l'écran.
- Il ne modifie aucun schéma ni aucune donnée en base : « DT » et « TND » désignent la même monnaie.
- Il ne traite pas le pattern ARIA tablist — troisième chantier, indépendant.
