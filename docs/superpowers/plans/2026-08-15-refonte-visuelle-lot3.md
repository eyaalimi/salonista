# Refonte visuelle lot 3 — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner la page `/offres`, la barre de navigation du bas et le menu de compte sur le design system.

**Architecture:** Trois fichiers restylés avec les six primitifs déjà livrés — aucun composant nouveau. La barre du bas d'abord (deux classes, visible partout), puis le menu de compte (réutilisé par les lots 4 et 5), puis la page elle-même.

**Tech Stack:** Next.js 16.2 (App Router), Tailwind v4, React 19.

**Spec:** [docs/superpowers/specs/2026-08-15-refonte-visuelle-lot3-design.md](../specs/2026-08-15-refonte-visuelle-lot3-design.md)

---

## Contexte pour l'ingénieur

**Salonista** est une marketplace beauté tunisienne. Trois lots de refonte
visuelle sont livrés, validés et **mergés dans `main`** : les fondations du
design system, la connexion, l'inscription et le haut de l'accueil.

L'utilisateur a signalé, capture à l'appui, que `/offres` garde l'ancienne charte
beige/doré. La barre du bas est dans le même état — et elle est visible sur
**toutes** les pages publiques.

**Huit choses à savoir avant de toucher au code :**

1. **NE SUPPRIME AUCUN token `brand-*` ni `pos-*`.** 142 fichiers en dépendent,
   dont la caisse en production. Tu remplaces des **usages** dans trois fichiers,
   jamais les définitions dans `globals.css`.

2. **`NavAccount` a trois fonctions à préserver absolument** : l'e-mail affiché,
   le lien vers l'espace **selon le rôle** (`dashboardByRole`), et la
   **déconnexion** (`signOut`). Une version antérieure du spec proposait de le
   remplacer par `HomeNav` — écarté justement parce que `HomeNav` n'a ni menu ni
   déconnexion et enverrait un prestataire vers l'espace cliente.

3. **`bottom-nav.tsx` contient trois choses à ne pas toucher** : la logique
   `HIDDEN_PREFIXES` (la caisse et les tableaux de bord ont leurs propres
   navigations), les cibles `min-h-[44px]` déjà correctes, et le
   `env(safe-area-inset-bottom)` pour les iPhone à encoche. Ce sont des
   correctifs acquis lors de lots antérieurs, pas du style.

4. **Quatre interdits à supprimer**, présents aujourd'hui :
   - `backdrop-blur-md` sur la barre de navigation de `/offres`
   - `hover:shadow-md` sur les cartes d'offre
   - `bg-gradient-to-br` sur les images sans photo
   - `backdrop-blur-sm` sur le badge de catégorie
   - **et `shadow-lg`** sur le menu déroulant de `NavAccount` — repéré en lisant
     le fichier, il ne figurait pas dans le spec.

5. **Aucun test n'est possible.** Vitest tourne en `environment: "node"` sans
   jsdom. N'ajoute pas de test, n'installe pas jsdom. `npm test` doit rester à
   **180 passants**.

6. **`npm run build` ne type-check pas** (`next.config.ts` porte
   `ignoreBuildErrors: true`). `npx tsc --noEmit` est le seul filet sur les
   types.

7. **« DT » devient « TND »** dans les prix — c'est la notation adoptée au lot
   2a sur le feed. Deux notations sur le même site prêtent à confusion.

8. **UI en français, tutoiement, sentence case.**

**Le design system, en rappel :** tout ce qui est cliquable est une pill ;
**aucune ombre**, aucun dégradé, aucun flou ; survol = couleur seule ; appui
`scale(0.97)` ; focus = anneau rose (classes `.ds-press` et `.ds-focus`) ; **une
seule action primaire rose par vue** ; menthe réservé à la disponibilité, aux
économies, aux commissions et aux confirmations ; cibles tactiles ≥ 44px ; corps
≥ 16px.

**Tokens :** `rose`, `rose-soft`, `prune`, `prune-soft`, `menthe`,
`menthe-deep`, `creme`, `hairline`. Rayons `--radius-pill`, `--radius-card`
(36px), `--radius-panel` (22px).

**Primitifs livrés** dans `src/components/ui/` — **lis-les avant de câbler** :
- `Button` : `variant?: "primary" | "secondary" | "ghost"`, `fullWidth?`
- `Input` : `label: string`, `id: string`, `trailing?: ReactNode`
- `Chip` : `href: string`, `active?: boolean` — **rend un `<Link>`**
- `Badge` : `tone?: "menthe" | "rose" | "prune"`
- `Card` : `className?: string`

