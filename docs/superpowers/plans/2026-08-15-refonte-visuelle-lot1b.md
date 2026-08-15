# Refonte visuelle lot 1b — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner la page d'inscription sur le design system livré au lot 1, sans rien changer à son fonctionnement.

**Architecture:** Un seul fichier réécrit — `register-client.tsx` — en réutilisant les primitifs `Button` et `Input` déjà livrés et validés. Toute la logique (deux étapes, champs, appel API, `needsVerification`, lecture de `?role=`) est reproduite telle quelle ; seuls les classes et le balisage de présentation changent.

**Tech Stack:** Next.js 16.2 (App Router), Tailwind v4, React 19, TypeScript.

**Spec:** [docs/superpowers/specs/2026-08-15-refonte-visuelle-lot1b-design.md](../specs/2026-08-15-refonte-visuelle-lot1b-design.md)

---

## Contexte pour l'ingénieur

**Salonista** est une marketplace beauté tunisienne. Le lot 1 a installé un
nouveau design system et refait la page de connexion, validée par l'utilisateur.
**`design-lot1` est mergée dans `main`** — vérifié — donc les tokens et les
primitifs sont disponibles.

`/register` garde l'ancienne charte beige/doré/Playfair. Or les trois onglets du
login **mènent directement à cette page** : chaque nouvelle inscription voit la
rupture visuelle.

**La contrainte posée par l'utilisateur, mot pour mot :**

> « l'essentiel, ne touche à rien dans les données, seulement le design »

**Ce qui doit rester strictement intact :**

| Élément | État attendu |
|---|---|
| Les 5 champs et leurs `useState` | intacts |
| `POST /api/register` et son corps `{ email, password, name, phone, role, instagramHandle }` | intact |
| `handleSubmit` en entier | intact |
| Logique des deux étapes, bouton « Changer » | intacte |
| Champ Instagram conditionnel à `role === "INFLUENCER"` | intact |
| `needsVerification` et son écran | logique intacte, style refait |
| Lecture de `?role=` et saut d'étape (lot 1) | intacts |
| `required`, `minLength={8}`, `type="email"` | intacts |
| Le bouton Google de l'étape 1 | conservé |

**Sept choses à savoir :**

1. **Ce fichier a TROIS écrans, pas deux.** Étape 1 (choix du profil), étape 2
   (formulaire), et l'écran `needsVerification` (« Vérifiez votre email ») rendu
   par un `return` anticipé ligne ~107. Facile à oublier — il resterait beige au
   milieu d'un parcours refait.

2. **L'étape 1 contient un bouton « Continuer avec Google »** avec un séparateur
   « ou » et un logo SVG inline. Il est conservé : le supprimer retirerait une
   façon de s'inscrire.

3. **Les primitifs existent déjà** dans `src/components/ui/` — lis-les avant de
   les câbler :
   - `Button` : `variant?: "primary" | "secondary" | "ghost"`, `fullWidth?`,
     plus tous les attributs d'un `<button>`.
   - `Input` : `label: string`, `id: string`, `trailing?: ReactNode`, plus tous
     les attributs d'un `<input>`.

4. **Tokens disponibles** : `rose`, `rose-soft`, `prune`, `prune-soft`, `menthe`,
   `menthe-deep`, `creme`, `hairline`. Plus les classes `.ds-press`, `.ds-focus`,
   `.ds-display` et les rayons `--radius-pill`, `--radius-card`,
   `--radius-panel`.

5. **Le design system interdit** : `shadow-*`, `bg-gradient-*`, `blur-*`. La page
   actuelle contient les trois — elle a le même panneau décoratif que l'ancien
   login.

6. **Aucun test n'est possible.** Vitest tourne en `environment: "node"` sans
   jsdom. N'ajoute pas de test, n'installe pas jsdom. `npm test` doit rester à
   **169 passants**.

7. **UI en français, tutoiement, sentence case.**

**Commandes :**

