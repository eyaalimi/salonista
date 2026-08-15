# Refonte visuelle lot 4 — fiche salon et calendrier

> **Pour les agents :** SOUS-SKILL REQUISE — utilise superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** aligner `/salon/[id]` et son calendrier sur le design system 2026, et corriger deux défauts d'usage que le restylage met en évidence.

**Architecture :** trois fichiers modifiés, aucun composant créé. Le travail est purement visuel sauf deux points explicitement décidés : les commandes du panier passent à 44px, et une barre de réservation fixe apparaît sur mobile. Toute la logique — panier, brouillon localStorage, appel API, calcul des créneaux — reste intacte.

**Stack :** Next.js 16.2 (App Router), React 19, Tailwind v4, Leaflet (chargé en `ssr: false`).

---

## Contexte pour qui n'a jamais vu ce dépôt

**Le design system.** Quatre couleurs : `rose` (#FF5C8A, action principale), `prune` (#3A1024, texte), `menthe` (#A8E6CF, disponibilité et confirmation), `creme` (#FFF6F1, fond de page). Plus `rose-soft`, `prune-soft`, `menthe-deep`, `hairline` (bordures). Trois règles absolues :

1. **Aucune ombre, aucun dégradé, aucun flou.** La hiérarchie passe par la couleur.
2. **Une seule action rose par vue.** Ici : le bouton « Confirmer la réservation ».
3. **Cibles tactiles ≥ 44px**, corps de texte ≥ 16px.

Trois classes utilitaires existent dans `src/app/globals.css` : `.ds-press` (transition + `scale(0.97)` à l'appui + état désactivé), `.ds-focus` (anneau rose de 2px au focus clavier), `.ds-display` (police Bricolage Grotesque, graisse 800).

**Les tokens `brand-*` et `pos-*` ne doivent JAMAIS être supprimés de `globals.css`.** 142 fichiers en dépendent, dont la caisse en production. On cesse de les *utiliser* dans les fichiers qu'on touche ; on ne les efface pas.

**Aucun test de composant n'est possible.** Vitest tourne en `environment: "node"` sans jsdom, et `@testing-library/react` n'est pas installé. Ne tente pas d'en écrire — la vérification passe par le build, `tsc`, ESLint, `grep`, et le contrôle visuel de l'utilisatrice. **Les 180 tests existants doivent rester au vert** ; ce lot n'en ajoute ni n'en retire aucun.

**Attention au piège du typage.** `next.config.ts` contient `typescript: { ignoreBuildErrors: true }`. Un `npm run build` qui réussit ne prouve donc PAS que les types sont bons. `npx tsc --noEmit` est le seul filet.

**Langue de l'interface :** français, tutoiement, casse de phrase (« Confirmer la réservation », pas « CONFIRMER LA RÉSERVATION »).

### Les primitifs disponibles

Dans `src/components/ui/`. Signatures exactes, vérifiées :

```tsx
<Button variant="primary" | "secondary" | "ghost" fullWidth={false} />  // min-h-48px, pill
<Badge tone="menthe" | "rose" | "prune">…</Badge>                        // pill, majuscules
<Card className="…">…</Card>                                            // radius-card, blanc, SANS bordure
<Chip href="…" active={false}>…</Chip>                                  // rend un <Link>
<Input label="…" id="…" trailing={…} />                                 // min-h-52px
```

**`Card` n'a pas de bordure.** Elle se détache par le contraste blanc-sur-crème. Les cartes de service ont besoin d'un état sélectionné visible : on ajoute donc la bordure via `className`, on ne modifie pas le primitif.

### La contrainte de superposition — la seule vraie difficulté technique

`src/components/bottom-nav.tsx` est monté dans le layout racine (`src/app/layout.tsx:109`), donc **présent sur `/salon/[id]`**. Sa géométrie exacte :

```tsx
className="fixed bottom-0 left-0 right-0 z-50 flex h-[60px] … md:hidden"
style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
```

La barre de réservation doit donc se poser **au-dessus** d'elle : `bottom: calc(60px + env(safe-area-inset-bottom))`, et `md:hidden` puisque sur desktop le panier collant suffit. Sans quoi les deux barres se chevauchent sur mobile.

---

## Structure des fichiers

| Fichier | Responsabilité | Ampleur |
|---|---|---|
| `src/app/salon/[id]/salon-client.tsx` | Fiche, liste de services, panier, barre fixe | 551 lignes, 62 classes `brand-*` |
| `src/components/multi-service-calendar.tsx` | Calendrier multi-services (utilisé **uniquement** ici) | 289 lignes, 29 classes `brand-*` |
| `src/components/map/salon-map.tsx` | Rayon du conteneur, ligne 53 seulement | 1 ligne |

### Les quatre interdits à supprimer, localisés

| Interdit | Emplacement exact |
|---|---|
| `backdrop-blur-md` | `salon-client.tsx:239` — barre de navigation |
| `shadow-sm` | `salon-client.tsx:321` — carte de service sélectionnée |
| `shadow-sm` | `multi-service-calendar.tsx:187` — jour choisi |
| `bg-brand-sand` | `salon-client.tsx:18` — squelette de chargement de la carte |

### Trois couleurs hors palette, à remplacer au passage

Le rouge et l'ambre ne sont dans aucun token du système. Le rose est la seule
couleur d'alerte disponible.

| Couleur | Emplacement | Devient |
|---|---|---|
| `text-red-500` / `hover:text-red-700` | `salon-client.tsx:436` — croix « retirer » | `text-prune-soft` / `hover:text-rose` |
| `text-red-600` | `salon-client.tsx:480` — message d'erreur | `text-rose` |
| `text-amber-700` | `multi-service-calendar.tsx:274` — avertissement « aucun créneau » | `text-prune` |

Elles sont traitées dans les tâches 5 et 4 respectivement ; ce tableau sert au
contrôle final.

### Ce qu'il ne faut sous aucun prétexte modifier

- `toggleOffer`, `moveOffer`, `cartOffers`, `totalPrice`, `totalDuration`
- Le brouillon localStorage : `DRAFT_KEY_PREFIX`, `DRAFT_TTL_MS`, le filtrage des offres disparues, le nettoyage après réservation
- `handleBook` et son `POST /api/bookings` avec `trackingToken`
- `dynamic(() => import(…), { ssr: false })` — sans lui le build échoue sur « window is not defined »
- `scrollWheelZoom: false` dans `salon-map.tsx`
- `validStartTimes`, `grid`, `dayTimes`, `canGoPrev` dans le calendrier
- **La taille des cases du calendrier** (~35px). C'est sous les 44px réglementaires, c'est assumé dans la spec, et le corriger demanderait de repenser la grille. Hors périmètre.

---

## Tâche 0 : vérifier le point de départ

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : confirmer la branche et l'état de départ**

```bash
git branch --show-current
git status --short
```

Attendu : `design-lot4`, arbre de travail propre. La branche part de `main` à jour (lot 3 mergé, PR #15) et la spec y est déjà commitée.

- [ ] **Étape 2 : établir la ligne de base**

```bash
npm test 2>&1 | tail -5
```

Attendu : **180 tests au vert**. Note le chiffre — il ne devra pas bouger.

- [ ] **Étape 3 : compter ce qu'on doit faire disparaître**

```bash
grep -c "brand-" "src/app/salon/[id]/salon-client.tsx"
grep -c "brand-" src/components/multi-service-calendar.tsx
grep -c "DT" "src/app/salon/[id]/salon-client.tsx"
```

Attendu : `62`, `29`, `3`. Ces trois nombres doivent valoir **0** à la fin du lot.

---

## Tâche 1 : le rayon de la carte Leaflet

On commence par le plus petit fichier pour valider la chaîne de vérification.

**Fichiers :**
- Modifier : `src/components/map/salon-map.tsx:53`

- [ ] **Étape 1 : remplacer le rayon nu**

Remplace la ligne 53 :

```tsx
  return <div ref={container} className="h-56 w-full rounded" />;
```

par :

```tsx
  return (
    <div
      ref={container}
      className="h-56 w-full overflow-hidden rounded-[var(--radius-panel)]"
    />
  );
}
```

Attention : garde uniquement `return (…)` — la ligne `}` finale du fichier existe déjà, ne la duplique pas.

`overflow-hidden` est nécessaire : les tuiles Leaflet sont des `<img>` carrées positionnées en absolu, et sans lui elles débordent du rayon arrondi.

- [ ] **Étape 2 : vérifier que rien d'autre n'a bougé**

```bash
grep -n "scrollWheelZoom" src/components/map/salon-map.tsx
```

Attendu : `scrollWheelZoom: false` toujours présent.

- [ ] **Étape 3 : commit**

```bash
git add src/components/map/salon-map.tsx
git commit -m "style(design): rayon de la carte au design system"
```

---

## Tâche 2 : l'en-tête et la navigation de la fiche

**Fichiers :**
- Modifier : `src/app/salon/[id]/salon-client.tsx:18` (squelette), `:236-294` (fond, nav, en-tête)

- [ ] **Étape 1 : le squelette de chargement de la carte**

Ligne 18, remplace :

```tsx
  loading: () => <div className="h-56 w-full rounded bg-brand-sand" />,
```

par :

```tsx
  loading: () => (
    <div className="h-56 w-full rounded-[var(--radius-panel)] bg-rose-soft" />
  ),
```

- [ ] **Étape 2 : le fond de page et la barre de navigation**

Remplace les lignes 236-249 (`return ( <div className="min-h-screen bg-brand-cream">` jusqu'à `</nav>`) par :

```tsx
  return (
    <div className="min-h-screen bg-creme">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-hairline bg-creme">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-12">
          <Logo className="text-xl" />
          <div className="flex items-center gap-6">
            <Link
              href="/offres"
              className="ds-focus rounded-[var(--radius-pill)] px-2 py-1 text-base text-prune-soft hover:text-rose"
            >
              Toutes les offres
            </Link>
            <NavAccount />
          </div>
        </div>
      </nav>
```

Trois changements de fond : le `backdrop-blur-md` disparaît (interdit), le fond passe de `bg-white/80` translucide à `bg-creme` opaque (un fond translucide sans flou laisserait voir le contenu défiler dessous), et `z-50` devient `z-40` — le `z-50` est réservé à `BottomNav`.

Le lien passe de `text-xs uppercase tracking-[0.2em]` à `text-base` en casse de phrase : le corps doit faire au moins 16px.

- [ ] **Étape 3 : l'en-tête du salon**

Remplace les lignes 252-294 (le bloc `{/* Salon header */}`) par :

```tsx
        {/* Salon header */}
        <div className="mb-12">
          {salon.photos.length > 0 && (
            <div className="relative mb-8 aspect-[21/9] overflow-hidden rounded-[var(--radius-card)]">
              <UploadedImage src={salon.photos[0]} alt={salon.salonName} fill className="object-cover" sizes="100vw" />
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">
                {salon.category}
              </p>
              <h1 className="ds-display text-3xl text-prune md:text-5xl">
                {salon.salonName}
              </h1>
              {salon.verified && (
                <span className="mt-3 inline-block">
                  <Badge tone="menthe">Salon vérifié</Badge>
                </span>
              )}
            </div>
          </div>
          {salon.description && (
            <p className="mt-6 max-w-3xl text-base leading-relaxed text-prune-soft">
              {salon.description}
            </p>
          )}
          {restored && cart.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] border-2 border-hairline bg-white p-4">
              <p className="text-sm text-prune">
                Ta sélection précédente a été restaurée — {cart.length} service{cart.length > 1 ? "s" : ""}.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCart([]);
                  setSelectedStart(null);
                  setNotes("");
                  setRestored(false);
                }}
                className="ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] px-4 text-sm font-semibold text-prune-soft hover:text-rose"
              >
                Effacer
              </button>
            </div>
          )}
        </div>
```

Le badge « Salon vérifié » utilise `menthe` — c'est une confirmation, exactement son domaine. Le bouton « Effacer » gagne sa cible de 44px. Le texte passe au tutoiement (« Ta sélection »).

- [ ] **Étape 4 : importer `Badge`**

En haut du fichier, après la ligne 12 (`import dynamic from "next/dynamic";`), ajoute :

```tsx
import { Badge } from "@/components/ui/badge";
```

- [ ] **Étape 5 : vérifier**

```bash
npx tsc --noEmit 2>&1 | head -5
```

Attendu : aucune sortie.

- [ ] **Étape 6 : commit**

```bash
git add "src/app/salon/[id]/salon-client.tsx"
git commit -m "feat(design): en-tete et navigation de la fiche salon"
```

---

## Tâche 3 : la liste des services

C'est ici que se joue la règle « une seule action rose ». Les cartes sélectionnées prennent **bordure rose + fond `rose-soft` + coche**, jamais un fond rose plein.

**Fichiers :**
- Modifier : `src/app/salon/[id]/salon-client.tsx:300-372` (la `<section>` des services)

- [ ] **Étape 1 : remplacer la section entière**

Remplace les lignes 300-372 par :

```tsx
            {/* Services list */}
            <section>
              <h2 className="ds-display mb-2 text-2xl text-prune">Services proposés</h2>
              <p className="mb-6 text-base text-prune-soft">
                Sélectionne un ou plusieurs services. Tu choisiras ensuite une seule heure de début.
              </p>

              {salon.offers.length === 0 ? (
                <p className="text-base text-prune-soft">Aucune offre disponible pour le moment</p>
              ) : (
                <div className="space-y-3">
                  {salon.offers.map((offer) => {
                    const discount = Math.round(
                      ((offer.originalPrice - offer.discountPrice) / offer.originalPrice) * 100
                    );
                    const inCart = cart.includes(offer.id);
                    return (
                      <button
                        type="button"
                        key={offer.id}
                        onClick={() => toggleOffer(offer.id)}
                        aria-pressed={inCart}
                        className={`ds-press ds-focus flex w-full overflow-hidden rounded-[var(--radius-card)] border-2 text-left ${
                          inCart
                            ? "border-rose bg-rose-soft"
                            : "border-hairline bg-white hover:border-rose"
                        }`}
                      >
                        {offer.photos.length > 0 && (
                          <div className="relative aspect-square w-32 shrink-0 sm:w-40">
                            <UploadedImage src={offer.photos[0]} alt={offer.title} fill className="object-cover" sizes="160px" />
                          </div>
                        )}
                        <div className="flex flex-1 flex-col p-4 sm:p-5">
                          <div className="mb-1 flex items-start justify-between gap-3">
                            <h3 className="ds-display text-base text-prune sm:text-lg">{offer.title}</h3>
                            <div className="shrink-0 text-right">
                              <p className="ds-display text-lg text-prune">
                                {offer.discountPrice.toFixed(0)} TND
                              </p>
                              {discount > 0 && (
                                <span className="mt-1 inline-block">
                                  <Badge tone="rose">-{discount}%</Badge>
                                </span>
                              )}
                              <p className="mt-1 text-xs text-prune-soft">
                                TVA {Number(offer.taxRate ?? 19)}%
                              </p>
                            </div>
                          </div>
                          <p className="mb-2 text-sm font-semibold text-prune-soft">
                            {formatDuration(offer.durationMinutes)}
                          </p>
                          {offer.description && (
                            <p className="line-clamp-2 text-sm text-prune-soft">{offer.description}</p>
                          )}
                          <div className="mt-auto flex items-center gap-2 pt-3">
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                                inCart ? "border-rose bg-rose" : "border-hairline"
                              }`}
                            >
                              {inCart && (
                                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <span className="text-sm font-semibold text-prune">
                              {inCart ? "Sélectionné" : "Ajouter"}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
```

Points d'attention :

- `shadow-sm` (interdit) a disparu de l'état sélectionné.
- **Deux « DT » sur trois** sont traités ici : le prix du service. Le troisième est dans le panier (tâche 5).
- La coche passe de carrée à ronde et de 20px à 24px — cohérent avec les pills du système.
- `aria-pressed={inCart}` est ajouté : un `<button>` qui bascule un état doit l'annoncer aux lecteurs d'écran. Il n'y en avait aucun.
- La remise passe en `Badge tone="rose"`. C'est son usage documenté.

- [ ] **Étape 2 : vérifier qu'aucune ombre ne subsiste dans la section**

```bash
grep -n -E "shadow|gradient|blur" "src/app/salon/[id]/salon-client.tsx"
```

Attendu : uniquement la ligne du `backdrop-blur-md` si la tâche 2 n'est pas encore faite, sinon **aucune sortie**.

- [ ] **Étape 3 : commit**

```bash
git add "src/app/salon/[id]/salon-client.tsx"
git commit -m "feat(design): liste des services de la fiche salon"
```

---

## Tâche 4 : le calendrier multi-services

**Fichiers :**
- Modifier : `src/components/multi-service-calendar.tsx:125-282`

Ne touche à rien au-dessus de la ligne 125 : `validStartTimes`, `grid`, `dayTimes` et `canGoPrev` sont la logique métier du calendrier.

- [ ] **Étape 1 : l'état vide et l'en-tête du mois**

Remplace les lignes 126-163 par :

```tsx
    <div className="space-y-6">
      {selectedOffers.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-8 text-center">
          <p className="text-base text-prune-soft">
            Sélectionne au moins un service ci-dessous pour voir les créneaux disponibles.
          </p>
        </div>
      ) : (
        <>
          {/* Calendar */}
          <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => canGoPrev && setViewMonth(addMonths(viewMonth, -1))}
                disabled={!canGoPrev}
                className="ds-press ds-focus flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] border-2 border-hairline text-prune hover:border-rose hover:text-rose"
                aria-label="Mois précédent"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-center">
                <p className="ds-display text-lg text-prune">{MONTHS[viewMonth.getMonth()]}</p>
                <p className="mt-0.5 text-sm text-prune-soft">{viewMonth.getFullYear()}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                className="ds-press ds-focus flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] border-2 border-hairline text-prune hover:border-rose hover:text-rose"
                aria-label="Mois suivant"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
```

Les flèches de mois passent de 36px (`w-9 h-9`) à **44px** (`h-11 w-11`). `.ds-press` gère l'état désactivé — le `disabled:opacity-30` manuel devient inutile.

- [ ] **Étape 2 : les en-têtes de jours et la grille**

Remplace les lignes 165-215 par :

```tsx
            <div className="mb-2 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-prune-soft">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {grid.map(({ date, key }) => {
                if (!date) return <div key={key} className="aspect-square" />;
                const k = dateKey(date);
                const isPast = date.getTime() < today.getTime();
                const isToday = isSameDay(date, today);
                const isAvailable = validStartTimes.has(k);
                const isPicked = pickedDate === k;

                let classes = "";
                const base =
                  "ds-press ds-focus relative flex aspect-square flex-col items-center justify-center rounded-[var(--radius-panel)] text-sm";
                if (isPast) {
                  classes = "text-prune-soft/30 cursor-not-allowed";
                } else if (isPicked) {
                  classes = "bg-rose text-white cursor-pointer font-semibold";
                } else if (isAvailable) {
                  classes = "bg-menthe text-menthe-deep cursor-pointer font-semibold hover:bg-menthe-deep hover:text-white";
                } else {
                  classes = "text-prune-soft/40 cursor-not-allowed bg-creme";
                }

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isPast || !isAvailable}
                    onClick={() => {
                      setPickedDate(k);
                      onSelect(null);
                    }}
                    className={`${base} ${classes}`}
                  >
                    <span>{date.getDate()}</span>
                    {isToday && !isPicked && (
                      <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-rose" />
                    )}
                  </button>
                );
              })}
            </div>
```

Deux décisions à comprendre :

- `shadow-sm` (interdit) disparaît du jour sélectionné.
- **La pastille « disponible » est supprimée.** Elle existait parce que l'ancien état disponible était un fond doré très pâle (`bg-brand-gold/10`), presque invisible. Le fond `menthe` plein est parfaitement lisible : la pastille ferait doublon. Le point « aujourd'hui » reste, lui, et passe en rose.

- [ ] **Étape 3 : la légende**

Remplace les lignes 217-227 par :

```tsx
            <div className="mt-5 flex flex-wrap items-center justify-center gap-5 border-t border-hairline pt-4">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-prune-soft">
                <span className="h-3 w-3 rounded-full bg-menthe" /> Disponible
              </span>
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-prune-soft">
                <span className="h-3 w-3 rounded-full bg-creme border border-hairline" /> Indisponible
              </span>
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-prune-soft">
                <span className="h-3 w-3 rounded-full bg-rose" /> Sélectionné
              </span>
            </div>
          </div>
```

- [ ] **Étape 4 : les créneaux horaires et les messages**

Remplace les lignes 230-281 par :

```tsx
          {/* Time slots */}
          {pickedDate && (
            <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5 md:p-6">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">Heure de début</p>
              <h3 className="ds-display mb-1 text-lg text-prune">
                {new Date(pickedDate).toLocaleDateString("fr-TN", { weekday: "long", day: "numeric", month: "long" })}
              </h3>
              <p className="mb-4 text-sm text-prune-soft">
                Durée totale : {formatDuration(totalDuration)}
              </p>
              {dayTimes.length === 0 ? (
                <p className="text-sm text-prune-soft">Aucun horaire compatible</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {dayTimes.map((t: Date) => {
                    const iso = t.toISOString();
                    const active = selectedStart === iso;
                    return (
                      <button
                        type="button"
                        key={iso}
                        onClick={() => onSelect(iso)}
                        className={`ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] border-2 px-3 text-sm font-semibold ${
                          active
                            ? "border-rose bg-rose text-white"
                            : "border-hairline text-prune hover:border-rose"
                        }`}
                      >
                        {t.toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" })}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!pickedDate && validStartTimes.size > 0 && (
            <p className="text-center text-sm text-prune-soft">
              Sélectionne une date en vert pour voir les heures disponibles
            </p>
          )}

          {validStartTimes.size === 0 && (
            <p className="py-3 text-center text-sm text-prune">
              Aucun créneau ne peut accueillir l&apos;ensemble des services sélectionnés. Essaie d&apos;en retirer ou de réorganiser l&apos;ordre.
            </p>
          )}
        </>
      )}
    </div>
  );
}
```

**« en doré » devient « en vert ».** Ce texte décrit une couleur affichée à l'écran ; ne pas le changer en ferait un mensonge, puisque les dates disponibles sont désormais menthe.

Les créneaux horaires gagnent `min-h-[44px]` — ils faisaient environ 38px.

- [ ] **Étape 5 : vérifier que la logique est intacte**

```bash
grep -c "validStartTimes\|slotIndex\|canGoPrev" src/components/multi-service-calendar.tsx
grep -c "brand-" src/components/multi-service-calendar.tsx
grep -n -E "shadow|gradient|blur" src/components/multi-service-calendar.tsx
```

Attendu : la logique toujours présente, `brand-` à **0**, aucun interdit.

- [ ] **Étape 6 : vérifier les types et les tests**

```bash
npx tsc --noEmit 2>&1 | head -5
npm test 2>&1 | tail -5
```

Attendu : aucune erreur de type, **180 tests au vert**.

- [ ] **Étape 7 : commit**

```bash
git add src/components/multi-service-calendar.tsx
git commit -m "feat(design): calendrier multi-services au design system"
```

---

## Tâche 5 : le panier et la colonne de droite

Le troisième « DT » se trouve ici, ainsi que les commandes minuscules à corriger.

**Fichiers :**
- Modifier : `src/app/salon/[id]/salon-client.tsx:391-546` (l'`<aside>` complet)

- [ ] **Étape 1 : l'en-tête du panier et la liste des services choisis**

Remplace les lignes 391-444 par :

```tsx
          {/* RIGHT: contact + cart */}
          <aside className="space-y-6 lg:col-span-1">
            {/* Cart summary (sticky) */}
            <div className="sticky top-24 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">Ta réservation</p>

              {cart.length === 0 ? (
                <p className="py-3 text-sm text-prune-soft">
                  Aucun service sélectionné
                </p>
              ) : (
                <div className="mb-4 space-y-3">
                  {cartOffers.map((offer, idx) => (
                    <div key={offer.id} className="flex items-start gap-2 rounded-[var(--radius-panel)] border border-hairline bg-creme p-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-prune text-xs font-bold text-white">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-prune">{offer.title}</p>
                        <p className="text-xs text-prune-soft">
                          {formatDuration(offer.durationMinutes)} · {offer.discountPrice.toFixed(0)} TND
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col">
                        <button
                          type="button"
                          onClick={() => moveOffer(offer.id, -1)}
                          disabled={idx === 0}
                          className="ds-press ds-focus flex h-[22px] w-11 items-center justify-center rounded-t-[var(--radius-panel)] text-prune-soft hover:text-rose"
                          aria-label={`Monter ${offer.title}`}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveOffer(offer.id, 1)}
                          disabled={idx === cartOffers.length - 1}
                          className="ds-press ds-focus flex h-[22px] w-11 items-center justify-center rounded-b-[var(--radius-panel)] text-prune-soft hover:text-rose"
                          aria-label={`Descendre ${offer.title}`}
                        >
                          ▼
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleOffer(offer.id)}
                        className="ds-press ds-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-pill)] text-prune-soft hover:text-rose"
                        aria-label={`Retirer ${offer.title}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
```

Les cibles tactiles, expliquées :

- **Les flèches font 44px de large sur 22px de haut**, empilées : ensemble elles occupent 44×44. C'est le compromis honnête — deux commandes de 44×44 empilées feraient 88px de haut et casseraient la ligne du panier. La largeur, elle, est pleine.
- **La croix fait 44×44** en entier.
- Les `aria-label` deviennent spécifiques (« Monter Balayage » au lieu de « Monter »). Avec plusieurs services au panier, l'ancien label était ambigu pour un lecteur d'écran.
- Le `text-red-500` de la croix disparaît — le rouge n'est pas dans la palette. Le survol passe en rose.
- **Troisième et dernier « DT » → « TND »**, ligne du panier.

- [ ] **Étape 2 : les totaux, les notes et le bouton**

Remplace les lignes 446-495 par :

```tsx
              {cart.length > 0 && (
                <>
                  <div className="mb-3 space-y-1 border-t border-hairline pt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-prune-soft">Durée totale</span>
                      <span className="text-prune">{formatDuration(totalDuration)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">Total</span>
                      <span className="ds-display text-2xl text-prune">{totalPrice.toFixed(0)} TND</span>
                    </div>
                    {selectedStart && (
                      <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2 text-sm">
                        <span className="text-prune-soft">Début</span>
                        <span className="font-semibold text-prune">
                          {new Date(selectedStart).toLocaleString("fr-TN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes (optionnel)"
                    rows={2}
                    className="ds-focus mb-3 w-full rounded-[var(--radius-panel)] border-2 border-hairline bg-white px-4 py-3 text-base text-prune placeholder:text-prune-soft/50"
                  />
                  {error && <p className="mb-3 text-sm font-semibold text-rose">{error}</p>}
                  <Button
                    onClick={handleBook}
                    disabled={loading || !selectedStart}
                    fullWidth
                  >
                    {loading ? "Réservation…" : "Confirmer la réservation"}
                  </Button>
                  {!selectedStart && cart.length > 0 && (
                    <p className="mt-2 text-center text-sm text-prune-soft">
                      Choisis une heure pour activer le bouton
                    </p>
                  )}
                </>
              )}
            </div>
```

Le `<textarea>` passe à `text-base` (16px) : en dessous, iOS zoome automatiquement au focus et casse la mise en page. Le message d'erreur passe du rouge au rose — seule couleur d'alerte de la palette.

**C'est le seul `Button variant="primary"` de la page.** Ne mets de rose plein nulle part ailleurs.

- [ ] **Étape 3 : le bloc coordonnées et les horaires**

Remplace les lignes 497-546 par :

```tsx
            {/* Contact */}
            <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">Coordonnées</p>
              {salon.address && (
                <p className="mb-2 text-base text-prune">{salon.address}</p>
              )}
              {salon.city && (
                <p className="mb-3 text-base text-prune-soft">{salon.city}</p>
              )}
              {salon.phone && (
                <a
                  href={`tel:${salon.phone}`}
                  className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] text-base font-semibold text-rose hover:underline"
                >
                  {salon.phone}
                </a>
              )}
              {salon.lat !== null && salon.lng !== null && isValidCoords(salon.lat, salon.lng) && (
                <div className="mt-4">
                  <SalonMap lat={salon.lat} lng={salon.lng} label={salon.salonName} />
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${salon.lat},${salon.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ds-press ds-focus mt-3 flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-pill)] border-2 border-hairline text-base font-semibold text-prune hover:border-rose"
                  >
                    Itinéraire →
                  </a>
                </div>
              )}
            </div>

            {salon.openingHours && (
              <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-6">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">Horaires</p>
                <div className="space-y-1.5 text-sm">
                  {DAY_KEYS.map((day) => {
                    const ranges = salon.openingHours![day];
                    return (
                      <div key={day} className="flex justify-between">
                        <span className="text-prune-soft">{DAY_LABELS_FR[day]}</span>
                        <span className="text-prune">
                          {ranges.length === 0
                            ? "Fermé"
                            : ranges.map((r) => `${r.start}–${r.end}`).join(", ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>
```

Le bouton « Itinéraire » reste `ghost` : le rose est déjà pris par Confirmer.

- [ ] **Étape 4 : importer `Button`**

Ajoute près des autres imports de primitifs :

```tsx
import { Button } from "@/components/ui/button";
```

- [ ] **Étape 5 : vérifier**

```bash
grep -c "DT" "src/app/salon/[id]/salon-client.tsx"
npx tsc --noEmit 2>&1 | head -5
```

Attendu : `0` occurrence de « DT », aucune erreur de type.

- [ ] **Étape 6 : commit**

```bash
git add "src/app/salon/[id]/salon-client.tsx"
git commit -m "feat(design): panier et coordonnees de la fiche salon"
```

---

## Tâche 6 : la barre de réservation fixe sur mobile

La seule vraie addition du lot. Sur mobile, le panier tombe sous les services et le calendrier : sans cette barre, il faut défiler jusqu'en bas pour voir son total.

**Fichiers :**
- Modifier : `src/app/salon/[id]/salon-client.tsx` — conteneur de page + nouveau bloc avant la fermeture

- [ ] **Étape 1 : donner de l'air au bas de la page**

Trouve la ligne 251 :

```tsx
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-12 md:py-16">
```

Remplace-la par :

```tsx
      <div className="mx-auto max-w-6xl px-6 pt-12 pb-40 md:px-12 md:pt-16 md:pb-16">
```

Sans ce `pb-40` sur mobile, le dernier bloc de la page disparaît sous la barre de réservation **et** sous la barre de navigation.

- [ ] **Étape 2 : ajouter la barre avant la fermeture du composant**

Juste avant les deux dernières lignes du `return` (`</div>` puis `);`), ajoute :

```tsx
      {/* Barre de reservation fixe — mobile uniquement.
          BottomNav occupe fixed bottom-0 z-50 h-[60px] avec la safe-area :
          on se pose exactement au-dessus, sinon les deux se superposent. */}
      {cart.length > 0 && (
        <div
          className="fixed left-0 right-0 z-40 border-t border-hairline bg-white px-6 py-3 md:hidden"
          style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-prune-soft">
                {cart.length} service{cart.length > 1 ? "s" : ""} · {formatDuration(totalDuration)}
              </p>
              <p className="ds-display text-xl text-prune">{totalPrice.toFixed(0)} TND</p>
            </div>
            <Button
              onClick={handleBook}
              disabled={loading || !selectedStart}
              className="shrink-0"
            >
              {loading ? "Réservation…" : selectedStart ? "Confirmer" : "Choisis une heure"}
            </Button>
          </div>
        </div>
      )}
```

Trois points :

- `z-40` contre `z-50` pour `BottomNav` : si les deux se touchaient, la navigation resterait au-dessus.
- Le libellé change selon l'état. Un bouton désactivé sans explication laisse la visiteuse sans indice ; « Choisis une heure » lui dit quoi faire.
- Le bouton appelle **le même `handleBook`** que le panier. Aucune logique dupliquée.

- [ ] **Étape 3 : vérifier la géométrie**

```bash
grep -n "safe-area-inset-bottom" "src/app/salon/[id]/salon-client.tsx" src/components/bottom-nav.tsx
grep -n "z-40\|z-50" "src/app/salon/[id]/salon-client.tsx" src/components/bottom-nav.tsx
```

Attendu : la safe-area dans les deux fichiers ; `z-40` dans salon-client (nav + barre), `z-50` dans bottom-nav.

- [ ] **Étape 4 : commit**

```bash
git add "src/app/salon/[id]/salon-client.tsx"
git commit -m "feat(design): barre de reservation fixe sur mobile"
```

---

## Tâche 7 : l'écran de succès

Le bloc affiché après réservation, avant le paiement. Il est en haut du fichier et facile à oublier.

**Fichiers :**
- Modifier : `src/app/salon/[id]/salon-client.tsx:204-234`

- [ ] **Étape 1 : remplacer le bloc**

Remplace les lignes 204-234 par :

```tsx
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-creme px-6">
        <div className="w-full max-w-md rounded-[var(--radius-card)] border-2 border-hairline bg-white p-12 text-center md:p-16">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-menthe">
            <svg className="h-8 w-8 text-menthe-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="ds-display mb-3 text-2xl text-prune">Réservation enregistrée</h2>
          <p className="mb-8 text-base leading-relaxed text-prune-soft">
            Procède au paiement pour recevoir ton QR code.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href={`/cliente/paiement?bookingId=${success}`}
              className="ds-press ds-focus inline-flex min-h-[48px] w-full items-center justify-center rounded-[var(--radius-pill)] bg-rose px-6 text-base font-semibold text-white hover:bg-[#F04A79]"
            >
              Payer maintenant
            </Link>
            <Link
              href="/cliente"
              className="ds-press ds-focus inline-flex min-h-[48px] w-full items-center justify-center rounded-[var(--radius-pill)] border-2 border-hairline px-6 text-base font-semibold text-prune hover:border-rose"
            >
              Payer plus tard
            </Link>
          </div>
        </div>
      </div>
    );
  }
```

La coche de succès passe en `menthe` — confirmation, son usage exact. « Payer maintenant » est rose : c'est un écran distinct, avec sa propre action principale, donc la règle est respectée.

Les deux liens sont des `<Link>` et non des `<Button>` : `Button` rend un `<button>`, qui ne navigue pas. On reproduit son apparence à la main. C'est voulu.

- [ ] **Étape 2 : vérifier que plus aucune classe `brand-*` ne subsiste**

```bash
grep -c "brand-" "src/app/salon/[id]/salon-client.tsx"
```

Attendu : **0**.

- [ ] **Étape 3 : commit**

```bash
git add "src/app/salon/[id]/salon-client.tsx"
git commit -m "feat(design): ecran de succes de la reservation"
```

---

## Tâche 8 : vérification finale

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : les compteurs doivent tous valoir zéro**

```bash
grep -c "brand-" "src/app/salon/[id]/salon-client.tsx"
grep -c "brand-" src/components/multi-service-calendar.tsx
grep -c "DT" "src/app/salon/[id]/salon-client.tsx"
grep -c -E "shadow|gradient|blur" "src/app/salon/[id]/salon-client.tsx" src/components/multi-service-calendar.tsx src/components/map/salon-map.tsx
```

Attendu : **0** partout. `grep -c` renvoie 0 et sort en code 1 quand il ne trouve rien — c'est normal.

Puis les couleurs hors palette :

```bash
grep -n -E "text-red-|text-amber-|bg-red-|bg-amber-" "src/app/salon/[id]/salon-client.tsx" src/components/multi-service-calendar.tsx
```

Attendu : aucune sortie. Le rouge et l'ambre n'appartiennent pas au système ; le rose est la seule couleur d'alerte.

- [ ] **Étape 2 : la logique protégée doit être intacte**

```bash
grep -c "DRAFT_KEY_PREFIX\|DRAFT_TTL_MS\|hydratedRef" "src/app/salon/[id]/salon-client.tsx"
grep -c "trackingToken" "src/app/salon/[id]/salon-client.tsx"
grep -c "toggleOffer\|moveOffer" "src/app/salon/[id]/salon-client.tsx"
grep -c "ssr: false" "src/app/salon/[id]/salon-client.tsx"
grep -c "scrollWheelZoom" src/components/map/salon-map.tsx
grep -c "validStartTimes" src/components/multi-service-calendar.tsx
```

Attendu : tous ≥ 1. Si l'un vaut 0, une protection a sauté — corrige avant de continuer.

- [ ] **Étape 3 : types, lint, tests**

```bash
npx tsc --noEmit 2>&1 | head -10
npm run lint 2>&1 | tail -10
npm test 2>&1 | tail -5
```

Attendu : aucune erreur de type, aucune erreur ESLint nouvelle, **180 tests au vert**.

- [ ] **Étape 4 : le build**

```bash
npm run build 2>&1 | tail -20
```

Attendu : succès. Rappel : `ignoreBuildErrors: true` est actif, donc le build seul ne prouve rien sur les types — c'est `tsc` qui fait foi.

- [ ] **Étape 5 : vérifier la page réellement servie**

```bash
npm run start &
sleep 8
SALON_ID=$(curl -s http://localhost:3000/offres | grep -o '/salon/[a-z0-9]*' | head -1 | cut -d/ -f3)
echo "salon teste : $SALON_ID"
curl -s "http://localhost:3000/salon/$SALON_ID" -o /tmp/salon.html -w "HTTP %{http_code}\n"
grep -c -E "shadow-|gradient|backdrop-blur" /tmp/salon.html
grep -c "brand-" /tmp/salon.html
grep -o "TND" /tmp/salon.html | head -3
```

Attendu : HTTP 200, **0** interdit et **0** classe `brand-*` dans le HTML servi, « TND » présent.

Ce contrôle compte plus que le `grep` sur les sources : il a déjà attrapé, lors d'un lot précédent, une police jamais téléchargée qui semblait pourtant correcte dans le code.

Pense à arrêter le serveur ensuite (`kill %1`).

- [ ] **Étape 6 : pousser la branche**

```bash
git push -u origin design-lot4
```

`gh` n'est pas installé : la PR s'ouvre depuis l'URL que git affiche après le push.

---

## Contrôle visuel — pour l'utilisatrice

Aucun outil automatique ne dit si une page est réussie. À vérifier à l'œil, sur mobile **et** sur desktop :

1. **Mobile, panier rempli** — la barre de réservation apparaît-elle bien **au-dessus** de la barre de navigation, sans la recouvrir ? Peut-on atteindre le dernier bloc de la page (les horaires) sans qu'il passe dessous ?
2. **Sélection multiple** — choisis deux ou trois services, réordonne-les avec les flèches, retires-en un. Les commandes sont-elles confortables au doigt ?
3. **Le calendrier** — les dates disponibles sont-elles en vert, la date choisie en rose ? Le texte dit-il bien « une date en vert » ?
4. **Une seule action rose** — cherche le rose plein sur la page : il ne doit y en avoir qu'un, le bouton Confirmer (plus celui de la barre fixe sur mobile, qui est le même bouton).
5. **La réservation aboutit** — va jusqu'au bout : l'écran de succès s'affiche-t-il, avec les deux liens de paiement ?
6. **Le brouillon survit** — sélectionne des services, recharge la page. La sélection est-elle restaurée avec le bandeau « Ta sélection précédente a été restaurée » ?

---

## Ce que ce plan ne fait pas

- La fiche offre (lot 5), le bas de l'accueil (lot 6).
- Il ne touche pas `booking-calendar.tsx` — c'est le lot 5.
- Il ne supprime aucun token `brand-*` ni `pos-*` de `globals.css`.
- Il ne modifie ni la logique du panier, ni le brouillon localStorage, ni l'appel à `/api/bookings`.
- **Il ne redimensionne pas les cases du calendrier** (~35px, sous les 44px réglementaires). Sept colonnes dans 272px ne peuvent pas donner 44px sans repenser la grille : c'est une tâche de conception, à traiter avec le calendrier du lot 5.