**Commandes :**

```bash
npm run build         # verification principale
npx tsc --noEmit      # seul filet sur les types
npm run lint
npm test              # doit rester a 180
```

**Erreurs `tsc` pré-existantes :** deux fichiers,
`src/components/pos/onboarding/wizard-client.tsx` et
`src/lib/rewards/rewards.test.ts`. Vérifie qu'il ne s'en ajoute pas :

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
```

**Base requise pour le build :** `npm run build` prérend `/` et `/sitemap.xml`,
qui interrogent PostgreSQL :

```bash
docker run -d --name lot3-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=beaute_marketplace -p 5433:5432 postgres:16
npx prisma migrate deploy
```

---

## Structure des fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/components/bottom-nav.tsx` | Barre du bas, visible sur toutes les pages publiques | **Modifier** |
| `src/components/nav-account.tsx` | Menu de compte, réutilisé par les lots 4 et 5 | **Modifier** |
| `src/app/offres/page.tsx` | La page signalée par l'utilisateur | **Modifier** |

Aucun composant nouveau : les six primitifs existants couvrent tous les besoins.

L'ordre des tâches va du plus petit gain immédiat au plus gros : la barre du bas
profite à toutes les pages dès le premier commit.

---

## Task 0 : Créer la branche

**Files:** aucun

- [ ] **Step 1 : Vérifier que l'arbre est propre et à jour**

```bash
git status --short
git checkout main
git pull
```

- [ ] **Step 2 : Confirmer que les lots précédents sont bien là**

```bash
ls src/components/ui/
grep -c "color-rose\|color-prune\|color-creme" src/app/globals.css
```

Attendu : six fichiers (`badge`, `button`, `card`, `chip`, `input`,
`role-tabs`), et un compte > 0 pour les tokens. Si l'un manque, **arrête-toi** :
un lot antérieur n'est pas mergé.

- [ ] **Step 3 : Créer la branche**

```bash
git checkout -b design-lot3
```

---

## Task 1 : La barre du bas

**Pourquoi commencer par elle.** Deux classes de couleur, et elle est visible sur
toutes les pages publiques — c'est le meilleur rapport effort/bénéfice du lot.

**Files:**
- Modify: `src/components/bottom-nav.tsx`

- [ ] **Step 1 : Restyler la barre**

Remplace la `className` de l'élément `<nav>` :

```tsx
      className="fixed bottom-0 left-0 right-0 z-50 flex h-[60px] items-center justify-around border-t border-hairline bg-white md:hidden"
```

Seul `border-brand-line` devient `border-hairline`. **Le `style={{ paddingBottom:
"env(safe-area-inset-bottom)" }}` et le `aria-label` restent tels quels.**

- [ ] **Step 2 : Restyler les onglets**

Remplace la `className` du `<Link>` dans la boucle :

```tsx
            className={`ds-press flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 ${
              active ? "text-rose" : "text-prune-soft"
            }`}
```

L'actif passe de doré à rose, l'inactif à `prune-soft`. Le `min-h-[44px]
min-w-[44px]` **reste** : c'est la cible tactile, pas de la décoration.

- [ ] **Step 3 : Vérifier que la logique n'a pas bougé**

```bash
grep -c "HIDDEN_PREFIXES" src/components/bottom-nav.tsx
grep -c "safe-area-inset-bottom" src/components/bottom-nav.tsx
grep -c "brand-" src/components/bottom-nav.tsx
```

Attendu : `2`, `1`, et **`0`**. Si `HIDDEN_PREFIXES` ou la safe-area ont disparu,
tu as cassé un correctif acquis — rétablis-le.

- [ ] **Step 4 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint src/components/bottom-nav.tsx
```

- [ ] **Step 5 : Commit**

```bash
git add src/components/bottom-nav.tsx
git commit -m "feat(design): barre du bas au nouveau design system

Visible sur toutes les pages publiques. La logique de masquage et la
safe-area iPhone restent intactes — ce sont des correctifs acquis."
```

---

## Task 2 : Le menu de compte

**Pourquoi maintenant.** `NavAccount` apparaît sur `/offres` mais aussi sur les
fiches salon et offre : ce travail sert directement aux lots 4 et 5.

**Files:**
- Modify: `src/components/nav-account.tsx`

**Les trois fonctions à préserver** : l'e-mail affiché, le lien
`dashboardByRole`, et `signOut`. Tu ne touches qu'aux classes.

- [ ] **Step 1 : L'état de chargement**

Remplace :

```tsx
    return <div className="h-6 w-24 bg-brand-gold/10 animate-pulse" />;