```bash
npm run build         # verification principale
npx tsc --noEmit      # seul filet sur les types (le build ne type-check pas)
npm run lint
npm test              # doit rester a 169
```

**Erreurs `tsc` pré-existantes :** deux fichiers,
`src/components/pos/onboarding/wizard-client.tsx` et
`src/lib/rewards/rewards.test.ts`. Vérifie qu'il ne s'en ajoute pas :

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
```

**Attention build :** `npm run build` prérend `/` et `/sitemap.xml`, qui
interrogent la base. Sans PostgreSQL il échoue sur `ECONNREFUSED localhost:5433`
**avant** d'atteindre tes pages :

```bash
docker run -d --name lot1b-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=beaute_marketplace -p 5433:5432 postgres:16
npx prisma migrate deploy
```

---

## Structure des fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/app/(auth)/register/register-client.tsx` | Les trois écrans d'inscription | **Modifier** |

Un seul fichier. Aucun nouveau primitif : les cartes de l'étape 1 n'ont qu'un
usage, et le lot 2 (le feed) nous dira à quoi doit ressembler une `Card`
partagée.

---

## Task 0 : Créer la branche

**Files:** aucun

- [ ] **Step 1 : Vérifier que l'arbre est propre et à jour**

```bash
git status --short
git checkout main
git pull
```

Attendu : `git status --short` ne renvoie rien.

- [ ] **Step 2 : Confirmer que le lot 1 est bien là**

```bash
ls src/components/ui/
grep -c "color-rose\|color-prune\|color-creme" src/app/globals.css
```

Attendu : `button.tsx`, `input.tsx`, `role-tabs.tsx` présents, et un compte > 0
pour les tokens. Si l'un manque, **arrête-toi** : la branche du lot 1 n'est pas
mergée et ce plan ne peut pas s'appliquer.

- [ ] **Step 3 : Créer la branche**

```bash
git checkout -b design-lot1b
```

Attendu : `Switched to a new branch 'design-lot1b'`

---

## Task 1 : L'écran de vérification

**Pourquoi commencer par lui.** C'est le plus petit des trois écrans et le plus
facile à oublier. Le faire d'abord garantit qu'il ne passe pas à la trappe.

**Files:**
- Modify: `src/app/(auth)/register/register-client.tsx`

- [ ] **Step 1 : Ajouter les imports des primitifs**

