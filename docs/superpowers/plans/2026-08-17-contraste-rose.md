# Contraste du rose — plan d'implémentation

> **Pour les agents :** SOUS-SKILL REQUISE — utilise superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** faire passer le texte des fonds roses du blanc au prune, pour atteindre le seuil d'accessibilité AA, sans modifier la couleur `#FF5C8A`.

**Architecture :** quatre primitifs et huit fichiers. Le changement est mécanique — `text-white` devient `text-prune` partout où le fond est `bg-rose`. Aucune logique, aucune structure JSX ne bouge.

**Stack :** Next.js 16.2, React 19, Tailwind v4.

---

## Contexte pour qui n'a jamais vu ce dépôt

**Le problème.** Le token `--color-rose` (`#FF5C8A`) porte du texte blanc partout où il sert de fond. Ce couple donne **2,94:1**, alors que WCAG AA exige **4,5:1** pour du texte normal. Le libellé des boutons principaux est donc difficile à lire pour une personne malvoyante, en plein soleil, ou sur un écran médiocre.

**La solution retenue**, décidée avec l'utilisatrice : garder `#FF5C8A` — c'est une couleur de marque issue de sa palette — et passer le texte en `prune` (`#3A1024`). Ce couple donne **5,59:1**, au-dessus du seuil.

**Ce qui a été écarté :** assombrir le rose vers `#D42E60` et garder le blanc (4,82:1). Techniquement valable, mais cela altérerait la couleur de marque.

### Les chiffres, calculés et non supposés

| Couple | Contraste | Verdict |
|---|---|---|
| blanc sur `#FF5C8A` | 2,94:1 | ✗ sous les deux seuils |
| **prune sur `#FF5C8A`** | **5,59:1** | ✓ AA |
| prune sur `#F04A79` (survol) | 4,66:1 | ✓ AA, marge plus mince |
| prune sur `#D42E60` | 3,41:1 | ✗ — voir l'avertissement |

**Avertissement à connaître avant de « corriger » quoi que ce soit d'autre :** avec du texte prune, **assombrir le fond dégrade le contraste** au lieu de l'améliorer, le prune étant lui-même très foncé. Le couple prune-sur-rose n'est viable que sur les roses clairs. Ne touche pas au rose.

### La distinction qui structure tout ce plan

`grep "bg-rose"` remonte deux familles très différentes :

1. **Les fonds roses qui portent du texte** — boutons, badges, onglets, cases de calendrier sélectionnées. Ce sont eux, et eux seuls, que ce plan corrige.
2. **Les pastilles décoratives sans texte** — le point « aujourd'hui » des calendriers, les carrés de légende, la coche de sélection d'un service. Les règles de contraste de **texte** ne s'y appliquent pas : il n'y a pas de texte. **Elles ne doivent pas changer.**

Confondre les deux ferait perdre des repères visuels utiles sans rien gagner en accessibilité.

### Contraintes générales

- **Aucun test de composant n'est possible.** Vitest tourne en `environment: "node"` sans jsdom. N'en écris pas. La vérification passe par le calcul de contraste, `grep`, `tsc`, ESLint et le build. **Les 180 tests existants doivent rester au vert.**
- **`tsc` n'est pas propre au départ :** 23 erreurs préexistent sur `main`, toutes dans `src/components/pos/onboarding/wizard-client.tsx`. Elles ne viennent pas de ce chantier et ne se corrigent pas ici. Filtre toujours sur les fichiers touchés.
- **ESLint : 52 problèmes sur `main`.** Ce nombre ne doit pas augmenter.
- Ne supprime aucun token `brand-*` ni `pos-*`, et ne touche pas à la caisse.
- Interface en français, tutoiement.

---

## Structure des fichiers

### Les quatre primitifs — la majorité de l'effet

