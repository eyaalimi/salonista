# Refonte visuelle de l'espace cliente — plan d'implémentation

> **Pour les agents :** SOUS-SKILL REQUISE — utilise superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** aligner le cadre du tableau de bord et les deux pages principales de l'espace cliente sur le design system 2026.

**Architecture :** trois fichiers, 583 lignes, aucun composant créé. Le travail est visuel, plus deux corrections décidées : les accents remis sur les textes affichés, et les statuts colorés hors palette convertis en `Badge`.

**Stack :** Next.js 16.2 (App Router), React 19, Tailwind v4, NextAuth v4.

---

## Contexte pour qui n'a jamais vu ce dépôt

### Où on en est

Une refonte visuelle a couvert tout le parcours public — accueil, offres, fiche salon, fiche offre, connexion, inscription. **L'espace cliente est resté à l'ancienne charte** : Playfair, badges encadrés en majuscules, boutons noirs et dorés.

Concrètement : une cliente réserve, voit « Réservation enregistrée » au nouveau design, clique « Payer plus tard », et atterrit sur « Mes reservations » à l'ancien. La rupture est en plein milieu du parcours de conversion.

### Le design system

Quatre couleurs : `rose` (#FF5C8A, action principale), `prune` (#3A1024, texte et fonds sombres), `menthe` (#A8E6CF, disponibilité et confirmation), `creme` (#FFF6F1, fond de page). Plus `rose-soft`, `prune-soft`, `menthe-deep`, `hairline` (bordures). Trois règles absolues :

1. **Aucune ombre, aucun dégradé, aucun flou.**
2. **Une seule action rose pleine par vue.**
3. **Cibles tactiles ≥ 44px**, corps de texte ≥ 16px.

Trois classes utilitaires dans `src/app/globals.css` : `.ds-press` (transition + `scale(0.97)` à l'appui + gère `:disabled`), `.ds-focus` (anneau rose au focus clavier), `.ds-display` (police de titre, graisse 800).

**Les tokens `brand-*` et `pos-*` ne doivent JAMAIS être supprimés de `globals.css`**, ni les classes `.luxury-*` : 142 fichiers en dépendent, dont la caisse en production. On cesse de les *utiliser* ici ; on ne les efface pas.

### Les primitifs disponibles

Dans `src/components/ui/`, signatures vérifiées :

```tsx
<Button variant="primary" | "secondary" | "ghost" fullWidth={false} />  // min-h-48px, pill, rose par défaut
<Input label="…" id="…" trailing={…} />                                 // min-h-52px, text-base, label et id OBLIGATOIRES
<Badge tone="menthe" | "rose" | "prune">…</Badge>                        // pill, majuscules
<Card className="…">…</Card>                                            // radius-card, blanc, SANS bordure
<Chip href="…" active={false}>…</Chip>                                  // rend un <Link>
```

### La sidebar est partagée par les quatre rôles — à savoir avant de commencer

`dashboard-layout-client.tsx` sert **cliente, prestataire, influenceuse et admin**. La restyler change l'apparence de tous les espaces. C'est assumé et décidé : c'est le cadre visible sur chaque écran.

**Leur contenu ne bouge pas.** Seul le cadre change.

### Contraintes générales

- **Aucun test de composant n'est possible.** Vitest tourne en `environment: "node"` sans jsdom. N'en écris pas. La vérification passe par `grep`, `tsc`, ESLint, le build et le contrôle visuel.
- **180 tests doivent rester au vert.**
- **`tsc` n'est pas propre au départ :** 23 erreurs préexistent sur `main`, dans le module de caisse et un fichier de test. Filtre toujours sur nos fichiers.
- **ESLint : 52 problèmes sur `main`.** Ce nombre ne doit pas augmenter.
- Interface en français, **tutoiement**, casse de phrase.

### Ce qu'il ne faut toucher sous aucun prétexte

| Élément | Où | Pourquoi |
|---|---|---|
| **`activeModules`** (3 occurrences) | `dashboard-layout-client.tsx` | **Logique commerciale** : filtre les entrées de menu selon les modules d'abonnement actifs. Un salon sans module « Caisse » ne doit pas voir l'entrée. |
| `navItems` et ses 4 rôles | idem | La navigation de tout le site |
| `signOut`, `usePathname` | idem | Déconnexion et détection de l'onglet actif |
| `cancelBooking`, `submitReview` | `cliente/page.tsx` | Annulation et envoi d'avis |
| `/api/client/bookings`, `/api/client/profile`, `/api/reviews` | les deux pages | Les appels serveur |
| Les états `useState` | partout | La logique de filtre et de formulaire |
| `<Logo>` | layout | Composant partagé, hors périmètre |

### Les valeurs qui ne sont PAS du texte

Les accents sont remis sur les textes **affichés**. Mais **jamais** sur :

- Les statuts : `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`
- Les clés de catégorie : `COIFFURE`, `ESTHETIQUE`, `ONGLERIE`, `MASSAGE`, `PARFUMERIE`, `AUTRE`

Ce sont des **valeurs de base de données**. Les accentuer casserait les filtres et les correspondances de `categoryLabels`.

### La leçon des lots précédents

Sur trois lots, le découpage par bornes de sections a laissé à chaque fois une portion non couverte, restée en `brand-*` jusqu'au contrôle final.

**Ici le découpage est par fichier entier**, ce qui élimine le risque. Mais le contrôle reste exigé :

```bash
grep -c "brand-" <fichier>   # doit finir à 0
grep -c "luxury-" <fichier>  # doit finir à 0
```

C'est ce compteur qui fait foi, pas la couverture apparente des tâches.

---

## Structure des fichiers

| Fichier | Lignes | `brand-*` | `luxury-*` | Tâche |
|---|---|---|---|---|
| `src/app/(dashboard)/dashboard-layout-client.tsx` | 148 | 16 | 1 | 1 |
| `src/app/(dashboard)/cliente/profil/page.tsx` | 101 | 14 | 2 | 2 |
| `src/app/(dashboard)/cliente/page.tsx` | 334 | 27 | 8 | 3 et 4 |

`cliente/page.tsx` est coupé en deux : la page (tâche 3) puis la modale d'avis (tâche 4), pour garder des diffs relisables.

---

## Tâche 0 : vérifier le point de départ

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : confirmer la branche**

```bash
git branch --show-current
git status --short
```

Attendu : `design-espace-cliente`, arbre propre. La branche part de `main` (55af317) et la spec y est déjà commitée.

- [ ] **Étape 2 : établir la ligne de base**

```bash
npm test 2>&1 | grep -E "Test Files|Tests "
npm run lint 2>&1 | tail -2
```

Attendu : **180 tests au vert** (13 fichiers), et `✖ 52 problems (40 errors, 12 warnings)`.

- [ ] **Étape 3 : noter les compteurs de départ**

```bash
grep -c "brand-" "src/app/(dashboard)/dashboard-layout-client.tsx"
grep -c "luxury-" "src/app/(dashboard)/dashboard-layout-client.tsx"
grep -c "brand-" "src/app/(dashboard)/cliente/page.tsx"
grep -c "luxury-" "src/app/(dashboard)/cliente/page.tsx"
grep -c "brand-" "src/app/(dashboard)/cliente/profil/page.tsx"
grep -c "luxury-" "src/app/(dashboard)/cliente/profil/page.tsx"
```

Attendu : `16`, `1`, `27`, `8`, `14`, `2`. Tous doivent valoir **0** à la fin.

---

## Tâche 1 : la sidebar partagée

C'est le cadre visible sur chaque écran des quatre espaces.

**Fichiers :**
- Modifier : `src/app/(dashboard)/dashboard-layout-client.tsx:57-148`

- [ ] **Étape 1 : remplacer le rendu**

Remplace tout le bloc `return (` … `);` final (lignes 57 à 147) par :

```tsx
  return (
    <div className="flex min-h-screen bg-creme">
      {/* Sidebar */}
      <aside className="hidden flex-col border-r border-hairline bg-white md:flex md:w-64">
        <div className="border-b border-hairline p-6">
          <Logo className="text-xl" />
        </div>
        <nav className="flex-1 space-y-1 px-4 py-6">
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`ds-press ds-focus flex min-h-[44px] items-center rounded-[var(--radius-pill)] px-4 text-base font-semibold ${
                  active
                    ? "bg-rose text-prune"
                    : "text-prune-soft hover:bg-creme hover:text-prune"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-hairline p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-soft text-sm font-bold text-prune">
              {session?.user?.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-prune">{session?.user?.name}</p>
              <p className="truncate text-xs text-prune-soft">{session?.user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] px-3 text-sm font-semibold text-prune-soft hover:text-rose"
          >
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-hairline bg-white p-4 md:hidden">
          <Logo className="text-lg" />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
            className="ds-press ds-focus flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] text-prune"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-b border-hairline bg-white md:hidden">
            <div className="space-y-1 p-4">
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`ds-press ds-focus flex min-h-[44px] items-center rounded-[var(--radius-pill)] px-4 text-base font-semibold ${
                      active ? "bg-rose text-prune" : "text-prune-soft"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="ds-press ds-focus flex min-h-[44px] w-full items-center rounded-[var(--radius-pill)] px-4 text-left text-base font-semibold text-prune-soft"
              >
                Déconnexion
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 bg-creme p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
```

Ce qui change, et pourquoi :

- **`luxury-fade-in` disparaît** du menu mobile — c'est une animation d'apparition, et le design system n'a qu'un mouvement, le `scale(0.97)` de `.ds-press`.
- Les entrées de menu passent de `text-xs uppercase tracking-[0.1em]` à `text-base` en casse de phrase, et gagnent une **cible de 44px** — elles n'en avaient aucune.
- L'avatar passe de carré à rond, `bg-rose-soft` avec texte `prune`.
- Le bouton hamburger gagne `aria-label` et `aria-expanded` : il n'en avait aucun, un lecteur d'écran annonçait un bouton sans nom.
- **`bg-brand-cream/50`** du `<main>` devient `bg-creme` plein — la transparence sur fond identique n'avait pas d'effet.

**Ne touche à rien au-dessus de la ligne 57 :** `navItems`, `activeModules`, le filtrage, `usePathname`, `useSession`, `signOut`.

- [ ] **Étape 2 : vérifier**

```bash
grep -c "brand-" "src/app/(dashboard)/dashboard-layout-client.tsx"
grep -c "luxury-" "src/app/(dashboard)/dashboard-layout-client.tsx"
grep -c "activeModules" "src/app/(dashboard)/dashboard-layout-client.tsx"
grep -c "navItems\|signOut\|usePathname" "src/app/(dashboard)/dashboard-layout-client.tsx"
npx tsc --noEmit 2>&1 | grep -E "dashboard-layout"
```

Attendu : `brand-` et `luxury-` à **0** ; `activeModules` à **3** (le filtrage commercial est intact) ; la navigation ≥ 4 ; aucune sortie de `tsc`.

Rappel : `npx tsc --noEmit` sans filtre affiche 23 erreurs préexistantes ailleurs — ignore-les, ne les corrige sous aucun prétexte.

- [ ] **Étape 3 : commit**

```bash
git add "src/app/(dashboard)/dashboard-layout-client.tsx"
git commit -m "feat(design): sidebar du tableau de bord au design system"
```

---

## Tâche 2 : la page « Mon profil »

**Fichiers :**
- Modifier : `src/app/(dashboard)/cliente/profil/page.tsx:40-101`

- [ ] **Étape 1 : l'état de chargement**

Ligne 41, remplace :

```tsx
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
```

par :

```tsx
    return <div className="flex h-64 items-center justify-center text-base text-prune-soft">Chargement…</div>;
```

- [ ] **Étape 2 : remplacer le rendu**

Remplace le bloc `return (` … `);` final (lignes 44 à 100) par :

```tsx
  return (
    <div>
      <div className="mb-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Paramètres</p>
        <h1 className="ds-display text-3xl text-prune">Mon profil</h1>
      </div>

      <div className="max-w-lg">
        {/* Avatar */}
        <div className="mb-8 flex items-center gap-4 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-soft text-xl font-bold text-prune">
            {session?.user?.name?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <p className="text-base font-semibold text-prune">{session?.user?.name}</p>
            <p className="mt-1 text-sm text-prune-soft">{session?.user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-8">
          <Input
            label="Nom"
            id="profil-nom"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <Input
            label="Téléphone"
            id="profil-telephone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+216 XX XXX XXX"
          />

          <div className="rounded-[var(--radius-panel)] border-2 border-hairline bg-creme p-4 text-base text-prune-soft">
            <p><strong className="font-semibold text-prune">Email :</strong> {session?.user?.email}</p>
            <p className="mt-1 text-sm text-prune-soft">L&apos;email ne peut pas être modifié.</p>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : saved ? "Enregistré" : "Enregistrer"}
          </Button>
        </form>
      </div>
    </div>
  );
```

Trois points :

- **Les deux champs passent par le primitif `Input`.** Il impose `min-h-[52px]` et `text-base` : en dessous de 16px, iOS zoome automatiquement au focus et casse la mise en page. Les champs actuels sont en `text-sm`.
- `Input` exige un `label` et un `id`. Les `<label>` actuels ne sont **associés à aucun champ** (pas de `htmlFor`) — un lecteur d'écran ne les rattache pas. Le primitif corrige ça.
- Les accents sont remis : « Paramètres », « Téléphone », « ne peut pas être modifié », « Enregistré ».

- [ ] **Étape 3 : ajouter les imports**

En haut du fichier, après la ligne 4, ajoute :

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
```

- [ ] **Étape 4 : vérifier**

```bash
grep -c "brand-" "src/app/(dashboard)/cliente/profil/page.tsx"
grep -c "luxury-" "src/app/(dashboard)/cliente/profil/page.tsx"
grep -c "api/client/profile" "src/app/(dashboard)/cliente/profil/page.tsx"
npx tsc --noEmit 2>&1 | grep -E "cliente/profil"
npm test 2>&1 | grep -E "Tests "
```

Attendu : `brand-` et `luxury-` à **0** ; l'appel API ≥ 2 (lecture et écriture intactes) ; aucune sortie de `tsc` ; **180 tests au vert**.

- [ ] **Étape 5 : commit**

```bash
git add "src/app/(dashboard)/cliente/profil/page.tsx"
git commit -m "feat(design): page mon profil au design system"
```

---

## Tâche 3 : la page « Mes réservations »

La plus grosse des trois. La modale d'avis est traitée séparément en tâche 4.

**Fichiers :**
- Modifier : `src/app/(dashboard)/cliente/page.tsx:24-31` (libellés), `:89-91` (chargement), `:93-278` (la page)

- [ ] **Étape 1 : les libellés de catégorie**

Lignes 24-31, remplace :

```tsx
const categoryLabels: Record<string, string> = {
  COIFFURE: "Coiffure",
  ESTHETIQUE: "Esthetique",
  ONGLERIE: "Onglerie",
  MASSAGE: "Massage",
  PARFUMERIE: "Parfumerie",
  AUTRE: "Autre",
};
```

par :

```tsx
// Les CLES (COIFFURE, ESTHETIQUE…) sont des valeurs de base de donnees et ne
// doivent jamais etre accentuees. Seules les valeurs affichees le sont.
const categoryLabels: Record<string, string> = {
  COIFFURE: "Coiffure",
  ESTHETIQUE: "Esthétique",
  ONGLERIE: "Onglerie",
  MASSAGE: "Massage",
  PARFUMERIE: "Parfumerie",
  AUTRE: "Autre",
};
```

Seule « Esthetique » gagne son accent. Les clés ne bougent pas.

- [ ] **Étape 2 : la confirmation d'annulation**

Ligne 76, remplace :

```tsx
    if (!confirm("Etes-vous sure de vouloir annuler cette reservation ?")) return;
```

par :

```tsx
    if (!confirm("Es-tu sûre de vouloir annuler cette réservation ?")) return;
```

Accents remis, et passage au tutoiement comme le reste du site.

- [ ] **Étape 3 : l'état de chargement**

Ligne 90, remplace :

```tsx
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
```

par :

```tsx
    return <div className="flex h-64 items-center justify-center text-base text-prune-soft">Chargement…</div>;
```

- [ ] **Étape 4 : en-tête, statistiques et filtres**

Remplace les lignes 93 à 144 (de `  return (` jusqu'au `</div>` qui ferme les filtres, juste avant `{/* Bookings list */}`) par :

```tsx
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Mon espace</p>
          <h1 className="ds-display text-3xl text-prune">Mes réservations</h1>
        </div>
        <Link
          href="/offres"
          className="ds-press ds-focus inline-flex min-h-[48px] items-center rounded-[var(--radius-pill)] bg-rose px-6 text-base font-semibold text-prune hover:bg-[#F04A79]"
        >
          Découvrir les offres
        </Link>
      </div>

      {/* Stats cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total", value: bookings.length },
          { label: "En attente", value: bookings.filter((b) => b.status === "PENDING").length },
          { label: "Confirmées", value: bookings.filter((b) => b.status === "CONFIRMED").length },
          { label: "Terminées", value: bookings.filter((b) => b.status === "COMPLETED").length },
        ].map((s) => (
          <div key={s.label} className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5 text-center">
            <p className="ds-display text-2xl text-prune">{s.value}</p>
            <p className="mt-1 text-sm text-prune-soft">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {[
          { key: "ALL", label: "Toutes" },
          { key: "PENDING", label: "En attente" },
          { key: "CONFIRMED", label: "Confirmées" },
          { key: "COMPLETED", label: "Terminées" },
          { key: "CANCELLED", label: "Annulées" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`ds-press ds-focus min-h-[44px] shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] px-4 text-sm font-semibold ${
              filter === f.key
                ? "bg-rose text-prune"
                : "border-2 border-hairline bg-white text-prune hover:border-rose"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
```

Points d'attention :

- **« Découvrir les offres » est la seule action rose pleine de la page.** Les actions par réservation seront secondaires.
- Les filtres actifs sont aussi en rose, mais c'est un **état de sélection**, pas une action concurrente — même logique que les chips du feed.
- **Les `key` de filtre restent en majuscules non accentuées** (`PENDING`, `CONFIRMED`…) : ce sont les valeurs comparées à `b.status`. Seuls les `label` sont accentués.
- Les filtres gagnent une cible de 44px.

- [ ] **Étape 5 : la liste des réservations**

Remplace les lignes 146 à 264 (de `{/* Bookings list */}` jusqu'au `</div>` qui ferme la liste) par :

```tsx
      {/* Bookings list */}
      <div className="space-y-3">
        {filtered.map((booking) => {
          const statusTones: Record<string, "menthe" | "rose" | "prune"> = {
            PENDING: "prune",
            CONFIRMED: "menthe",
            COMPLETED: "menthe",
            CANCELLED: "rose",
          };
          const statusLabels: Record<string, string> = {
            PENDING: "En attente",
            CONFIRMED: "Confirmée",
            COMPLETED: "Terminée",
            CANCELLED: "Annulée",
          };
          return (
            <div
              key={booking.id}
              className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {booking.items[0] && (
                      <Badge tone="prune">
                        {categoryLabels[booking.items[0].offer.category] || booking.items[0].offer.category}
                      </Badge>
                    )}
                    <Badge tone={statusTones[booking.status] || "prune"}>
                      {statusLabels[booking.status] || booking.status}
                    </Badge>
                  </div>
                  <h3 className="ds-display text-lg text-prune">
                    {booking.items.map((i) => i.offer.title).join(", ")}
                  </h3>
                  <p className="mt-1 text-sm text-prune-soft">
                    {booking.items[0]?.offer.provider.salonName}
                    {booking.items[0]?.offer.provider.city && ` · ${booking.items[0].offer.provider.city}`}
                  </p>
                  {booking.items[0]?.slot && (
                    <p className="mt-2 text-base text-prune">
                      {new Date(booking.items[0].slot.startTime).toLocaleDateString("fr-TN", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  {booking.notes && (
                    <p className="mt-1 text-sm text-prune-soft">Note : {booking.notes}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <span className="ds-display text-xl text-prune">
                    {Number(booking.totalPrice).toFixed(0)} TND
                  </span>

                  {/* Payment status badge */}
                  {booking.paymentStatus === "PAID" && (
                    <Badge tone="menthe">{booking.qrVerified ? "Vérifié" : "Payé"}</Badge>
                  )}

                  {/* Pay button for unpaid confirmed/pending bookings */}
                  {booking.paymentStatus === "UNPAID" && booking.status !== "CANCELLED" && (
                    <Link
                      href={`/cliente/paiement?bookingId=${booking.id}`}
                      className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] bg-prune px-4 text-sm font-semibold text-white hover:bg-[#4E1832]"
                    >
                      Payer
                    </Link>
                  )}

                  {/* QR code button for paid bookings */}
                  {booking.paymentStatus === "PAID" && booking.qrCode && (
                    <Link
                      href={`/cliente/reservation?id=${booking.id}`}
                      className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] border-2 border-hairline px-4 text-sm font-semibold text-prune hover:border-rose"
                    >
                      QR code
                    </Link>
                  )}

                  {/* Review button for completed bookings */}
                  {booking.status === "COMPLETED" && !booking.hasReview && (
                    <button
                      onClick={() => { setReviewBooking(booking); setReviewRating(5); setReviewComment(""); }}
                      className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] border-2 border-hairline px-4 text-sm font-semibold text-prune hover:border-rose"
                    >
                      Laisser un avis
                    </button>
                  )}
                  {booking.status === "COMPLETED" && booking.hasReview && (
                    <Badge tone="menthe">Avis donné</Badge>
                  )}

                  {/* Cancel button — seule action destructrice, traitement a part */}
                  {booking.status === "PENDING" && booking.paymentStatus === "UNPAID" && (
                    <button
                      onClick={() => cancelBooking(booking.id)}
                      disabled={cancelling === booking.id}
                      className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] border-2 border-hairline px-4 text-sm font-semibold text-prune-soft hover:border-rose hover:text-rose"
                    >
                      {cancelling === booking.id ? "…" : "Annuler"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center">
          <p className="mb-6 text-base text-prune-soft">
            {filter === "ALL" ? "Aucune réservation pour le moment." : "Aucune réservation dans cette catégorie."}
          </p>
          <Link
            href="/offres"
            className="ds-press ds-focus inline-flex min-h-[48px] items-center rounded-[var(--radius-pill)] border-2 border-hairline px-8 text-base font-semibold text-prune hover:border-rose"
          >
            Découvrir les offres
          </Link>
        </div>
      )}
```

Décisions à comprendre :

- **Les quatre statuts colorés hors palette** (ambre, bleu, émeraude, rouge) deviennent des `Badge` : `prune` pour « En attente », `menthe` pour « Confirmée » et « Terminée » — usage documenté du menthe pour les confirmations —, `rose` pour « Annulée », seule couleur d'alerte du système.
- **« Payer » est en `prune` plein**, pas en rose : c'est une action forte, mais répétée à chaque ligne. Le rose reste à l'en-tête.
- **« Annuler » garde un traitement à part** : bordure seule, texte `prune-soft`, survol rose. C'est la seule action **destructrice** de la page ; elle ne doit jamais ressembler à une action désirable.
- Le `hover:border-brand-gold` de la carte disparaît : le survol d'une carte non cliquable n'apporte rien.
- Le bouton du bas de page (état vide) est en **bordure**, pas en rose : il ne doit pas concurrencer celui de l'en-tête.
- Toutes les actions gagnent une cible de 44px.

- [ ] **Étape 6 : importer `Badge`**

En haut du fichier, après la ligne 4, ajoute :

```tsx
import { Badge } from "@/components/ui/badge";
```

- [ ] **Étape 7 : vérifier**

```bash
grep -n "brand-\|luxury-" "src/app/(dashboard)/cliente/page.tsx"
grep -c "cancelBooking\|submitReview" "src/app/(dashboard)/cliente/page.tsx"
grep -c "api/client/bookings\|api/reviews" "src/app/(dashboard)/cliente/page.tsx"
grep -c "PENDING\|CONFIRMED\|COMPLETED\|CANCELLED" "src/app/(dashboard)/cliente/page.tsx"
npx tsc --noEmit 2>&1 | grep -E "cliente/page"
```

Attendu : les seules lignes `brand-`/`luxury-` restantes doivent être **dans la modale** (lignes ~283-330, traitée en tâche 4) ; la logique ≥ 4 ; les appels API ≥ 2 ; les valeurs de statut ≥ 8 (**non accentuées, intactes**) ; aucune sortie de `tsc`.

- [ ] **Étape 8 : commit**

```bash
git add "src/app/(dashboard)/cliente/page.tsx"
git commit -m "feat(design): page mes reservations au design system"
```

---

## Tâche 4 : la modale d'avis

Elle ne s'ouvre que sur une réservation terminée — invisible au premier coup d'œil, mais elle porte le **seul `backdrop-blur` du lot**.

**Fichiers :**
- Modifier : `src/app/(dashboard)/cliente/page.tsx` — le bloc `{reviewBooking && (` jusqu'à sa fermeture

- [ ] **Étape 1 : remplacer la modale**

Remplace le bloc `{/* Review modal */}` … `)}` (lignes ~280 à 331) par :

```tsx
      {/* Review modal */}
      {reviewBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-prune/50 px-4">
          <div className="w-full max-w-md rounded-[var(--radius-card)] border-2 border-hairline bg-white p-8">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Ton avis</p>
            <h3 className="ds-display mb-1 text-xl text-prune">
              {reviewBooking.items.map((i) => i.offer.title).join(", ")}
            </h3>
            <p className="mb-6 text-sm text-prune-soft">
              {reviewBooking.items[0]?.offer.provider.salonName}
            </p>

            {/* Star selector */}
            <div className="mb-6 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  aria-label={`${star} étoile${star > 1 ? "s" : ""}`}
                  className={`ds-press ds-focus flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] text-3xl ${
                    star <= reviewRating ? "text-rose" : "text-hairline"
                  } hover:text-rose`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={3}
              placeholder="Partage ton expérience… (optionnel)"
              className="ds-focus mb-6 w-full rounded-[var(--radius-panel)] border-2 border-hairline bg-white px-4 py-3 text-base text-prune placeholder:text-prune-soft/50"
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <Button onClick={submitReview} disabled={reviewLoading} fullWidth>
                  {reviewLoading ? "Envoi…" : "Envoyer"}
                </Button>
              </div>
              <Button variant="ghost" onClick={() => setReviewBooking(null)}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}
```

Quatre points :

- **`backdrop-blur-sm` disparaît** — interdit du système. Le voile passe de `bg-black/40` à `bg-prune/50`, cohérent avec la palette.
- **Les étoiles passent en `rose`**, comme celles de la fiche offre, et gagnent une cible de 44px avec un `aria-label` : c'étaient des boutons sans nom accessible.
- Le `<textarea>` passe à `text-base` (16px) : en dessous, iOS zoome au focus.
- « Envoyer » est le `Button` primaire de la modale — c'est un écran distinct, la règle est respectée.

- [ ] **Étape 2 : importer `Button`**

En haut du fichier, ajoute (à côté de l'import `Badge` de la tâche 3) :

```tsx
import { Button } from "@/components/ui/button";
```

- [ ] **Étape 3 : la chasse aux interstices**

```bash
grep -n "brand-" "src/app/(dashboard)/cliente/page.tsx"
grep -n "luxury-" "src/app/(dashboard)/cliente/page.tsx"
```

**Attendu : aucune sortie.** Si une ligne apparaît, c'est du code entre deux bornes de tâches qu'aucune n'a couvert — c'est arrivé sur trois lots précédents. Corrige-le avec les mêmes conventions : `luxury-heading` → `ds-display text-prune`, `text-brand-bordeaux` → `text-prune`, `text-brand-bordeaux/40` → `text-prune-soft`, `border-brand-gold/20` → `border-2 border-hairline`, `bg-brand-cream` → `bg-creme`, `text-brand-gold` → `text-rose`.

- [ ] **Étape 4 : vérifier**

```bash
grep -n -E "shadow|gradient|blur" "src/app/(dashboard)/cliente/page.tsx"
grep -n -E "amber-|blue-|emerald-|red-|gray-" "src/app/(dashboard)/cliente/page.tsx"
grep -c "submitReview\|reviewRating\|reviewComment" "src/app/(dashboard)/cliente/page.tsx"
npx tsc --noEmit 2>&1 | grep -E "cliente/page"
npm test 2>&1 | grep -E "Tests "
```

Attendu : aucun interdit, aucune couleur hors palette, la logique d'avis ≥ 5, aucune sortie de `tsc`, **180 tests au vert**.

- [ ] **Étape 5 : commit**

```bash
git add "src/app/(dashboard)/cliente/page.tsx"
git commit -m "feat(design): modale d'avis au design system"
```

---

## Tâche 5 : vérification finale

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : tous les compteurs à zéro**

```bash
for f in "src/app/(dashboard)/dashboard-layout-client.tsx" "src/app/(dashboard)/cliente/page.tsx" "src/app/(dashboard)/cliente/profil/page.tsx"; do
  echo "$f : brand=$(grep -c 'brand-' "$f") luxury=$(grep -c 'luxury-' "$f") interdits=$(grep -c -E 'shadow|gradient|blur' "$f") horsPalette=$(grep -c -E 'amber-|blue-|emerald-|red-|gray-' "$f")"
done
```

Attendu : **0 partout**, sur les quatre colonnes.

- [ ] **Étape 2 : la logique protégée est intacte**

```bash
grep -c "activeModules" "src/app/(dashboard)/dashboard-layout-client.tsx"
grep -c "navItems\|signOut\|usePathname" "src/app/(dashboard)/dashboard-layout-client.tsx"
grep -c "cancelBooking\|submitReview" "src/app/(dashboard)/cliente/page.tsx"
grep -c "api/client/bookings\|api/reviews" "src/app/(dashboard)/cliente/page.tsx"
grep -c "api/client/profile" "src/app/(dashboard)/cliente/profil/page.tsx"
```

Attendu : `activeModules` à **3** — c'est le filtrage par module d'abonnement, de la logique commerciale ; tous les autres ≥ 2.

- [ ] **Étape 3 : les valeurs de base ne sont pas accentuées**

```bash
grep -c "PENDING\|CONFIRMED\|COMPLETED\|CANCELLED" "src/app/(dashboard)/cliente/page.tsx"
grep -n "ESTHETIQUE:" "src/app/(dashboard)/cliente/page.tsx"
grep -cE "PENDING|CONFIRMED|COMPLETED|CANCELLED" --include=*.ts -r src/lib 2>/dev/null | head -1
```

Attendu : les statuts ≥ 8 dans la page ; la **clé** `ESTHETIQUE:` toujours sans accent (seule sa valeur affichée « Esthétique » en porte un). Accentuer une clé casserait `categoryLabels` et les filtres.

- [ ] **Étape 4 : types, lint, tests, build**

```bash
npx tsc --noEmit 2>&1 | grep -E "dashboard-layout|cliente"
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -2
npm test 2>&1 | grep -E "Test Files|Tests "
npm run build 2>&1 | grep -E "Compiled successfully|Failed to compile"
```

Attendu : **aucune sortie du premier grep** ; le second doit afficher **23** — le nombre exact d'erreurs préexistantes. S'il dépasse, ce chantier a introduit une régression. ESLint à **52 problèmes** ; **180 tests au vert** ; `✓ Compiled successfully`.

Si le prérendu échoue ensuite sur `PrismaClientKnownRequestError` / `ECONNREFUSED`, c'est que la base n'est pas démarrée — ce n'est pas un défaut du code.

- [ ] **Étape 5 : pousser**

```bash
git status --short   # doit etre vide
git push -u origin design-espace-cliente
```

`gh` n'est pas installé : la PR s'ouvre depuis l'URL affichée après le push.

---

## Contrôle visuel — pour l'utilisatrice

1. **Mes réservations** — l'écran de ta première capture. Le badge de statut, le prix, les boutons d'action : tout doit être lisible et cohérent avec les pages publiques.
2. **Mon profil** — l'écran de tes deux autres captures. Sur téléphone : **la page ne doit plus zoomer** quand tu tapes dans un champ.
3. **La sidebar** — le cadre de ta troisième capture. Les entrées ont maintenant une vraie zone cliquable de 44px.
4. **Sur mobile** : le menu hamburger. Il s'ouvre sans animation désormais — c'est voulu.
5. **La modale d'avis** — va sur une réservation terminée, clique « Laisser un avis ». Les étoiles sont roses, le fond n'est plus flouté.
6. **Un coup d'œil à l'espace prestataire** — son cadre a changé aussi, puisqu'il partage la même sidebar. Vérifie que ça te convient : c'est la conséquence assumée du choix.

---

## Ce que ce plan ne fait pas

- Les autres pages de l'espace cliente : `paiement` (355 lignes), `reservation` (189), `fidelite` (80 + 134). Second lot.
- Il ne touche pas au **contenu** des espaces prestataire, influenceuse et admin — seul leur cadre change.
- Il ne modifie ni `activeModules`, ni `navItems`, ni la navigation par rôle.
- Il n'accentue **aucune valeur de base de données** : statuts et clés de catégorie restent intacts.
- Il ne supprime aucun token `brand-*` ni `pos-*` de `globals.css`, ni aucune classe `.luxury-*`.
- Il ne touche pas au composant `<Logo>`, partagé par tout le site.