En haut du fichier, à la suite des imports existants (`signIn`, `useState`,
`useRouter`, `useSearchParams`, `Link`, `Logo`), ajoute :

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
```

`Input` ne sert qu'à la Task 3 ; l'importer maintenant évite de rouvrir le bloc.
S'il déclenche un avertissement ESLint « unused » à cette étape, ignore-le : la
Task 3 l'utilise.

- [ ] **Step 2 : Remplacer le bloc `if (needsVerification)`**

Trouve le bloc qui commence par `if (needsVerification) {` (autour de la ligne
107) et remplace-le **entièrement**, jusqu'à son accolade fermante, par :

```tsx
  if (needsVerification) {
    return (
      <div className="min-h-screen bg-creme flex flex-col items-center justify-center px-5 py-10 gap-8">
        <Link href="/" className="ds-display text-4xl text-prune">
          Salonista<span className="text-rose">.</span>
        </Link>

        <div className="w-full max-w-[420px] rounded-[var(--radius-card)] bg-white p-6 sm:p-8 flex flex-col gap-5 text-center">
          <h2 className="ds-display text-2xl text-prune">Vérifie ton e-mail</h2>

          <div className="flex flex-col gap-1">
            <p className="text-base text-prune-soft">Un e-mail a été envoyé à</p>
            <p className="text-base font-semibold text-prune">{email}</p>
          </div>

          <p className="text-sm text-prune-soft">
            Clique sur le lien pour activer ton compte. Il expire dans 24 heures.
          </p>

          <Link
            href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login"}
            className="ds-press ds-focus inline-flex items-center justify-center min-h-[48px] px-6 rounded-[var(--radius-pill)] bg-rose text-white text-base font-semibold hover:bg-[#F04A79]"
          >
            Aller à la connexion
          </Link>
        </div>
      </div>
    );
  }
```

Trois choses à noter :

- Les accents sont corrigés (« Vérifie ton e-mail », « a été envoyé ») et le
  texte passe au tutoiement — la seule modification de contenu autorisée par le
  spec.
- L'icône d'enveloppe carrée disparaît : elle était dessinée avec une bordure
  dorée qui n'existe plus.
- Le lien de sortie est un `<Link>` stylé comme un bouton, **pas** un
  `<Button>` : `Button` rend un `<button>`, qui ne navigue pas. Les classes
  reproduisent la variante `primary`.

- [ ] **Step 3 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npm test
```

Attendu : seuls les deux fichiers pré-existants ; 169 tests.

- [ ] **Step 4 : Commit**

```bash
git add "src/app/(auth)/register/register-client.tsx"
git commit -m "feat(design): ecran de verification au nouveau design system

Accents corriges au passage — « Verifiez votre email » etait le seul
texte non accentue du parcours."
```

---

## Task 2 : L'ossature et l'étape 1

**Files:**
- Modify: `src/app/(auth)/register/register-client.tsx`

L'ossature actuelle est le même écran scindé que l'ancien login : un panneau
décoratif `hidden lg:flex lg:w-1/2` avec dégradé et deux flous, invisible sous
`lg`. Il disparaît au profit d'une colonne centrée unique.

- [ ] **Step 1 : Remplacer l'ouverture du `return` principal**

Trouve le `return (` principal (autour de la ligne 135, celui qui suit l'écran de
vérification) et remplace tout le bloc depuis
`<div className="min-h-screen flex bg-brand-cream">` jusqu'à la ligne
`{error && (` **exclue**, par :

```tsx
    <div className="min-h-screen bg-creme flex flex-col items-center justify-center px-5 py-10 gap-8">
      <div className="flex flex-col items-center gap-3">
        <Link href="/" className="ds-display text-4xl text-prune">
          Salonista<span className="text-rose">.</span>
        </Link>
        <p className="text-base text-prune-soft">
          {step === 1 ? "Choisis ton profil." : "Crée ton compte."}
        </p>
      </div>

      <div className="w-full max-w-[420px] rounded-[var(--radius-card)] bg-white p-6 sm:p-8 flex flex-col gap-6">
```

L'import de `Logo` devient inutilisé si plus rien ne l'emploie — retire-le des
imports le cas échéant, ESLint le signalerait.

- [ ] **Step 2 : Restyler le bloc d'erreur**

Remplace :

```tsx
            <div className="mb-6 p-3 text-sm text-red-600 bg-red-50 border border-red-100">
              {error}
            </div>
```

par :

```tsx
          <p
            role="alert"
            className="rounded-[var(--radius-panel)] bg-rose-soft px-4 py-3 text-sm text-prune"
          >
            {error}
          </p>
```

Le `role="alert"` fait annoncer l'erreur par les lecteurs d'écran — la version
actuelle ne le fait pas.

- [ ] **Step 3 : Restyler les trois cartes de profil**

Remplace le bloc `{step === 1 ? (` et son contenu jusqu'au séparateur « ou »
**exclu**, par :

```tsx
          {step === 1 ? (
            <div className="flex flex-col gap-3">
              {roles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    setRole(r.value);
                    setStep(2);
                  }}
                  className="ds-press ds-focus w-full text-left p-5 rounded-[var(--radius-card)] border-2 border-hairline bg-white hover:border-rose"
                >
                  <p className="text-base font-semibold text-prune">{r.label}</p>
                  <p className="text-sm text-prune-soft mt-1">{r.description}</p>
                </button>
              ))}
```

**Aucune carte n'est rose par défaut** : la règle veut une seule action primaire
par vue, et les trois profils sont équivalents. Le rose n'apparaît qu'au survol
et au focus.

`onClick` conserve exactement `setRole(r.value)` puis `setStep(2)` — c'est de la
logique, on n'y touche pas.

- [ ] **Step 4 : Restyler le séparateur et le bouton Google**

Remplace le bloc du séparateur « ou » et le bouton Google qui suit par :

```tsx
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-hairline" />
                <span className="text-sm text-prune-soft">ou</span>
                <span className="h-px flex-1 bg-hairline" />
              </div>

              <Button
                type="button"
                variant="ghost"
                fullWidth
                onClick={() => signIn("google", { callbackUrl: "/api/auth/redirect" })}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continuer avec Google
              </Button>
            </div>
```

Le SVG Google garde ses couleurs officielles — ce sont celles de Google, pas les
nôtres. L'appel `signIn("google", …)` est inchangé.

- [ ] **Step 5 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint "src/app/(auth)/register/register-client.tsx"
```

À ce stade la Task 3 n'est pas faite, donc le fichier peut encore contenir des
classes `brand-*` dans l'étape 2 — c'est normal.

- [ ] **Step 6 : Commit**

```bash
git add "src/app/(auth)/register/register-client.tsx"
git commit -m "feat(design): ossature et etape 1 de l'inscription

L'ecran scinde disparait : sa moitie gauche etait invisible sous lg, ce
qui donnait deux experiences differentes. Le bouton Google est conserve."
```

---

## Task 3 : L'étape 2, le formulaire

**Files:**
- Modify: `src/app/(auth)/register/register-client.tsx`

Les cinq champs écrits à la main deviennent des `<Input>`. **Chaque `id`, `type`,
`value`, `onChange`, `required`, `minLength` et `placeholder` est repris à
l'identique** — seule la présentation change.

- [ ] **Step 1 : Remplacer le bloc « Profil »**

Remplace le `<div className="p-4 border border-brand-gold/20 …">` et son contenu
par :

```tsx
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-panel)] bg-creme px-4 py-3">
                <span className="text-sm text-prune-soft">
                  Profil :{" "}
                  <strong className="font-semibold text-prune">
                    {roles.find((r) => r.value === role)?.label}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="ds-focus text-sm font-semibold text-rose px-2 py-1 rounded-[var(--radius-pill)]"
                >
                  Changer
                </button>
              </div>