```

par :

```tsx
    return <div className="h-9 w-24 rounded-[var(--radius-pill)] bg-rose-soft animate-pulse" />;
```

- [ ] **Step 2 : Le lien Connexion (visiteur anonyme)**

Remplace le `<Link href="/login">` et sa `className` par :

```tsx
      <Link
        href="/login"
        className="ds-press ds-focus inline-flex items-center min-h-[44px] px-4 rounded-[var(--radius-pill)] border-2 border-hairline text-base font-semibold text-prune hover:border-rose"
      >
        Connexion
      </Link>
```

Il passe de `text-xs` en majuscules espacées à du texte normal de 16px, et gagne
une cible tactile de 44px.

- [ ] **Step 3 : Le bouton du menu**

Remplace la `className` du `<button onClick={() => setMenuOpen(!menuOpen)}>` :

```tsx
        className="ds-press ds-focus flex items-center gap-2 min-h-[44px] px-3 rounded-[var(--radius-pill)] border-2 border-hairline hover:border-rose"
```

et l'initiale qu'il contient :

```tsx
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose text-xs font-bold text-white">
          {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || "?"}
        </span>
        <span className="text-sm font-semibold text-prune hidden sm:inline">
          {session.user.name?.split(" ")[0] || "Compte"}
        </span>
        <svg className={`w-3 h-3 text-prune-soft transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
```

- [ ] **Step 4 : Le menu déroulant**

Remplace le bloc `{menuOpen && (…)}` en entier par :

```tsx
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-[var(--radius-panel)] border-2 border-hairline bg-white">
          <div className="px-4 py-3 border-b border-hairline">
            <p className="text-sm text-prune-soft truncate">{session.user.email}</p>
          </div>
          <Link
            href={dashboardByRole[session.user.role]?.href || "/"}
            onClick={() => setMenuOpen(false)}
            className="block px-4 py-3 text-base font-semibold text-prune hover:bg-creme"
          >
            {dashboardByRole[session.user.role]?.label || "Mon espace"}
          </Link>
          <button
            onClick={() => {
              setMenuOpen(false);
              signOut({ callbackUrl: "/" });
            }}
            className="w-full text-left px-4 py-3 text-base text-prune-soft hover:bg-creme border-t border-hairline"
          >
            Se déconnecter
          </button>
        </div>
      )}
```

Le `shadow-lg` disparaît : le menu se détache par sa bordure, pas par une
élévation. **Les appels `dashboardByRole` et `signOut` sont repris à
l'identique.**

- [ ] **Step 5 : Vérifier que les fonctions survivent**

```bash
grep -c "dashboardByRole" src/components/nav-account.tsx
grep -c "signOut" src/components/nav-account.tsx
grep -c "session.user.email" src/components/nav-account.tsx
grep -cE "brand-|shadow" src/components/nav-account.tsx
```

Attendu : `3` (déclaration + deux usages), `2` (import + appel), `2` (l'initiale
de repli dans le bouton, plus l'affichage dans le menu), et **`0`**.

Ces trois premiers comptes sont ceux de la version actuelle, vérifiés avant
d'écrire ce plan. **S'ils baissent, tu as supprimé une fonction** — rétablis-la.

- [ ] **Step 6 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint src/components/nav-account.tsx
```

- [ ] **Step 7 : Commit**

```bash
git add src/components/nav-account.tsx
git commit -m "feat(design): menu de compte au nouveau design system

Ses trois fonctions sont preservees : email affiche, lien vers l'espace
selon le role, deconnexion. Le shadow-lg du menu disparait."
```

---

## Task 3 : L'en-tête et le titre de /offres

**Files:**
- Modify: `src/app/offres/page.tsx`

- [ ] **Step 1 : Ajouter les imports**

En haut du fichier, après l'import de `Logo` :

```tsx
import { Chip } from "@/components/ui/chip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
```

- [ ] **Step 2 : Le conteneur racine et la barre de navigation**

Remplace la `className` du `<div>` racine par `min-h-screen bg-creme`, puis la
barre :

```tsx
      <nav className="bg-creme border-b border-hairline sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-5 md:px-12 flex items-center justify-between h-16">
          <Logo className="text-xl" />
          <NavAccount />
        </div>
      </nav>
```

Le `bg-white/80 backdrop-blur-md` disparaît — « no glass, no blur ».

- [ ] **Step 3 : Le titre**

Remplace tout le bloc `<div className="text-center mb-12">` par :

```tsx
        <div className="text-center mb-10 flex flex-col gap-2">
          <h1 className="ds-display text-3xl md:text-4xl text-prune">
            {q ? (
              <>Résultats pour « {q} »</>
            ) : category ? (
              <>{categoryLabels[category] || category}</>
            ) : (
              <>Nos offres beauté</>
            )}
          </h1>
          <p className="text-base text-prune-soft">
            {offers.length} offre{offers.length > 1 ? "s" : ""} disponible{offers.length > 1 ? "s" : ""}
          </p>
        </div>
```

Le badge « Collection » et le `luxury-divider` disparaissent : ni l'un ni l'autre
n'existe dans le design system, et un pseudo-badge entrerait en conflit avec le
primitif `Badge`, dont le sens est précis (menthe = disponibilité, rose =
remise).

Le titre garde ses trois états — recherche, catégorie, défaut — car ils
informent réellement sur l'endroit où l'on se trouve.

- [ ] **Step 4 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint src/app/offres/page.tsx
```

À ce stade le fichier contient encore des classes `brand-*` plus bas — c'est
normal, les Tasks 4 et 5 les traitent.

- [ ] **Step 5 : Commit**

```bash
git add src/app/offres/page.tsx
git commit -m "feat(design): en-tete et titre de /offres

Le badge « Collection » disparait : un pseudo-badge entrerait en conflit
avec le primitif Badge, dont le sens est precis."
```

---

## Task 4 : La recherche et les filtres

**Files:**
- Modify: `src/app/offres/page.tsx`

**Ne touche pas** au `action="/offres" method="GET"` du formulaire ni aux `href`
des filtres : ce sont eux qui font fonctionner la recherche et le filtrage.

- [ ] **Step 1 : Le formulaire de recherche**

Remplace le `<form>` et son contenu par :

```tsx
          <form action="/offres" method="GET" className="mx-auto flex max-w-2xl gap-2">
            <input
              type="text"
              name="q"
              defaultValue={q || ""}
              placeholder="Cherche un soin, un salon…"
              aria-label="Rechercher"
              className="ds-focus flex-1 min-h-[52px] rounded-[var(--radius-pill)] border-2 border-hairline bg-white px-5 text-base text-prune placeholder:text-prune-soft/60"
            />
            <button
              type="submit"
              className="ds-press ds-focus shrink-0 min-h-[52px] px-6 rounded-[var(--radius-pill)] bg-rose text-base font-semibold text-white hover:bg-[#F04A79]"
            >
              Rechercher
            </button>
          </form>
```

Le bloc rectangulaire soudé devient deux pills séparées. Le bouton est
l'**unique action primaire rose** de la page.

- [ ] **Step 2 : Les filtres de catégorie**

Remplace le `<div className="flex gap-2 justify-center flex-wrap">` et son
contenu par :

```tsx
          <div className="flex gap-2 justify-center flex-wrap">
            <Chip href="/offres" active={!category}>
              Toutes
            </Chip>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <Chip
                key={key}
                href={`/offres?category=${key}`}
                active={category === key}
              >
                {label}
              </Chip>
            ))}
          </div>
```

Les chips passent de carrés-majuscules à des pills en casse normale, et gagnent
la cible tactile de 44px que la version actuelle n'a pas.

- [ ] **Step 3 : Vérifier que la recherche fonctionne toujours**

```bash
grep -c 'action="/offres"' src/app/offres/page.tsx
grep -c 'href={`/offres?category=' src/app/offres/page.tsx
```

Attendu : `1` et `1`. Si l'un vaut `0`, la navigation est cassée.

- [ ] **Step 4 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint src/app/offres/page.tsx
```

- [ ] **Step 5 : Commit**

```bash
git add src/app/offres/page.tsx
git commit -m "feat(design): recherche et filtres de /offres

Les chips gagnent la cible tactile de 44px que la version carree n'avait
pas."
```

---

## Task 5 : Les cartes d'offre et l'état vide

**Files:**
- Modify: `src/app/offres/page.tsx`

- [ ] **Step 1 : La carte**

Remplace le `<Link>` de la boucle et tout son contenu par :

```tsx
              <Link
                key={offer.id}
                href={`/offre/${offer.id}`}
                className="ds-press block"
              >
                <Card className="flex h-full flex-col">
                  <div className="relative aspect-[4/5] w-full bg-rose-soft">
                    {offer.photos.length > 0 ? (
                      <UploadedImage
                        src={offer.photos[0]}
                        alt={offer.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-6xl opacity-40">
                        💇‍♀️
                      </div>
                    )}
                    <span className="absolute left-3 top-3">
                      <Badge tone="prune">
                        {categoryLabels[offer.category] || offer.category}
                      </Badge>
                    </span>
                    {discount > 0 && (
                      <span className="absolute right-3 top-3">
                        <Badge tone="rose">-{discount}%</Badge>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <p className="line-clamp-1 text-sm text-prune-soft">
                      {offer.provider.salonName}
                      {offer.provider.city && ` · ${offer.provider.city}`}
                    </p>
                    <h3 className="line-clamp-2 text-base font-semibold leading-snug text-prune">
                      {offer.title}
                    </h3>
                    <div className="mt-auto flex flex-col gap-0.5 pt-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-rose">
                          {Number(offer.discountPrice).toFixed(0)} TND
                        </span>
                        {Number(offer.originalPrice) > Number(offer.discountPrice) && (
                          <span className="text-sm text-prune-soft line-through">
                            {Number(offer.originalPrice).toFixed(0)} TND
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-prune-soft">
                        TVA incluse : {Number(offer.taxRate ?? 19)}%
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
```

Trois interdits disparaissent ici : `hover:shadow-md`, `bg-gradient-to-br` et le
`backdrop-blur-sm` du badge de catégorie. Le `group-hover:scale-105` de l'image
part aussi — le design system dit « hover changes colour only ».

**« DT » devient « TND »**, comme sur le feed du lot 2a. La mention de TVA reste :
elle est utile et légalement pertinente.

- [ ] **Step 2 : L'état vide**

Remplace :

```tsx
          <p className="text-center text-brand-bordeaux/40 py-20 text-sm tracking-wider">
            Aucune offre disponible pour le moment.
          </p>
```

par :

```tsx
          <p className="text-center text-base text-prune-soft py-20">
            Aucune offre disponible pour le moment.
          </p>
```

Facile à oublier — il ne s'affiche que quand la liste est vide.

- [ ] **Step 3 : Vérifier qu'il ne reste rien de l'ancienne charte**

```bash
grep -cE "brand-" src/app/offres/page.tsx
grep -nE "shadow|gradient|blur" src/app/offres/page.tsx || echo "AUCUN interdit — correct"
grep -c "DT" src/app/offres/page.tsx
```

Attendu : **`0`**, `AUCUN interdit — correct`, et **`0`** pour « DT ».

- [ ] **Step 4 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint src/app/offres/page.tsx
npm test
```

Attendu : seuls les deux fichiers pré-existants, ESLint silencieux, **180 tests**.

- [ ] **Step 5 : Commit**

```bash
git add src/app/offres/page.tsx
git commit -m "feat(design): cartes d'offre et etat vide

Trois interdits supprimes : hover:shadow-md, bg-gradient-to-br et
backdrop-blur-sm. DT devient TND, comme sur le feed."
```

---

## Task 6 : Vérification

**Files:** aucun

- [ ] **Step 1 : Construire**

```bash
docker start lot3-db 2>/dev/null || docker run -d --name lot3-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=beaute_marketplace \
  -p 5433:5432 postgres:16
npx prisma migrate deploy
npm run build
```

Attendu : **build réussi**.

- [ ] **Step 2 : Servir et contrôler**

```bash
npx next start -p 3810
```

Port peu commun volontairement : un serveur oublié servirait un ancien build.

**Attention** — l'accueil et `/offres` sont prérendus au build. Si la base est
vide, la page affichera « Aucune offre disponible » et c'est normal.

- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:3810/offres` → `200`.
- [ ] `curl -s http://localhost:3810/offres | grep -cE "gradient-to|blur-3xl|backdrop-blur"` → `0`.
- [ ] `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3810/offres?q=coupe"` → `200`.
- [ ] `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3810/offres?category=COIFFURE"` → `200`.
- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:3810/` → `200`
      (non-régression du lot 2a).
- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:3810/login` → `200`
      (non-régression des lots 1 et 1b).

- [ ] **Step 3 : Contrôle visuel — c'est l'utilisateur qui tranche**

- [ ] Sur **mobile** (DevTools, iPhone SE 375px) : la barre du bas est rose sur
      l'onglet actif, le titre et les chips tiennent sans débordement.
- [ ] Sur **desktop** : la grille de cartes reste lisible.
- [ ] **La recherche fonctionne** : taper un mot, valider, les résultats
      s'affichent et le titre devient « Résultats pour « … » ».
- [ ] **Les filtres fonctionnent** : cliquer une catégorie filtre la liste et le
      chip devient rose.
- [ ] Connecté : le menu de compte s'ouvre, affiche l'e-mail, mène au bon espace,
      et la **déconnexion fonctionne**.
- [ ] La barre du bas **n'apparaît pas** sur `/pos`.
- [ ] Aucune ombre visible ; les cartes se détachent par leur couleur.

- [ ] **Step 4 : Nettoyer**

```bash
docker rm -f lot3-db
git status --short
```

---

## Task 7 : Pousser et préparer la pull request

**Files:** aucun

- [ ] **Step 1 : Vérification finale**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

- [ ] **Step 2 : Pousser**

```bash
git push -u origin design-lot3
```

- [ ] **Step 3 : Ouvrir la PR**

`gh` n'est pas installé. Après le push, GitHub affiche une URL
`https://github.com/eyaalimi/salonista/pull/new/design-lot3` — utilise ce corps :

```markdown
Aligne `/offres`, la barre du bas et le menu de compte sur le design system.

## Ce qui change

- **La barre du bas** — visible sur toutes les pages publiques : onglet actif en rose. Sa logique de masquage (la caisse a sa propre navigation) et la safe-area iPhone restent intactes.
- **Le menu de compte** — restylé en gardant ses trois fonctions : e-mail affiché, lien vers l'espace **selon le rôle**, déconnexion. Il apparaît aussi sur les fiches salon et offre, donc ce travail sert aux lots suivants.
- **`/offres`** — titre en Bricolage Grotesque, recherche en deux pills, chips via le primitif `Chip`, cartes via `Card` et `Badge`.

## Décisions notables

Le badge « Collection » disparaît : un pseudo-badge serait entré en conflit avec le primitif `Badge`, dont le sens est précis dans le système (menthe = disponibilité, rose = remise).

**`NavAccount` n'est pas remplacé par `HomeNav`**, comme envisagé d'abord. La lecture du code a montré que `HomeNav` n'a ni menu ni déconnexion, et enverrait un prestataire vers l'espace cliente. L'unification des deux barres reste souhaitable, mais c'est une décision produit à traiter à part.

**Cinq interdits supprimés** : `backdrop-blur-md` sur la nav, `hover:shadow-md` sur les cartes, `bg-gradient-to-br` sur les images sans photo, `backdrop-blur-sm` sur le badge de catégorie, et `shadow-lg` sur le menu déroulant.

Les chips gagnent au passage la cible tactile de 44px que la version carrée n'avait pas.

## Vérification

`npm run build` réussi · `tsc --noEmit` (seules restent les erreurs pré-existantes) · `eslint` propre · `npm test` 180/180 · **zéro** classe `brand-*` dans les trois fichiers · aucun `shadow`/`gradient`/`blur`.

Recherche, filtres par catégorie et déconnexion vérifiés de bout en bout.

## Suite

Lot 4 : la fiche salon (551 lignes). Lot 5 : la fiche offre (549 lignes). Lot 6 : le bas de l'accueil.
```

**Ne merge pas toi-même** — un push sur `main` déclenche le déploiement.

---

## Notes de conception

**Pourquoi la barre du bas en premier ?** Deux classes à changer pour un effet
sur toutes les pages publiques. Aucun autre changement du lot n'a ce ratio.

**Pourquoi restyler `NavAccount` plutôt que le remplacer ?** Il porte trois
fonctions que `HomeNav` n'a pas : le menu, la redirection par rôle et la
déconnexion. Le remplacer aurait supprimé la déconnexion et envoyé les
prestataires au mauvais endroit. Le restyler profite en plus aux lots 4 et 5, où
il apparaît aussi.

**Pourquoi supprimer `group-hover:scale-105` sur les images ?** Le design system
dit « hover changes colour only ». Un agrandissement au survol est un mouvement,
pas une couleur.

**Pourquoi garder la mention de TVA ?** Elle est utile à la cliente et
légalement pertinente en Tunisie. Seul son style change.