| Fichier | Ligne | Élément |
|---|---|---|
| `src/components/ui/button.tsx` | 30 | variante `primary` |
| `src/components/ui/badge.tsx` | 22 | ton `rose` |
| `src/components/ui/chip.tsx` | 28 | état actif |
| `src/components/ui/role-tabs.tsx` | 67 | onglet de rôle actif (Connexion / Inscription) |

Les corriger propage la correction partout où ces primitifs sont appelés.

### Les treize emplacements en dur

| Fichier | Ligne(s) | Élément |
|---|---|---|
| `src/app/(auth)/register/register-client.tsx` | 129 | bouton d'inscription |
| `src/app/offre/[id]/offer-client.tsx` | 211 | « Payer maintenant » |
| `src/app/offre/[id]/offer-client.tsx` | 374, 387 | onglets d'authentification |
| `src/app/offres/page.tsx` | 99 | bouton « Rechercher » |
| `src/app/page.tsx` | 349, 366 | les deux CTA professionnels |
| `src/app/salon/[id]/salon-client.tsx` | 224 | « Payer maintenant » |
| `src/components/booking-calendar.tsx` | 164, 230 | jour choisi, créneau actif |
| `src/components/multi-service-calendar.tsx` | 188, 252 | jour choisi, créneau actif |
| `src/components/nav-account.tsx` | 50 | initiale d'avatar |

### Ce qu'il ne faut PAS toucher — les pastilles sans texte

| Fichier | Ligne | Élément |
|---|---|---|
| `src/app/salon/[id]/salon-client.tsx` | 369 | coche de service sélectionné |
| `src/components/booking-calendar.tsx` | 181, 197 | point « aujourd'hui », carré de légende |
| `src/components/multi-service-calendar.tsx` | 208, 223 | point « aujourd'hui », carré de légende |
| `src/components/promo-banner.tsx` | 15 | commentaire mentionnant `bg-rose` |

---

## Tâche 0 : vérifier le point de départ

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : confirmer la branche**

```bash
git branch --show-current
git status --short
```