```

`--radius-panel` (22px) est le rayon des panneaux imbriqués — la carte qui le
contient est à 36px.

- [ ] **Step 2 : Remplacer les cinq champs**

Remplace les cinq blocs `<div><label…><input…/></div>` par :

```tsx
              <Input
                id="name"
                label="Nom complet"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ton nom"
              />

              <Input
                id="reg-email"
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="toi@exemple.com"
              />

              <Input
                id="phone"
                label="Téléphone (optionnel)"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+216 XX XXX XXX"
              />

              {role === "INFLUENCER" && (
                <Input
                  id="instagram"
                  label="Pseudo Instagram"
                  type="text"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  required
                  placeholder="@tonpseudo"
                />
              )}

              <Input
                id="reg-password"
                label="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Min. 8 caractères"
              />
```

Les placeholders passent au tutoiement (« Ton nom », « toi@exemple.com »,
« @tonpseudo ») pour s'aligner sur le reste. Les `id`, `required` et `minLength`
sont inchangés.

**La condition `role === "INFLUENCER"` reste exactement la même** : c'est de la
logique.

- [ ] **Step 3 : Remplacer le bouton de soumission**

```tsx
              <Button type="submit" fullWidth disabled={loading}>
                {loading ? "Création…" : "Créer mon compte"}
              </Button>
```

- [ ] **Step 4 : Remplacer le pied de page**

Remplace le `<p className="text-center text-xs text-brand-bordeaux/40 mt-8 …">`
final et son contenu par :

```tsx
      <p className="text-sm text-prune-soft">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-semibold text-rose">
          Se connecter
        </Link>
      </p>
