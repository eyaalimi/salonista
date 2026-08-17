# Refonte visuelle lot 6 — le bas de l'accueil

> **Pour les agents :** SOUS-SKILL REQUISE — utilise superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** terminer la série de refonte visuelle — plus aucune classe `brand-*` ni `luxury-*` sur la page d'accueil.

**Architecture :** deux fichiers modifiés, aucun composant créé. Le travail est purement visuel, plus un passage au tutoiement du bloc destiné aux professionnels. Aucune requête, aucun balisage SEO, aucune logique ne bouge.

**Stack :** Next.js 16.2 (App Router), React 19, Tailwind v4, Prisma 7.

---

## Contexte pour qui n'a jamais vu ce dépôt

**Où on en est.** C'est le sixième et dernier lot d'une refonte visuelle menée page par page. Le haut de l'accueil a été refait au lot 2a ; il reste le bas : bannière promo, « Salons près de toi », CTA prestataire/influenceuse, FAQ et pied de page.

**Le design system.** Quatre couleurs : `rose` (#FF5C8A, action principale), `prune` (#3A1024, texte et fonds sombres), `menthe` (#A8E6CF, disponibilité et confirmation), `creme` (#FFF6F1, fond de page). Plus `rose-soft`, `prune-soft`, `menthe-deep`, `hairline` (bordures). Trois règles absolues :

1. **Aucune ombre, aucun dégradé, aucun flou.** La hiérarchie passe par la couleur.
2. **Une seule action rose pleine par vue.** Ici : les liens du CTA professionnel.
3. **Cibles tactiles ≥ 44px**, corps de texte ≥ 16px.

Trois classes utilitaires dans `src/app/globals.css` : `.ds-press` (transition + `scale(0.97)` à l'appui), `.ds-focus` (anneau rose de 2px au focus clavier), `.ds-display` (police Bricolage Grotesque, graisse 800).

**Les tokens `brand-*` et `pos-*` ne doivent JAMAIS être supprimés de `globals.css`**, ni les classes `.luxury-*`. 142 fichiers en dépendent, dont la caisse en production. On cesse de les *utiliser* dans les deux fichiers qu'on touche ; on ne les efface pas.

### La contrainte la plus importante : `page.tsx` est un composant serveur

Vérifié : le fichier n'a **pas** de directive `"use client"` et interroge Prisma directement.

Conséquence : **aucun `onClick`, `useState` ou gestionnaire d'événement ne peut y être introduit.** Le restylage n'en a pas besoin — tout passe par des classes et des `<Link>` — mais si tu te surprends à vouloir en écrire un, c'est que tu sors du périmètre.

### Ce qu'il ne faut toucher sous aucun prétexte

- **Les trois blocs `<script type="application/ld+json">`** en fin de fichier (lignes ~427-464) : `WebSite`, `Organization` et `FAQPage`. C'est le travail SEO construit lors d'un chantier précédent, et `FAQPage` est **le seul type que le Test des résultats enrichis de Google prévisualise** — c'est lui qui produit le « 1 élément valide détecté » attendu.
- `buildFaqJsonLd()` et `FAQ_ITEMS`, importés de `@/lib/faq` (ligne 8). C'est la **source unique** de la FAQ visible *et* du balisage. Les désynchroniser invaliderait le balisage aux yeux de Google.
- Toutes les requêtes Prisma et le calcul de disponibilité (`pickNextSlot`, `formatAvailability`).
- **Tout le haut de page** (lignes 1 à 312) : en-tête, recherche, chips, cartes salon, cartes offre. Déjà livré au lot 2a.

### Aucun test de composant n'est possible

Vitest tourne en `environment: "node"` sans jsdom, et `@testing-library/react` n'est pas installé. N'en écris pas. La vérification passe par le build, `tsc`, ESLint, `grep`, le HTML servi et le contrôle visuel. **Les 180 tests existants doivent rester au vert** ; ce lot n'en ajoute ni n'en retire aucun.

### Le piège du typage

`next.config.ts` contient `typescript: { ignoreBuildErrors: true }` : un build qui réussit ne prouve rien sur les types. Et `tsc` n'est pas propre au départ — **23 erreurs préexistent sur `main`**, toutes dans `src/components/pos/onboarding/wizard-client.tsx` (deux types `Provider` homonymes en conflit). Elles ne viennent pas de ce lot et ne se corrigent pas ici. Filtre toujours :

```bash
npx tsc --noEmit 2>&1 | grep -E "app/page|promo-banner"
```

C'est **cette** sortie qui doit être vide.

**Langue de l'interface :** français, tutoiement, casse de phrase.

---

## Structure des fichiers

| Fichier | Responsabilité | État de départ |
|---|---|---|
| `src/app/page.tsx` | Accueil complet ; seules les lignes 313-425 sont concernées | 467 lignes, **18** `brand-*`, **3** `luxury-*` |
| `src/components/promo-banner.tsx` | Bannière promo (utilisée **uniquement** par l'accueil) | 19 lignes, **4** occurrences `brand-*` sur 3 lignes |

### Bonne nouvelle : pas d'interstice possible

Aux lots 4 et 5, le découpage par bornes de sections a laissé à chaque fois une portion non couverte — un `<h2>` puis une description d'offre, restés en `brand-*` jusqu'au contrôle final.

**Ici, la cartographie a été faite avant d'écrire ce plan.** Les 18 `brand-*` et les 3 `luxury-*` sont **tous** situés entre les lignes 313 et 425, dans les cinq sections traitées ci-dessous :

| Ligne(s) | Section | Tâche |
|---|---|---|
| 315, 317, 320, 326 | Salons près de toi | 2 |
| 334, 340, 343, 349, 357, 360, 366 | CTA professionnel | 3 |
| 378, 381, 385, 388, 392, 397 | FAQ | 4 |
| 407, 411, 414, 417 | Pied de page | 5 |

Le contrôle `grep` global reste néanmoins exigé à la fin de chaque tâche — c'est lui qui fait foi, pas cette table.

---

## Tâche 0 : vérifier le point de départ

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : confirmer la branche**

```bash
git branch --show-current
git status --short
```

Attendu : `design-lot6`, arbre propre. La branche part de `main` à jour (lot 5 mergé, PR #17) et la spec y est déjà commitée.

- [ ] **Étape 2 : établir la ligne de base**

```bash
npm test 2>&1 | grep -E "Test Files|Tests "
npm run lint 2>&1 | tail -2
```

Attendu : **180 tests au vert** (13 fichiers), et `✖ 52 problems (40 errors, 12 warnings)` pour ESLint. Ces deux nombres ne doivent pas bouger.

- [ ] **Étape 3 : noter les compteurs de départ**

```bash
grep -c "brand-" src/app/page.tsx
grep -c "luxury-" src/app/page.tsx
grep -c "brand-" src/components/promo-banner.tsx
grep -c "application/ld+json" src/app/page.tsx
```

Attendu : `18`, `3`, **`3`**, et **`3`** pour les blocs JSON-LD.

**Attention :** `grep -c` compte les **lignes** contenant un motif, pas les
occurrences. `promo-banner.tsx` a **4 occurrences** de `brand-*` reparties sur
**3 lignes** (une ligne en contient deux). Le critere de fin reste le meme —
zero — mais ne t'etonne pas de l'ecart entre les deux facons de compter. Les trois premiers doivent valoir **0** à la fin ; le quatrième doit rester **3**.

---

## Tâche 1 : la bannière promo

On commence par le plus petit fichier.

**Fichiers :**
- Modifier : `src/components/promo-banner.tsx` (19 lignes, en entier)

- [ ] **Étape 1 : remplacer le composant**

Remplace tout le contenu du fichier par :

```tsx
import Link from "next/link";

export function PromoBanner() {
  return (
    <Link
      href="/offres"
      className="ds-press ds-focus mx-4 mt-3 flex items-center justify-between gap-3 rounded-[var(--radius-panel)] bg-prune p-4"
    >
      <div className="min-w-0">
        <p className="text-base font-semibold text-white">🔥 Offres du weekend</p>
        <p className="mt-0.5 text-sm text-white/70">
          Jusqu&apos;à -50% sur hammam &amp; coiffure
        </p>
      </div>
      <span className="ds-press shrink-0 rounded-[var(--radius-pill)] bg-rose px-4 py-2 text-sm font-semibold text-white">
        Voir tout
      </span>
    </Link>
  );
}
```

Ce qui change :

- `bg-brand-ink` devient `bg-prune`, `bg-brand-gold` devient `bg-rose`, `text-brand-gold-soft` devient `text-white/70`, `text-[#FBFAF7]` devient `text-white`.
- `rounded-2xl` devient `rounded-[var(--radius-panel)]`.
- `transition-opacity hover:opacity-90` disparaît au profit de `.ds-press` : le système anime la couleur et l'échelle, pas l'opacité.
- Le texte passe de `text-xs` à `text-sm` et de `text-sm` à `text-base` — le corps doit faire au moins 16px.
- **Le texte lui-même ne change pas.** Qu'il annonce une promotion en dur, sans correspondance en base, est un sujet produit, pas de design.

- [ ] **Étape 2 : vérifier**

```bash
grep -c "brand-" src/components/promo-banner.tsx
npx tsc --noEmit 2>&1 | grep -E "app/page|promo-banner"
```

Attendu : `brand-` à **0**, aucune sortie de `tsc`. Rappel : `npx tsc --noEmit` sans filtre affiche 23 erreurs préexistantes dans le module de caisse — ignore-les, ne les corrige pas.

- [ ] **Étape 3 : commit**

```bash
git add src/components/promo-banner.tsx
git commit -m "feat(design): banniere promo au design system"
```

---

## Tâche 2 : « Salons près de toi »

**Fichiers :**
- Modifier : `src/app/page.tsx:313-331`

- [ ] **Étape 1 : remplacer la section**

Remplace les lignes 313 à 331 (de `      {/* SALONS NEAR YOU CTA */}` jusqu'au `      </section>` qui la ferme) par :

```tsx
      {/* SALONS NEAR YOU CTA */}
      <section className="mt-6 px-0">
        <div className="mx-4 flex items-center justify-between gap-3 rounded-[var(--radius-panel)] border-2 border-hairline bg-white p-4">
          <div className="min-w-0">
            <p className="text-base font-semibold text-prune">
              Salons près de toi 📍
            </p>
            <p className="text-sm text-prune-soft">
              Disponibles maintenant
            </p>
          </div>
          <Link
            href="/offres"
            className="ds-press ds-focus inline-flex min-h-[44px] shrink-0 items-center rounded-[var(--radius-pill)] px-3 text-base font-semibold text-rose"
          >
            Voir →
          </Link>
        </div>
      </section>
```

Trois points :

- `bg-brand-sand` devient `bg-white` avec une bordure `hairline` : sur le fond crème de la page, un bloc blanc bordé se détache sans avoir besoin d'un fond coloré.
- Le lien « Voir » gagne sa **cible de 44px** — il n'en avait aucune, c'était un simple texte.
- Le texte passe à `text-base` et `text-sm`.

- [ ] **Étape 2 : vérifier**

```bash
grep -c "brand-" src/app/page.tsx
npx tsc --noEmit 2>&1 | grep -E "app/page|promo-banner"
```

Attendu : `brand-` descendu à **14** (18 − 4), aucune sortie de `tsc`.

- [ ] **Étape 3 : commit**

```bash
git add src/app/page.tsx
git commit -m "feat(design): bloc salons proches au design system"
```

---

## Tâche 3 : le CTA professionnel

C'est la section qui porte l'action primaire rose, et la seule qui change de registre de langue.

**Fichiers :**
- Modifier : `src/app/page.tsx:333-371`

- [ ] **Étape 1 : remplacer la section**

Remplace les lignes 333 à 371 (de `      {/* PRO CTA — kept compact, stacked on mobile */}` jusqu'au `      </section>` qui la ferme) par :

```tsx
      {/* PRO CTA — kept compact, stacked on mobile */}
      <section className="mt-8 bg-prune text-white">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/register"
            className="ds-press ds-focus block border-b border-white/10 p-6 sm:p-10"
          >
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-white/60">
              Prestataire
            </p>
            <h3 className="ds-display text-xl sm:text-3xl">
              Tu as un <span className="italic">salon</span> ?
            </h3>
            <p className="mt-2 text-base text-white/70">
              Reçois des réservations qualifiées chaque jour.
            </p>
            <span className="mt-4 inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] bg-rose px-5 text-base font-semibold text-white">
              Rejoindre →
            </span>
          </Link>
          <Link
            href="/register"
            className="ds-press ds-focus block p-6 sm:p-10"
          >
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-white/60">
              Influenceuse
            </p>
            <h3 className="ds-display text-xl sm:text-3xl">
              Monétise ton <span className="italic">audience</span>
            </h3>
            <p className="mt-2 text-base text-white/70">
              10% de commission sur chaque réservation.
            </p>
            <span className="mt-4 inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] bg-rose px-5 text-base font-semibold text-white">
              Devenir partenaire →
            </span>
          </Link>
        </div>
      </section>
```

Quatre changements de fond :

- **Le tutoiement.** « Vous avez un salon ? » devient « Tu as un salon ? », « Recevez » devient « Reçois », « Monétisez votre audience » devient « Monétise ton audience ». La raison n'est pas la cohérence de principe mais la **destination** : ces deux liens mènent à `/register`, refaite dans un lot précédent et **qui tutoie déjà**. Vouvoyer ici pour tutoyer à l'étape suivante coupe le parcours en deux.
- **Le rose primaire arrive ici.** Les deux appels à l'action passent de simples textes dorés à des pills roses pleines de 44px. Le haut de la page n'a aucun fond rose plein (les chips actifs sont un état de sélection), donc la règle « une seule action rose par vue » est respectée — ces deux liens forment un seul bloc d'appel, visuellement séparé du flux.
- `bg-brand-ink` (#1F1A1C) devient `bg-prune` (#3A1024). Le fond sombre reste : la règle interdit ombres et dégradés, pas les fonds contrastés.
- `luxury-heading` devient `.ds-display`, et les corps passent à `text-base`.

- [ ] **Étape 2 : vérifier**

```bash
grep -c "brand-" src/app/page.tsx
grep -c "luxury-" src/app/page.tsx
grep -n "Vous avez\|Recevez\|Monétisez" src/app/page.tsx
npx tsc --noEmit 2>&1 | grep -E "app/page|promo-banner"
```

Attendu : `brand-` à **9** (18 − 4 pour les salons proches − 5 ici), `luxury-` à **1**, aucun vouvoiement restant dans cette section, aucune sortie de `tsc`.

- [ ] **Étape 3 : commit**

```bash
git add src/app/page.tsx
git commit -m "feat(design): CTA professionnel au design system et au tutoiement"
```

---

## Tâche 4 : la FAQ

**Fichiers :**
- Modifier : `src/app/page.tsx:373-404`

**Avant de commencer :** cette section est liée au SEO. Le commentaire au-dessus explique pourquoi elle utilise `<details>`/`<summary>` natif — le contenu reste dans le HTML **même replié**, ce que Google exige pour valider un balisage `FAQPage`. Ne remplace pas cette structure par un accordéon en JavaScript : d'une part `page.tsx` est un composant serveur, d'autre part cela invaliderait le balisage.

- [ ] **Étape 1 : remplacer la section**

Remplace les lignes 373 à 404 (du commentaire `{/* FAQ — le contenu reste dans le HTML…` jusqu'au `      </section>` qui la ferme) par :

```tsx
      {/* FAQ — le contenu reste dans le HTML meme replie (details/summary
          natif, sans JS), ce qui satisfait l'exigence de Google : une
          question balisee doit etre visible sur la page. */}
      <section className="mt-10 px-6 md:px-12" aria-labelledby="faq-titre">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">
            Questions fréquentes
          </p>
          <h2 id="faq-titre" className="ds-display mb-6 text-2xl text-prune sm:text-3xl">
            Tout savoir sur <span className="italic">Salonista</span>
          </h2>

          <div className="divide-y divide-hairline border-y border-hairline">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="ds-focus flex min-h-[44px] cursor-pointer items-center justify-between gap-4 text-base font-semibold text-prune marker:content-['']">
                  {item.question}
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-xl text-rose transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-base leading-relaxed text-prune-soft">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
```

Points d'attention :

- **`FAQ_ITEMS` reste la source.** Ne remplace ni la boucle ni son contenu par du texte en dur : le même tableau alimente le balisage `FAQPage` plus bas.
- **Le `+` qui pivote est conservé** (`group-open:rotate-45`). C'est une transformation d'état, pas une animation d'apparition — le système autorise la première, interdit la seconde. Il passe en `rose` et en `text-xl` pour rester visible.
- Le `<summary>` gagne `min-h-[44px]` et `.ds-focus` : c'est un élément cliquable, il lui faut une cible et un anneau de focus.
- Les corps passent de `text-sm` à `text-base`.

- [ ] **Étape 2 : vérifier que le lien avec le SEO est intact**

```bash
grep -c "FAQ_ITEMS" src/app/page.tsx
grep -c "buildFaqJsonLd" src/app/page.tsx
grep -c "application/ld+json" src/app/page.tsx
grep -c "brand-" src/app/page.tsx
grep -c "luxury-" src/app/page.tsx
```

Attendu : `FAQ_ITEMS` ≥ 2 (import + boucle), `buildFaqJsonLd` ≥ 2 (import + appel), **3** blocs JSON-LD, `brand-` descendu à **4** (9 − 5), `luxury-` à **0**.

- [ ] **Étape 3 : commit**

```bash
git add src/app/page.tsx
git commit -m "feat(design): FAQ au design system"
```

---

## Tâche 5 : le pied de page et la chasse aux interstices

**Fichiers :**
- Modifier : `src/app/page.tsx:406-425`

- [ ] **Étape 1 : remplacer le pied de page**

Remplace les lignes 406 à 425 (de `      {/* FOOTER */}` jusqu'au `      </footer>`) par :

```tsx
      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-prune text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-6 py-8 sm:flex-row md:px-12">
          <Logo tone="light" className="text-xl" />
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/offres"
              className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] px-3 text-white/70 hover:text-white"
            >
              Offres
            </Link>
            <Link
              href="/login"
              className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] px-3 text-white/70 hover:text-white"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] px-3 text-white/70 hover:text-white"
            >
              Inscription
            </Link>
          </div>
          <p className="text-xs text-white/40">
            © 2026 · Fait en Tunisie
          </p>
        </div>
      </footer>
```

Trois points :

- **`<Logo tone="light">` est conservé tel quel.** Ce composant existe précisément pour les fonds sombres ; le passer en `ink` le rendrait invisible.
- Les trois liens gagnent une **cible de 44px** — ils étaient en `text-xs` sans zone cliquable, difficiles à atteindre au doigt.
- Le survol passe de `hover:text-brand-gold` à `hover:text-white` : sur un fond `prune`, le blanc est le contraste maximal disponible.

- [ ] **Étape 2 : la chasse aux interstices — l'étape que les lots 4 et 5 ont dû rattraper**

```bash
grep -n "brand-" src/app/page.tsx
grep -n "luxury-" src/app/page.tsx
grep -n "brand-\|luxury-" src/components/promo-banner.tsx
```

**Attendu : aucune sortie, dans les trois cas.**

Si une ligne apparaît, c'est un interstice — du code entre deux bornes de tâches, qu'aucune n'a couvert. C'est arrivé aux deux lots précédents. Corrige-le en appliquant les conventions de la section qui l'entoure : `luxury-heading` → `ds-display text-prune`, `text-brand-bordeaux` → `text-prune`, `text-brand-bordeaux/70` → `text-prune-soft`, `border-brand-gold/20` → `border-hairline`, `bg-brand-ink` → `bg-prune`, `text-brand-gold` → `text-rose`.

- [ ] **Étape 3 : vérifier que le SEO et le haut de page sont intacts**

```bash
grep -c "application/ld+json" src/app/page.tsx
grep -c "FAQPage" src/app/page.tsx
grep -c "buildFaqJsonLd\|FAQ_ITEMS" src/app/page.tsx
grep -c "pickNextSlot\|formatAvailability" src/app/page.tsx
grep -c "prisma\." src/app/page.tsx
npm test 2>&1 | grep -E "Test Files|Tests "
```

Attendu : **3** blocs JSON-LD, `FAQPage` présent (≥ 1), la FAQ liée (≥ 4), la disponibilité intacte (≥ 2), les requêtes Prisma intactes (≥ 1), **180 tests au vert**.

- [ ] **Étape 4 : commit**

```bash
git add src/app/page.tsx
git commit -m "feat(design): pied de page au design system"
```

---

## Tâche 6 : vérification finale

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : tous les compteurs à zéro**

```bash
grep -c "brand-" src/app/page.tsx
grep -c "luxury-" src/app/page.tsx
grep -c "brand-" src/components/promo-banner.tsx
grep -c -E "shadow|gradient|blur" src/app/page.tsx src/components/promo-banner.tsx
grep -c -E "text-red|text-amber|text-gray|bg-gray" src/app/page.tsx src/components/promo-banner.tsx
```

Attendu : **0** partout. `grep -c` renvoie 0 et sort en code 1 quand il ne trouve rien — c'est normal.

- [ ] **Étape 2 : types, lint, tests**

```bash
npx tsc --noEmit 2>&1 | grep -E "app/page|promo-banner"
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -2
npm test 2>&1 | grep -E "Test Files|Tests "
```

Attendu : **aucune sortie du premier grep** ; le second doit afficher **23** — le nombre exact d'erreurs préexistantes dans le module de caisse. S'il dépasse 23, ce lot a introduit une régression ailleurs. ESLint doit rester à **52 problèmes**. **180 tests au vert**.

- [ ] **Étape 3 : le build**

```bash
npm run build 2>&1 | tail -15
```

Attendu : succès. Si le build échoue sur `ECONNREFUSED` / `PrismaClientKnownRequestError`, c'est que la base n'est pas démarrée — voir l'étape suivante, ce n'est pas un défaut du code.

- [ ] **Étape 4 : démarrer une base**

L'accueil interroge Prisma au prérendu. Si aucune base ne tourne :

```bash
docker run -d --name salonista-lot6 -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=beaute_marketplace -p 5433:5432 postgres:16-alpine
until docker exec salonista-lot6 pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
npx prisma migrate deploy
npm run db:seed
```

- [ ] **Étape 5 : vérifier le HTML réellement servi — le contrôle le plus important**

Ce contrôle a déjà révélé, lors d'un lot précédent, une police jamais téléchargée que le code montrait pourtant comme correcte.

**Le piège du seed :** après un seed, l'accueil n'affiche ni offres ni salons, parce que `prisma/seed.ts` écrit `publishedToMarketplace: false` alors que les pages exigent `true`. Ce n'est pas une panne. Publie temporairement :

```bash
docker exec salonista-lot6 psql -U postgres -d beaute_marketplace -c \
  "UPDATE \"Offer\" SET \"publishedToMarketplace\"=true WHERE array_length(photos,1) > 0;"

npm run build
npm run start &
until curl -s -o /dev/null http://localhost:3000/; do sleep 1; done

curl -s http://localhost:3000/ -o /tmp/accueil.html -w "HTTP %{http_code}\n"

echo "--- LES TROIS BLOCS JSON-LD (doit valoir 3) ---"
grep -o 'application/ld+json' /tmp/accueil.html | wc -l
echo "--- FAQPage present (doit valoir >= 1) ---"
grep -o 'FAQPage' /tmp/accueil.html | wc -l
echo "--- WebSite et Organization ---"
grep -o '"@type":"WebSite"' /tmp/accueil.html | wc -l
grep -o '"@type":"Organization"' /tmp/accueil.html | wc -l
echo "--- interdits (doit valoir 0) ---"
grep -oE 'shadow-|gradient|backdrop-blur' /tmp/accueil.html | wc -l
echo "--- tutoiement du CTA pro ---"
grep -o 'Tu as un' /tmp/accueil.html | wc -l
grep -o 'Vous avez un' /tmp/accueil.html | wc -l
echo "--- la FAQ est-elle dans le HTML meme repliee ? ---"
grep -o '<details' /tmp/accueil.html | wc -l
```

Attendu : HTTP 200 ; **3** blocs JSON-LD ; `FAQPage`, `WebSite` et `Organization` présents ; **0** interdit ; « Tu as un » présent et « Vous avez un » absent ; au moins un `<details>`.

**Le contrôle des trois blocs JSON-LD n'est pas négociable.** C'est le SEO qui a demandé le plus d'efforts, et `FAQPage` est le seul type que Google prévisualise.

**Note sur les `brand-` résiduels du HTML :** le `<body>` du layout racine et le composant `<Logo>` utilisent encore `bg-brand-cream`, `text-brand-ink` et `luxury-heading`. Ces deux fichiers sont **hors du périmètre de ce lot** — ils apparaissent sur toutes les pages du site, y compris la caisse en production. Leur présence dans le HTML est donc normale et attendue.

- [ ] **Étape 6 : remettre la base en état et nettoyer**

```bash
docker exec salonista-lot6 psql -U postgres -d beaute_marketplace -c \
  "UPDATE \"Offer\" SET \"publishedToMarketplace\"=false;"
kill %1
docker rm -f salonista-lot6
rm -f /tmp/accueil.html
```

- [ ] **Étape 7 : pousser la branche**

```bash
git status --short   # doit etre vide
git push -u origin design-lot6
```

`gh` n'est pas installé : la PR s'ouvre depuis l'URL que git affiche après le push.

---

## Contrôle visuel — pour l'utilisatrice

Aucun outil automatique ne dit si une page est réussie. À vérifier à l'œil, mobile **et** desktop :

1. **Le bas de l'accueil dans son ensemble** — fais défiler depuis le haut : la transition entre la partie déjà refaite (lot 2a) et celle-ci doit être invisible. C'est le vrai test de ce lot.
2. **Le CTA professionnel** — les deux boutons roses (« Rejoindre », « Devenir partenaire ») sont-ils les seules actions roses pleines de la page ?
3. **Le tutoiement** — « Tu as un salon ? » et « Monétise ton audience ». Clique l'un des deux : la page d'inscription qui s'ouvre tutoie aussi, le parcours est cohérent.
4. **La FAQ** — déplie une question, le `+` pivote-t-il en `×` ? Le texte est-il lisible ?
5. **Le pied de page** — les trois liens sont-ils confortables au doigt ? Le logo reste-t-il visible sur le fond sombre ?
6. **Après cela, le tour du site** : accueil, `/offres`, une fiche salon, une fiche offre, connexion, inscription. C'est le dernier lot — l'ensemble doit se tenir.

---

## Ce que ce plan ne fait pas

- Il ne supprime aucune section de la page.
- Il ne rend pas la bannière promo pilotée par les données : son texte reste en dur, ce qui est un sujet produit.
- Il ne touche pas aux trois blocs JSON-LD, ni à `buildFaqJsonLd()`, ni à `FAQ_ITEMS`.
- Il ne touche pas au haut de page (lignes 1-312), déjà livré au lot 2a.
- Il ne supprime aucun token `brand-*` ni `pos-*` de `globals.css`, ni aucune classe `.luxury-*` — 142 fichiers en dépendent, dont la caisse en production.
- Il ne touche ni au layout racine ni au composant `<Logo>`, qui gardent des classes `brand-*` visibles sur toutes les pages.
- **Il ne remplace pas les « DT » restants** du dépôt (méta-descriptions SEO, tableaux de bord admin, cliente, influenceuse, caisse — plus de douze fichiers). Chantier séparé, à faire d'un seul geste.
- Il ne corrige ni le contraste `text-white` sur `bg-rose` (2,94:1, sous le seuil AA de 4,5:1), ni le pattern ARIA tablist incomplet. Les deux concernent tout le site et sont documentés dans les lots précédents.