Attendu : `fix-contraste-rose`, arbre propre. La branche part de `main` à jour (lot 6 mergé, PR #18) et la spec y est déjà commitée.

- [ ] **Étape 2 : établir la ligne de base**

```bash
npm test 2>&1 | grep -E "Test Files|Tests "
npm run lint 2>&1 | tail -2
```

Attendu : **180 tests au vert** (13 fichiers), et `✖ 52 problems (40 errors, 12 warnings)`.

- [ ] **Étape 3 : compter les couples à corriger**

```bash
grep -rn "bg-rose\b" src/ --include=*.tsx | grep "text-white" | wc -l
```

Attendu : **17** (4 primitifs + 13 emplacements). Ce nombre doit valoir **0** à la fin.

Si tu comptes 16, c'est que `role-tabs.tsx` a été oublié — il l'a été dans une
première version de ce plan, et le compteur est ce qui l'a rattrapé.

---

## Tâche 1 : les quatre primitifs

C'est ici que se joue l'essentiel : ces quatre fichiers propagent la correction partout où ils sont utilisés.

**Fichiers :**
- Modifier : `src/components/ui/button.tsx:30`, `src/components/ui/badge.tsx:22`, `src/components/ui/chip.tsx:28`, `src/components/ui/role-tabs.tsx:67`

- [ ] **Étape 1 : le bouton primaire**

Dans `src/components/ui/button.tsx`, remplace la ligne 30 :

```tsx
    primary: "bg-rose text-white hover:bg-[#F04A79]",
```

par :

```tsx
    // Texte prune et non blanc : blanc sur rose donne 2,94:1, sous le seuil
    // AA de 4,5:1. Le prune donne 5,59:1 (4,66:1 sur le survol #F04A79).
    primary: "bg-rose text-prune hover:bg-[#F04A79]",
```

- [ ] **Étape 2 : le badge rose**

Dans `src/components/ui/badge.tsx`, remplace la ligne 22 :

```tsx
    rose: "bg-rose text-white",
```

par :

```tsx
    rose: "bg-rose text-prune",
```

- [ ] **Étape 3 : le chip actif**

Dans `src/components/ui/chip.tsx`, remplace la ligne 28 :

```tsx
          ? "bg-rose text-white"
```

par :

```tsx
          ? "bg-rose text-prune"
```

- [ ] **Étape 4 : les onglets de rôle**

Dans `src/components/ui/role-tabs.tsx`, remplace la ligne 67 :

```tsx
                ? "bg-rose text-white"
```

par :

```tsx
                ? "bg-rose text-prune"
```

Ce primitif sert le sélecteur « Cliente / Salon / Influenceuse » des pages
Connexion et Inscription. Il avait été explicitement laissé de côté au lot 5 —
mais il l'était pour ne pas **modifier sa structure** ; sa couleur de texte
relève bien de ce chantier-ci.

- [ ] **Étape 5 : vérifier**

```bash
grep -rn "bg-rose" src/components/ui/ | grep "text-white"
npx tsc --noEmit 2>&1 | grep -E "components/ui"
npm test 2>&1 | grep -E "Tests "
```

Attendu : aucune sortie des deux premiers, **180 tests au vert**. Rappel : `npx tsc --noEmit` sans filtre affiche 23 erreurs préexistantes dans le module de caisse — ignore-les.

- [ ] **Étape 6 : commit**

```bash
git add src/components/ui/
git commit -m "fix(a11y): texte prune sur les fonds roses des primitifs"
```

---

## Tâche 2 : les pages publiques

**Fichiers :**
- Modifier : `src/app/(auth)/register/register-client.tsx:129`, `src/app/offre/[id]/offer-client.tsx:211,374,387`, `src/app/offres/page.tsx:99`, `src/app/page.tsx:349,366`, `src/app/salon/[id]/salon-client.tsx:224`

Chacun de ces emplacements contient `bg-rose` et `text-white` dans la même chaîne de classes. Le traitement est identique partout : **remplacer `text-white` par `text-prune`**, sans rien toucher d'autre.

- [ ] **Étape 1 : appliquer le remplacement**

Pour chaque fichier ci-dessous, localise la ligne indiquée et remplace `text-white` par `text-prune` dans la chaîne qui contient aussi `bg-rose`.

**Attention :** ces fichiers contiennent d'autres `text-white` légitimes — sur fond `prune` (CTA professionnel, pied de page). **Ne remplace que ceux dont la chaîne contient également `bg-rose`.** Un remplacement global casserait les blocs sombres.

| Fichier | Ligne | Repère |
|---|---|---|
| `src/app/(auth)/register/register-client.tsx` | 129 | bouton d'inscription, contient `hover:bg-[#F04A79]` |
| `src/app/offre/[id]/offer-client.tsx` | 211 | « Payer maintenant », contient `hover:bg-[#F04A79]` |
| `src/app/offre/[id]/offer-client.tsx` | 374 | `? "bg-rose text-white"` — onglet « Nouveau client » |
| `src/app/offre/[id]/offer-client.tsx` | 387 | `? "bg-rose text-white"` — onglet « J'ai déjà un compte » |
| `src/app/offres/page.tsx` | 99 | bouton « Rechercher » |
| `src/app/page.tsx` | 349 | CTA « Rejoindre → » |
| `src/app/page.tsx` | 366 | CTA « Devenir partenaire → » |
| `src/app/salon/[id]/salon-client.tsx` | 224 | « Payer maintenant » |

- [ ] **Étape 2 : vérifier qu'aucun `text-white` légitime n'a été touché**

```bash
grep -rn "bg-rose\b" src/app --include=*.tsx | grep "text-white"
grep -c "text-white" src/app/page.tsx
```

Attendu : **aucune sortie** du premier. Le second doit valoir **au moins 1** — le CTA professionnel et le pied de page ont un fond `prune` et gardent leur texte blanc, ce qui est correct (blanc sur prune donne un excellent contraste).

- [ ] **Étape 3 : vérifier les types et les tests**

```bash
npx tsc --noEmit 2>&1 | grep -E "app/page|offer-client|salon-client|register-client|offres/page"
npm test 2>&1 | grep -E "Tests "
```

Attendu : aucune sortie, **180 tests au vert**.

- [ ] **Étape 4 : commit**

```bash
git add src/app/
git commit -m "fix(a11y): texte prune sur les fonds roses des pages publiques"
```

---

## Tâche 3 : les calendriers et le menu de compte

**Fichiers :**
- Modifier : `src/components/booking-calendar.tsx:164,230`, `src/components/multi-service-calendar.tsx:188,252`, `src/components/nav-account.tsx:50`

- [ ] **Étape 1 : `booking-calendar.tsx`**

Ligne 164, remplace :

```tsx
              classes = "bg-rose text-white cursor-pointer font-semibold";
```

par :

```tsx
              classes = "bg-rose text-prune cursor-pointer font-semibold";
```

Ligne 230, remplace :

```tsx
                        ? "border-rose bg-rose text-white"
```

par :

```tsx
                        ? "border-rose bg-rose text-prune"
```

- [ ] **Étape 2 : `multi-service-calendar.tsx`**

Ligne 188, remplace :

```tsx
                  classes = "bg-rose text-white cursor-pointer font-semibold";
```

par :

```tsx
                  classes = "bg-rose text-prune cursor-pointer font-semibold";
```

Ligne 252, remplace :

```tsx
                            ? "border-rose bg-rose text-white"
```

par :

```tsx
                            ? "border-rose bg-rose text-prune"
```

- [ ] **Étape 3 : `nav-account.tsx`**

Ligne 50, remplace :

```tsx
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose text-xs font-bold text-white">
```

par :

```tsx
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose text-xs font-bold text-prune">
```

- [ ] **Étape 4 : vérifier que les pastilles décoratives sont intactes**

C'est le contrôle le plus important de cette tâche. Ces éléments sont des repères visuels **sans texte** : les règles de contraste ne s'y appliquent pas, et les modifier ferait perdre de l'information.

```bash
grep -n "h-1.5 w-1.5 rounded-full bg-rose" src/components/booking-calendar.tsx src/components/multi-service-calendar.tsx
grep -n "h-3 w-3 rounded-full bg-rose" src/components/booking-calendar.tsx src/components/multi-service-calendar.tsx
grep -n "border-rose bg-rose\"" src/app/salon/\[id\]/salon-client.tsx
```

Attendu : **chacune de ces commandes doit renvoyer ses lignes**, inchangées. Le point « aujourd'hui » (1,5×1,5), les carrés de légende (3×3) et la coche de service ne portent aucun texte.

- [ ] **Étape 5 : vérifier les types et les tests**

```bash
npx tsc --noEmit 2>&1 | grep -E "booking-calendar|multi-service-calendar|nav-account"
npm test 2>&1 | grep -E "Tests "
```

Attendu : aucune sortie, **180 tests au vert**.

- [ ] **Étape 6 : commit**

```bash
git add src/components/
git commit -m "fix(a11y): texte prune sur les fonds roses des calendriers et du menu"
```

---

## Tâche 4 : vérification finale

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : plus aucun blanc sur rose**

```bash
grep -rn "bg-rose\b" src/ --include=*.tsx | grep "text-white"
```

Attendu : **aucune sortie.**

- [ ] **Étape 2 : les pastilles décoratives ont survécu**

```bash
grep -rn "rounded-full bg-rose" src/components/ | wc -l
```

Attendu : **au moins 4** — les deux points « aujourd'hui » et les deux carrés de légende. S'il en manque, une pastille a été convertie à tort.

- [ ] **Étape 3 : le contraste, recalculé**

```bash
python -c "
def lum(h):
    r,g,b=[int(h[i:i+2],16)/255 for i in (1,3,5)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def ratio(a,b):
    la,lb=lum(a),lum(b); return round((max(la,lb)+0.05)/(min(la,lb)+0.05),2)
print('prune sur rose   :', ratio('#3A1024','#FF5C8A'), '(seuil AA : 4.5)')
print('prune sur survol :', ratio('#3A1024','#F04A79'))
"
```

Attendu : **5,59** et **4,66**, tous deux au-dessus de 4,5.

- [ ] **Étape 4 : le token n'a pas bougé**

```bash
grep -n "color-rose:" src/app/globals.css
```

Attendu : `--color-rose: #FF5C8A;` — inchangé. C'était tout l'intérêt de l'option retenue.

- [ ] **Étape 5 : types, lint, tests, build**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -2
npm test 2>&1 | grep -E "Test Files|Tests "
npm run build 2>&1 | tail -5
```

Attendu : **23** erreurs `tsc` exactement (les préexistantes du module de caisse — si le nombre dépasse, ce chantier a introduit une régression) ; ESLint à **52 problèmes** ; **180 tests au vert** ; build réussi.

Si le build échoue sur `ECONNREFUSED`, c'est que la base n'est pas démarrée — ce n'est pas un défaut du code :

```bash
docker run -d --name salonista-contraste -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=beaute_marketplace -p 5433:5432 postgres:16-alpine
until docker exec salonista-contraste pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
npx prisma migrate deploy && npm run db:seed && npm run build
```

Pense à nettoyer ensuite : `docker rm -f salonista-contraste`.

- [ ] **Étape 6 : pousser**

```bash
git status --short   # doit etre vide
git push -u origin fix-contraste-rose
```

`gh` n'est pas installé : la PR s'ouvre depuis l'URL affichée après le push.

---

## Contrôle visuel — pour l'utilisatrice

**C'est le contrôle décisif de ce chantier.** Le calcul prouve que c'est plus lisible ; seul l'œil dit si c'est réussi.

1. **Un bouton principal** — « Réserver maintenant » sur une fiche offre, ou « Rechercher » sur `/offres`. Le texte prune sur rose te plaît-il ? C'est l'aspect qui change le plus.
2. **Les chips de catégorie** sur l'accueil — le chip actif est rose ; son libellé reste-t-il net ?
3. **Un calendrier** — sélectionne une date. Le chiffre du jour choisi est-il lisible sur le rose ?
4. **L'initiale de ton avatar**, en haut à droite une fois connectée.
5. **Les badges de remise** (« -25% ») sur les cartes d'offre — c'est le plus petit texte concerné, 12px.
6. **Au survol d'un bouton** : le rose fonce légèrement, le contraste passe de 5,59 à 4,66. Reste-t-il confortable ?

**Si le rendu te déplaît**, l'autre option reste ouverte : assombrir le rose vers `#D42E60` et revenir au blanc (4,82:1). Elle préserve l'aspect actuel des boutons, au prix d'un écart avec ta palette d'origine. Les deux atteignent le seuil — c'est un arbitrage esthétique.

---

## Ce que ce plan ne fait pas

- **Il ne modifie pas `--color-rose`.** C'est le principe de l'option retenue.
- Il ne touche pas à `--color-rose-soft`, qui porte déjà du texte prune (13,35:1).
- Il ne touche pas à l'anneau de focus `.ds-focus`, qui utilise le rose comme **bordure** et non comme fond — les règles de contraste de texte ne s'y appliquent pas.
- **Il ne convertit pas les pastilles décoratives** sans texte.
- Il ne touche ni aux tokens `brand-*`/`pos-*`, ni à la caisse.
- **Il ne traite pas les « DT »** (57 fichiers, 253 occurrences) ni le pattern ARIA tablist — ce sont les deux autres chantiers, indépendants.