```

**Attention à l'imbrication.** Ce paragraphe sort de la carte blanche pour se
placer sous elle, comme sur la page de connexion. La structure actuelle se ferme
par **trois** `</div>` (le conteneur `max-w-sm`, la colonne droite, le conteneur
racine) ; la nouvelle n'en a que **deux**. La fin du fichier doit donc ressembler
exactement à ceci :

```tsx
            </form>
          )}
        </div>

        <p className="text-sm text-prune-soft">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-semibold text-rose">
            Se connecter
          </Link>
        </p>
      </div>
    );
  }
```

Le `</div>` avant le `<p>` ferme la carte blanche ; celui d'après ferme le
conteneur racine. Si `tsc` signale une balise non fermée, c'est ici.

- [ ] **Step 5 : Vérifier qu'aucune trace de l'ancienne charte ne subsiste**

```bash
grep -cE "brand-" "src/app/(auth)/register/register-client.tsx"
```

Attendu : **0**.

```bash
grep -nE "shadow|gradient|blur" "src/app/(auth)/register/register-client.tsx" || echo "AUCUN interdit — correct"
```

Attendu : `AUCUN interdit — correct`.

- [ ] **Step 6 : Vérifier que la logique est intacte**

```bash
git diff main -- "src/app/(auth)/register/register-client.tsx" | grep "^-" | grep -E "fetch\(|/api/register|JSON.stringify|setNeedsVerification|signIn\(" || echo "AUCUNE ligne de logique supprimee — correct"
```

Attendu : `AUCUNE ligne de logique supprimee — correct`. Si une ligne apparaît,
tu as touché à la logique : rétablis-la.

- [ ] **Step 7 : Vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -oE "^[^ (]+\.tsx?" | sort -u
npx eslint "src/app/(auth)/register/register-client.tsx"
npm test
```

Attendu : seuls les deux fichiers pré-existants, ESLint silencieux, 169 tests.

- [ ] **Step 8 : Commit**

```bash
git add "src/app/(auth)/register/register-client.tsx"
git commit -m "feat(design): etape 2 de l'inscription avec les primitifs

Les cinq champs deviennent des <Input> : hauteurs, focus et cibles
tactiles alignes sur la page de connexion."
```

---

## Task 4 : Vérification

**Files:** aucun

- [ ] **Step 1 : Construire**

```bash
docker start lot1b-db 2>/dev/null || docker run -d --name lot1b-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=beaute_marketplace \
  -p 5433:5432 postgres:16
npx prisma migrate deploy
npm run build
```

Attendu : **build réussi**.

- [ ] **Step 2 : Servir et contrôler**

```bash
npx next start -p 3610
```

Port peu commun volontairement : un serveur oublié sur 3000 servirait un ancien
build et fausserait tout.

- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:3610/register` → `200`.
- [ ] `curl -s "http://localhost:3610/register" | grep -cE "gradient-to|blur-3xl"` → `0`.
- [ ] `curl -s "http://localhost:3610/register?role=PROVIDER" | grep -c "Prestataire"` → au moins 1
      (l'étape 2 s'affiche avec le profil rappelé).
- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:3610/login` → `200`
      (non-régression du lot 1).

- [ ] **Step 3 : Contrôle visuel — c'est l'utilisateur qui tranche**

Ouvrir `http://localhost:3610/register` et vérifier :

- [ ] Sur **mobile** (DevTools, iPhone SE 375px) : tout tient, rien ne déborde.
- [ ] Sur **desktop** : carte centrée, ni étirée ni collée en haut.
- [ ] Les trois cartes de profil réagissent au survol (bordure rose) et mènent à
      l'étape 2.
- [ ] Le bouton « Changer » ramène à l'étape 1.
- [ ] Le champ Instagram n'apparaît **que** pour le profil influenceuse.
- [ ] **Une inscription réelle crée un compte** et affiche l'écran
      « Vérifie ton e-mail » — c'est le point de non-régression qui compte.
- [ ] Le parcours complet : `/login` → onglet « Salon » → l'inscription s'ouvre à
      l'étape 2 avec « Prestataire » déjà choisi.
- [ ] Aucune ombre visible ; les cartes se détachent par leur couleur.

- [ ] **Step 4 : Nettoyer**

```bash
docker rm -f lot1b-db
git status --short
```

Attendu : arbre propre.

---

## Task 5 : Pousser et préparer la pull request

**Files:** aucun

- [ ] **Step 1 : Vérification finale**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

- [ ] **Step 2 : Pousser**

```bash
git push -u origin design-lot1b
```

- [ ] **Step 3 : Ouvrir la PR**

`gh` n'est pas installé. Après le push, GitHub affiche une URL
`https://github.com/eyaalimi/salonista/pull/new/design-lot1b` — ouvre-la et
utilise ce corps :

```markdown
Aligne la page d'inscription sur le design system du lot 1.

## Pourquoi

Les trois onglets de la page de connexion mènent directement à `/register`, qui gardait l'ancienne charte beige/doré. Chaque nouvelle inscription voyait la rupture.

## Ce qui change

- **Les trois écrans** sont refaits : choix du profil, formulaire, et l'écran « Vérifie ton e-mail » — ce dernier est rendu par un `return` anticipé et se serait facilement oublié.
- **Les cinq champs deviennent des `<Input>`** du lot 1 : hauteurs, états de focus et cibles tactiles enfin identiques à ceux du login.
- **L'écran scindé disparaît.** Sa moitié gauche était invisible sous `lg`, ce qui donnait deux expériences différentes.
- Les accents de l'écran de vérification sont corrigés : « Verifiez votre email » était le seul texte non accentué du parcours.

## Ce qui ne change pas

Rien côté données ni logique, conformément à la consigne. Les cinq champs et leurs `useState`, `POST /api/register` et son corps, `handleSubmit`, la logique des deux étapes, le champ Instagram conditionnel, `needsVerification`, la lecture de `?role=`, les `required` et `minLength` — tout est repris à l'identique.

Le bouton « Continuer avec Google » de l'étape 1 est conservé : le supprimer aurait retiré une façon de s'inscrire.

## Vérification

`npm run build` réussi · `tsc --noEmit` (seules restent les erreurs pré-existantes) · `eslint` propre · `npm test` 169/169 · plus aucune classe `brand-*` dans le fichier · aucun `gradient`/`blur`/`shadow`.

Contrôle visuel sur mobile et desktop, et **une inscription réelle vérifiée de bout en bout**.

## Suite

Lot 2 : le feed d'accueil, avec les cartes salon de la maquette — badge menthe « LIBRE 14:00 », note en étoile, ligne « quartier · catégories · dès N TND ».
```

**Ne merge pas toi-même** — un push sur `main` déclenche le déploiement vers
Lightsail.

---

## Notes de conception

**Pourquoi commencer par l'écran de vérification ?** Parce qu'il est rendu par un
`return` anticipé au milieu du fichier, loin des deux autres écrans. Le traiter
en dernier, c'est risquer de l'oublier — et il serait resté beige au milieu d'un
parcours refait.

**Pourquoi un `<Link>` stylé plutôt qu'un `<Button>` sur cet écran ?** `Button`
rend un `<button>`, qui ne navigue pas. Un lien déguisé en bouton reste un lien :
clic droit, ouverture dans un nouvel onglet, tout fonctionne.

**Pourquoi aucune carte de profil n'est rose ?** La règle du design system veut
une seule action primaire par vue. À l'étape 1 les trois profils sont
équivalents : en colorer un orienterait le choix sans raison.

**Pourquoi garder les couleurs officielles du SVG Google ?** Ce sont les couleurs
de Google, pas les nôtres. Les remplacer par du rose rendrait le bouton moins
reconnaissable et contreviendrait aux règles d'usage de leur marque.
