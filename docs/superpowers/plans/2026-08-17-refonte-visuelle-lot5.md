# Refonte visuelle lot 5 — fiche offre et calendrier

> **Pour les agents :** SOUS-SKILL REQUISE — utilise superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** aligner `/offre/[id]` et son calendrier sur le design system 2026, et corriger deux défauts que le restylage met en évidence.

**Architecture :** deux fichiers modifiés, aucun composant créé, aucun primitif touché. Le travail est visuel sauf deux points décidés : la barre fixe mobile gagne la safe-area, et les champs du formulaire passent à 16px. Toute la logique — réservation, inscription intégrée, attribution de tracking — reste intacte.

**Stack :** Next.js 16.2 (App Router), React 19, Tailwind v4, NextAuth v4.

---

## Contexte pour qui n'a jamais vu ce dépôt

**Ce qu'est cette page.** `/offre/[id]` est la page d'atterrissage des **liens d'influenceuses**. Une visiteuse qui clique depuis Instagram arrive ici, peut créer un compte et réserver sans jamais quitter la page. C'est le parcours qui génère les commissions.

**Le design system.** Quatre couleurs : `rose` (#FF5C8A, action principale), `prune` (#3A1024, texte), `menthe` (#A8E6CF, disponibilité et confirmation), `creme` (#FFF6F1, fond de page). Plus `rose-soft`, `prune-soft`, `menthe-deep`, `hairline` (bordures). Trois règles absolues :

1. **Aucune ombre, aucun dégradé, aucun flou.** La hiérarchie passe par la couleur.
2. **Une seule action rose pleine par vue.** Ici : le bouton de soumission « Réserver ».
3. **Cibles tactiles ≥ 44px**, corps de texte ≥ 16px.

Trois classes utilitaires dans `src/app/globals.css` : `.ds-press` (transition + `scale(0.97)` à l'appui + gère `:disabled` avec `opacity: 0.4`), `.ds-focus` (anneau rose de 2px au focus clavier), `.ds-display` (police Bricolage Grotesque, graisse 800).

**Les tokens `brand-*` et `pos-*` ne doivent JAMAIS être supprimés de `globals.css`.** 142 fichiers en dépendent, dont la caisse en production. On cesse de les *utiliser* dans les deux fichiers qu'on touche ; on ne les efface pas. Idem pour les classes `.luxury-*`.

**Aucun test de composant n'est possible.** Vitest tourne en `environment: "node"` sans jsdom, et `@testing-library/react` n'est pas installé. N'en écris pas — la vérification passe par le build, `tsc`, ESLint, `grep`, et le contrôle visuel. **Les 180 tests existants doivent rester au vert** ; ce lot n'en ajoute ni n'en retire aucun.

**Le piège du typage.** `next.config.ts` contient `typescript: { ignoreBuildErrors: true }` : un build qui réussit ne prouve rien sur les types. Et `tsc` n'est pas propre au départ — **23 erreurs préexistent sur `main`**, toutes dans `src/components/pos/onboarding/wizard-client.tsx` (deux types `Provider` homonymes en conflit). Elles ne viennent pas de ce lot et ne se corrigent pas ici. Filtre toujours :

```bash
npx tsc --noEmit 2>&1 | grep -E "offer-client|booking-calendar"
```

C'est **cette** sortie qui doit être vide.

**Langue de l'interface :** français, tutoiement, casse de phrase (« Réserver maintenant », pas « RÉSERVER MAINTENANT »).

### Les primitifs disponibles

Dans `src/components/ui/`. Signatures exactes, vérifiées :

```tsx
<Button variant="primary" | "secondary" | "ghost" fullWidth={false} />  // min-h-48px, pill, rose par défaut
<Input label="…" id="…" trailing={…} />                                 // min-h-52px, text-base, label et id OBLIGATOIRES
<Badge tone="menthe" | "rose" | "prune">…</Badge>                        // pill, majuscules
<Card className="…">…</Card>                                            // radius-card, blanc, SANS bordure
<Chip href="…" active={false}>…</Chip>                                  // rend un <Link>
```

**`RoleTabs` ne doit PAS être utilisé ici.** Son type est `RoleKey = "CLIENT" | "PROVIDER" | "INFLUENCER"` et sa liste `ROLE_OPTIONS` est codée en dur avec trois entrées portant chacune un `registerHref`. Nos onglets sont « Nouveau client » / « J'ai déjà un compte » — un axe sans rapport. On reproduit son **apparence** à la main, sans toucher au primitif dont dépendent les pages Connexion et Inscription déjà livrées.

### La leçon du lot 4 — lis ceci avant de commencer

Au lot précédent, le découpage par bornes de sections a laissé un **interstice** : un `<h2>` situé entre deux tâches n'était couvert par aucune, et a survécu en `brand-*` jusqu'à la vérification finale.

**Le seul contrôle fiable est le compteur global ramené à zéro :**

```bash
grep -c "brand-" src/app/offre/\[id\]/offer-client.tsx    # doit finir à 0
grep -c "luxury-" src/app/offre/\[id\]/offer-client.tsx   # doit finir à 0
```

Pas la couverture apparente des tâches. Vérifie ces compteurs à la fin de chaque tâche, pas seulement à la fin du lot.

---

## Structure des fichiers

| Fichier | Responsabilité | État de départ |
|---|---|---|
| `src/app/offre/[id]/offer-client.tsx` | Fiche, galerie, formulaire d'inscription intégré, avis, barre fixe | 549 lignes, 59 `brand-*`, 9 `luxury-*`, 4 « DT » |
| `src/components/booking-calendar.tsx` | Calendrier mono-service (utilisé **uniquement** ici) | 267 lignes, 28 `brand-*`, 2 `luxury-*` |

### Les interdits, localisés

| Interdit | Emplacement | Nature |
|---|---|---|
| `backdrop-blur-md` | `offer-client.tsx:227` | flou |
| `bg-gradient-to-br` | `offer-client.tsx:240` | dégradé |
| `luxury-image-reveal` | `offer-client.tsx:240` | **animation de 1,2 s** |
| `text-gray-400` | `offer-client.tsx:301` | hors palette |
| `text-red-600` / `bg-red-50` / `border-red-100` | `offer-client.tsx:330` | hors palette |
| `shadow-sm` | `booking-calendar.tsx:163` | ombre |

### Les classes `.luxury-*` et ce qu'elles produisent

Vérifié dans `globals.css` — utile pour savoir par quoi les remplacer :

- `.luxury-heading` (5 usages) → police de titre. Devient `.ds-display`.
- `.luxury-badge` (2 usages) → pastille encadrée, 0.7rem, majuscules, `letter-spacing: 0.18em`. Devient un surtitre `text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft`.
- `.luxury-divider` (1 usage) → filet doré de 2,5rem centré. Devient un filet `hairline`.
- `.luxury-image-reveal` (1 usage) → **animation** `imageReveal 1.2s ease-out`, de `opacity: 0` + `scale(1.04)`. **Supprimée** : le design system n'a qu'un mouvement, le `scale(0.97)` de 120 ms à l'appui. L'image s'affichera immédiatement. C'est un changement de comportement perçu, décidé dans la spec.

### Ce qu'il ne faut sous aucun prétexte modifier

- `createBooking` et son `POST /api/bookings` avec `trackingToken`
- `handleBook` : l'enchaînement inscription → `signIn("credentials")` → `updateSession()` → `createBooking`, et le `autoVerify: true` qui permet de réserver avant vérification de l'e-mail
- **Le `useEffect` qui écrit `tracking_ref` dans localStorage** (lignes 90-94) — c'est le mécanisme d'attribution des commissions d'influenceuses
- `slotsByDay`, `availableDates`, `grid`, `canGoPrev` dans le calendrier
- Les états `showBooking`, `authMode`, `selectedPhoto` et la galerie de photos
- **La taille des cases du calendrier** (~35px, sous les 44px réglementaires). Sept colonnes dans 272px ne peuvent pas donner 44px sans repenser la grille : hors périmètre, assumé dans la spec, identique au lot 4.

---

## Tâche 0 : vérifier le point de départ

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : confirmer la branche**

```bash
git branch --show-current
git status --short
```

Attendu : `design-lot5`, arbre propre. La branche part de `main` à jour (lot 4 mergé, PR #16) et la spec y est déjà commitée.

- [ ] **Étape 2 : établir la ligne de base des tests**

```bash
npm test 2>&1 | grep -E "Test Files|Tests "
```

Attendu : **180 tests au vert**, 13 fichiers. Ce nombre ne devra pas bouger.

- [ ] **Étape 3 : noter les compteurs de départ**

```bash
grep -c "brand-" "src/app/offre/[id]/offer-client.tsx"
grep -c "luxury-" "src/app/offre/[id]/offer-client.tsx"
grep -c "DT" "src/app/offre/[id]/offer-client.tsx"
grep -c "brand-" src/components/booking-calendar.tsx
grep -c "luxury-" src/components/booking-calendar.tsx
```

Attendu : `59`, `9`, `4`, `28`, `2`. Tous doivent valoir **0** à la fin du lot.

- [ ] **Étape 4 : noter la ligne de base ESLint**

```bash
npm run lint 2>&1 | tail -2
```

Attendu : `✖ 52 problems (40 errors, 12 warnings)`. Ce sont des défauts préexistants sur `main` ; le nombre ne doit pas augmenter.

---

## Tâche 1 : le calendrier

On commence par le fichier le plus autonome. Il est presque identique à `multi-service-calendar.tsx` traité au lot 4 — même structure, même légende — avec **une différence importante : il affiche la capacité restante de chaque créneau**, information à conserver.

**Fichiers :**
- Modifier : `src/components/booking-calendar.tsx:96-266`

Ne touche à **rien** au-dessus de la ligne 96 : `slotsByDay`, `availableDates`, `grid`, `canGoPrev`, les helpers `dateKey`/`startOfMonth`/`addMonths`/`isSameDay`, les constantes `MONTHS`/`WEEKDAYS` et les interfaces sont la logique du composant.

- [ ] **Étape 1 : l'en-tête du mois**

Remplace les lignes 97 à 131 (de `    <div className="space-y-6">` jusqu'au `</div>` qui ferme l'en-tête du mois, juste avant `        {/* Weekdays */}`) par :

```tsx
    <div className="space-y-6">
      {/* Calendar */}
      <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5 md:p-6">
        {/* Month header */}
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
            <p className="ds-display text-lg text-prune">
              {MONTHS[viewMonth.getMonth()]}
            </p>
            <p className="mt-0.5 text-sm text-prune-soft">
              {viewMonth.getFullYear()}
            </p>
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

Les flèches passent de 36px (`w-9 h-9`) à **44px** (`h-11 w-11`). `.ds-press` gère `:disabled`, donc `disabled:opacity-30 disabled:cursor-not-allowed` devient superflu.

- [ ] **Étape 2 : les en-têtes de jours et la grille**

Remplace les lignes 133 à 188 (de `        {/* Weekdays */}` jusqu'au `</div>` qui ferme la grille des jours, juste avant `        {/* Legend */}`) par :

```tsx
        {/* Weekdays */}
        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-prune-soft"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {grid.map(({ date, key }) => {
            if (!date) {
              return <div key={key} className="aspect-square" />;
            }
            const k = dateKey(date);
            const isPast = date.getTime() < today.getTime();
            const isToday = isSameDay(date, today);
            const isAvailable = availableDates.has(k);
            const isSelected = selectedDate === k;

            const base =
              "ds-press ds-focus relative flex aspect-square flex-col items-center justify-center rounded-[var(--radius-panel)] text-sm";
            let classes = "";

            if (isPast) {
              classes = "text-prune-soft/30 cursor-not-allowed";
            } else if (isSelected) {
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
                onClick={() => setSelectedDate(k)}
                className={`${base} ${classes}`}
              >
                <span>{date.getDate()}</span>
                {isToday && !isSelected && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-rose" />
                )}
              </button>
            );
          })}
        </div>
```

Deux points :

- `shadow-sm` (interdit) disparaît du jour sélectionné.
- **La pastille « disponible » est volontairement supprimée** (l'ancien `<span className="absolute bottom-1 w-1 h-1 rounded-full bg-brand-gold" />`). Elle existait parce que l'état disponible était un doré très pâle presque invisible ; le fond `menthe` plein se voit parfaitement, la pastille ferait doublon. Le point « aujourd'hui » est **conservé** et passe en rose.

Ne change pas `aspect-square` : les cases font ~35px sur mobile, sous les 44px du système, c'est connu et hors périmètre.

- [ ] **Étape 3 : la légende**

Remplace les lignes 190 à 202 (de `        {/* Legend */}` jusqu'au `</div>` qui ferme la carte du calendrier) par :

```tsx
        {/* Legend */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-5 border-t border-hairline pt-4">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-prune-soft">
            <span className="h-3 w-3 rounded-full bg-menthe" /> Disponible
          </span>
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-prune-soft">
            <span className="h-3 w-3 rounded-full border border-hairline bg-creme" /> Indisponible
          </span>
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-prune-soft">
            <span className="h-3 w-3 rounded-full bg-rose" /> Sélectionné
          </span>
        </div>
      </div>
```

- [ ] **Étape 4 : les créneaux horaires et les messages**

Remplace les lignes 204 à 265 (de `      {/* Time slots for selected date */}` jusqu'à `    </div>` inclus — le `</div>` qui ferme le `space-y-6`, mais **PAS** le `  );` ni le `}` finaux) par :

```tsx
      {/* Time slots for selected date */}
      {selectedDate && (
        <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5 md:p-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">Horaires</p>
          <h3 className="ds-display mb-4 text-lg text-prune">
            {new Date(selectedDate).toLocaleDateString("fr-TN", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h3>
          {selectedSlots.length === 0 ? (
            <p className="py-3 text-sm text-prune-soft">Aucun horaire pour cette date</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {selectedSlots.map((s) => {
                const full = s.bookedCount >= s.capacity;
                const active = selectedSlotId === s.id;
                const start = new Date(s.startTime);
                const end = new Date(s.endTime);
                return (
                  <button
                    type="button"
                    key={s.id}
                    disabled={full}
                    onClick={() => onSelect(s.id)}
                    className={`ds-press ds-focus min-h-[44px] rounded-[var(--radius-panel)] border-2 px-3 py-2 text-sm ${
                      active
                        ? "border-rose bg-rose text-white"
                        : full
                        ? "cursor-not-allowed border-hairline bg-creme text-prune-soft"
                        : "border-hairline text-prune hover:border-rose"
                    }`}
                  >
                    <div className="font-semibold">
                      {start.toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" })}
                      {" — "}
                      {end.toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="mt-0.5 text-xs opacity-80">
                      {full ? "Complet" : `${s.capacity - s.bookedCount} place${s.capacity - s.bookedCount > 1 ? "s" : ""}`}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!selectedDate && availableDates.size > 0 && (
        <p className="text-center text-sm text-prune-soft">
          Sélectionne une date en vert pour voir les horaires disponibles
        </p>
      )}

      {availableDates.size === 0 && (
        <p className="py-3 text-center text-sm text-prune-soft">
          Aucun créneau disponible pour cette offre
        </p>
      )}
    </div>
```

**Deux points cruciaux :**

- **« en doré » devient « en vert ».** Ce texte décrit une couleur affichée à l'écran, et les dates disponibles sont désormais menthe. Ne pas le changer en ferait un mensonge.
- **L'affichage de la capacité est conservé** (« 3 places » / « Complet »), ainsi que le `disabled={full}` sur les créneaux complets. C'est la différence avec le calendrier du lot 4 — cette information n'existe pas là-bas.

- [ ] **Étape 5 : vérifier**

```bash
grep -c "brand-" src/components/booking-calendar.tsx
grep -c "luxury-" src/components/booking-calendar.tsx
grep -n -E "shadow|gradient|blur|text-red|text-amber|text-gray" src/components/booking-calendar.tsx
grep -c "slotsByDay\|availableDates\|canGoPrev" src/components/booking-calendar.tsx
grep -n "en vert\|en doré" src/components/booking-calendar.tsx
grep -c "Complet\|place" src/components/booking-calendar.tsx
npx tsc --noEmit 2>&1 | grep -E "offer-client|booking-calendar"
npm test 2>&1 | grep -E "Test Files|Tests "
```

Attendu : `brand-` et `luxury-` à **0** ; aucun interdit ; la logique présente (≥ 3) ; « en vert » présent et « en doré » absent ; la capacité conservée (≥ 1) ; aucune sortie de `tsc` ; **180 tests au vert**.

- [ ] **Étape 6 : commit**

```bash
git add src/components/booking-calendar.tsx
git commit -m "feat(design): calendrier de reservation au design system"
```

---

## Tâche 2 : navigation, galerie et prix

**Fichiers :**
- Modifier : `src/app/offre/[id]/offer-client.tsx:45-56` (StarRating), `:224-261` (nav + galerie), `:293-317` (prix)

- [ ] **Étape 1 : les étoiles d'avis**

`StarRating` est **local à ce fichier** (défini ligne 45) — le modifier n'affecte aucune autre page. Remplace les lignes 45 à 56 par :

```tsx
function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const sizeClass = size === "lg" ? "text-lg" : "text-sm";
  return (
    <span className={`${sizeClass} tracking-wider`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? "text-rose" : "text-hairline"}>
          ★
        </span>
      ))}
    </span>
  );
}
```

- [ ] **Étape 2 : le fond de page et la barre de navigation**

Remplace les lignes 224 à 234 (de `  return (` jusqu'à `      </nav>` inclus) par :

```tsx
  return (
    <div className="min-h-screen bg-creme">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-hairline bg-creme">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-12">
          <Logo className="text-xl" />
          <Link
            href="/offres"
            className="ds-focus rounded-[var(--radius-pill)] px-2 py-1 text-base text-prune-soft hover:text-rose"
          >
            Toutes les offres
          </Link>
        </div>
      </nav>
```

**Attention : c'est le SECOND `return (` du fichier.** Le premier est vers la ligne 192, dans le bloc `if (success) {` — il est traité par la tâche 5, n'y touche pas.

Trois changements de fond : `backdrop-blur-md` disparaît (interdit) ; le fond passe de `bg-white/80` translucide à `bg-creme` opaque (un fond translucide sans flou laisserait voir le contenu défiler dessous) ; `z-50` devient `z-40`, car `z-50` est réservé à la barre de navigation du bas.

- [ ] **Étape 3 : la galerie de photos**

Remplace les lignes 238 à 260 (de `          {/* Image */}` jusqu'au `</div>` qui ferme le bloc image, juste avant `          {/* Info */}`) par :

```tsx
          {/* Image */}
          <div className="space-y-3">
            <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-rose-soft">
              {offer.photos.length > 0 ? (
                <UploadedImage src={offer.photos[selectedPhoto]} alt={offer.title} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
              ) : (
                <span className="text-8xl opacity-30">💇‍♀️</span>
              )}
            </div>
            {offer.photos.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {offer.photos.map((photo, i) => (
                  <button
                    key={photo}
                    type="button"
                    onClick={() => setSelectedPhoto(i)}
                    aria-label={`Voir la photo ${i + 1}`}
                    aria-pressed={i === selectedPhoto}
                    className={`ds-press ds-focus relative aspect-square overflow-hidden rounded-[var(--radius-panel)] border-2 ${
                      i === selectedPhoto ? "border-rose" : "border-transparent hover:border-rose"
                    }`}
                  >
                    <UploadedImage src={photo} alt={`Photo ${i + 1}`} fill sizes="100px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
```

Trois choses disparaissent de la ligne 240 : `bg-gradient-to-br from-brand-nude to-brand-peach` (dégradé interdit, remplacé par un `bg-rose-soft` plat) et **`luxury-image-reveal`** — une animation d'apparition de 1,2 s. Le design system n'a qu'un mouvement, le `scale(0.97)` de `.ds-press`. L'image s'affiche désormais immédiatement : c'est un changement de comportement perçu, décidé dans la spec.

Les vignettes gagnent `aria-label` et `aria-pressed` : ce sont des boutons qui changent l'image principale, un lecteur d'écran doit pouvoir l'annoncer. Elles n'en avaient aucun.

- [ ] **Étape 4 : le bloc « Info » — catégorie, note, salon et titre**

Cette section est celle que le découpage par bornes aurait laissée de côté : elle
se trouve entre la galerie et le prix, et contient le `<h1>` de la page.

Remplace les lignes 263 à 291 (de `          {/* Info */}` jusqu'au `</h1>` qui
ferme le titre de l'offre) par :

```tsx
          {/* Info */}
          <div className="flex flex-col justify-center">
            {/* Salon + quartier — above the fold on mobile */}
            <div className="mb-3 flex items-center gap-2">
              <Badge tone="prune">{offer.category}</Badge>
              {reviews.length > 0 && (
                <div className="flex items-center gap-1">
                  <StarRating rating={Math.round(avgRating)} />
                  <span className="text-sm text-prune-soft">
                    {avgRating.toFixed(1)} · {reviews.length} avis
                  </span>
                </div>
              )}
            </div>

            <p className="text-base font-semibold text-prune">
              {offer.provider.salonName}
            </p>
            {offer.provider.city && (
              <p className="mt-0.5 text-sm text-prune-soft">
                📍 {offer.provider.city}
              </p>
            )}

            <h1 className="ds-display mt-4 text-2xl text-prune md:text-4xl">
              {offer.title}
            </h1>
```

La catégorie passe en `<Badge tone="prune">` — c'est une étiquette de
classification, pas une disponibilité (menthe) ni une remise (rose).

- [ ] **Étape 5 : le bloc de prix**

Remplace les lignes 293 à 313 (de `            {/* Price */}` jusqu'au `</div>` qui ferme le bloc prix) par :

```tsx
            {/* Price */}
            <div className="mt-5 mb-6 border-b border-hairline pb-6">
              <div className="flex items-baseline gap-3">
                <span className="ds-display text-3xl text-prune sm:text-4xl">
                  {offer.discountPrice.toFixed(0)} TND
                </span>
                {offer.originalPrice > offer.discountPrice && (
                  <>
                    <span className="text-base text-prune-soft line-through sm:text-lg">
                      {offer.originalPrice.toFixed(0)} TND
                    </span>
                    <Badge tone="rose">-{discount}%</Badge>
                  </>
                )}
              </div>
              <p className="mt-2 text-sm text-prune-soft">
                TVA incluse : {Number(offer.taxRate ?? 19)}%
              </p>
            </div>
```

Deux « DT » sur quatre sont traités ici. `text-gray-400` (hors palette) devient `prune-soft`. La remise passe en `<Badge tone="rose">`, usage documenté du badge rose.

- [ ] **Étape 6 : importer `Badge`**

Après la ligne 8 (`import { UploadedImage } from "@/components/uploaded-image";`), ajoute :

```tsx
import { Badge } from "@/components/ui/badge";
```

- [ ] **Étape 7 : vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -E "offer-client|booking-calendar"
grep -n -E "gradient|blur|luxury-image-reveal|text-gray" "src/app/offre/[id]/offer-client.tsx"
grep -c "DT" "src/app/offre/[id]/offer-client.tsx"
grep -c "selectedPhoto\|tracking_ref" "src/app/offre/[id]/offer-client.tsx"
```

Attendu : aucune sortie de `tsc` ; aucun dégradé, flou, animation ni gris ; **2** « DT » restants (bouton de soumission et barre fixe, tâches 3 et 4) ; la galerie et le tracking intacts (≥ 3).

- [ ] **Étape 8 : commit**

```bash
git add "src/app/offre/[id]/offer-client.tsx"
git commit -m "feat(design): navigation, galerie, info et prix de la fiche offre"
```

---

## Tâche 3 : le formulaire de réservation et l'inscription intégrée

C'est la pièce maîtresse du lot. Ce formulaire permet à une visiteuse arrivée d'Instagram de créer un compte et de réserver sans quitter la page.

**Fichiers :**
- Modifier : `src/app/offre/[id]/offer-client.tsx:319-463`

- [ ] **Étape 1 : le bouton d'ouverture et le début du formulaire**

Remplace les lignes 319 à 343 (de `            {/* CTA — desktop button…` jusqu'au `</div>` qui ferme le bloc « 1. Choisir un créneau ») par :

```tsx
            {/* CTA — desktop button (mobile uses the sticky bar at bottom) */}
            {!showBooking ? (
              <div className="hidden md:block">
                <Button onClick={() => setShowBooking(true)} fullWidth>
                  Réserver maintenant
                </Button>
              </div>
            ) : (
              <form onSubmit={handleBook} className="space-y-6 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-6">
                {error && (
                  <div className="rounded-[var(--radius-panel)] border-2 border-rose bg-rose-soft p-3 text-sm font-semibold text-prune">
                    {error}
                  </div>
                )}

                {/* 1. Slot picker */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">
                    1. Choisir un créneau
                  </p>
                  <BookingCalendar
                    slots={offer.slots}
                    selectedSlotId={selectedSlot}
                    onSelect={setSelectedSlot}
                  />
                </div>
```

Le bloc d'erreur perd ses trois classes rouges (`text-red-600`, `bg-red-50`, `border-red-100`) — hors palette. Il devient un encadré `rose` sur `rose-soft`, seule couleur d'alerte du système, avec un texte en `prune` pour le contraste.

- [ ] **Étape 2 : les onglets d'authentification**

Remplace les lignes 345 à 375 (de `                {/* 2. Inline auth…` jusqu'au `</div>` qui ferme le bloc des deux onglets, juste avant `                    <div className="space-y-3">`) par :

```tsx
                {/* 2. Inline auth — only if not signed in */}
                {!session && (
                  <div className="border-t border-hairline pt-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">
                      2. Tes coordonnées
                    </p>

                    {/* Onglets refaits a la main : RoleTabs est code en dur pour
                        les trois roles (CLIENT/PROVIDER/INFLUENCER) et ne peut
                        pas porter cet axe-ci. On reprend son apparence. */}
                    <div
                      role="tablist"
                      aria-label="Type de compte"
                      className="mb-4 flex gap-1 rounded-[var(--radius-pill)] bg-rose-soft p-1"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={authMode === "register"}
                        onClick={() => setAuthMode("register")}
                        className={`ds-press ds-focus min-h-[44px] flex-1 rounded-[var(--radius-pill)] px-3 text-sm font-semibold ${
                          authMode === "register"
                            ? "bg-rose text-white"
                            : "bg-transparent text-prune hover:bg-white/60"
                        }`}
                      >
                        Nouveau client
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={authMode === "login"}
                        onClick={() => setAuthMode("login")}
                        className={`ds-press ds-focus min-h-[44px] flex-1 rounded-[var(--radius-pill)] px-3 text-sm font-semibold ${
                          authMode === "login"
                            ? "bg-rose text-white"
                            : "bg-transparent text-prune hover:bg-white/60"
                        }`}
                      >
                        J&apos;ai déjà un compte
                      </button>
                    </div>
```

L'onglet actif est rose plein, comme dans `RoleTabs` sur les pages Connexion et Inscription. Ce n'est pas une action concurrente du bouton « Réserver » mais un **état de sélection**, au même titre que la date choisie dans le calendrier.

Les attributs `role="tablist"` / `role="tab"` / `aria-selected` sont repris de `RoleTabs` : sans eux, un lecteur d'écran annonce deux boutons quelconques au lieu d'un sélecteur à deux positions.

- [ ] **Étape 3 : les champs de saisie**

Remplace les lignes 377 à 428 (de `                    <div className="space-y-3">` jusqu'au `                )}` qui ferme le bloc `{!session && (`) par :

```tsx
                    <div className="space-y-4">
                      {authMode === "register" && (
                        <>
                          <Input
                            label="Nom complet"
                            id="auth-name"
                            type="text"
                            value={authName}
                            onChange={(e) => setAuthName(e.target.value)}
                            placeholder="Ton nom"
                            required={authMode === "register"}
                            autoComplete="name"
                          />
                          <Input
                            label="Téléphone (optionnel)"
                            id="auth-phone"
                            type="tel"
                            value={authPhone}
                            onChange={(e) => setAuthPhone(e.target.value)}
                            placeholder="00 000 000"
                            autoComplete="tel"
                          />
                        </>
                      )}
                      <Input
                        label="Email"
                        id="auth-email"
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="toi@exemple.com"
                        required
                        autoComplete="email"
                      />
                      <Input
                        label={authMode === "register" ? "Mot de passe (min. 6 caractères)" : "Mot de passe"}
                        id="auth-password"
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••"
                        required
                        minLength={authMode === "register" ? 6 : undefined}
                        autoComplete={authMode === "register" ? "new-password" : "current-password"}
                      />
                      {authMode === "login" && (
                        <Link
                          href="/forgot-password"
                          className="ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] text-sm font-semibold text-prune-soft hover:text-rose"
                        >
                          Mot de passe oublié ?
                        </Link>
                      )}
                    </div>
                  </div>
                )}
```

**Pourquoi le primitif `Input` change quelque chose de réel :** il impose `min-h-[52px]` et `text-base`. Les champs actuels sont en `text-sm` — **sous 16px, iOS zoome automatiquement au focus** et casse la mise en page. C'est un défaut concret sur le parcours d'inscription mobile, précisément celui des visiteuses venues d'Instagram.

`Input` exige un `label` et un `id`. Les champs n'avaient que des `placeholder` : aucune étiquette pour un lecteur d'écran, et un libellé qui disparaît dès qu'on tape. Le passage au primitif corrige les deux. Les astérisques `*` disparaissent des libellés — l'attribut `required` porte déjà l'information, et le champ facultatif est explicitement marqué « (optionnel) ».

- [ ] **Étape 4 : les notes et les boutons de soumission**

Remplace les lignes 430 à 461 (de `                {/* 3. Notes */}` jusqu'au `</div>` qui ferme le bloc des deux boutons, juste avant `              </form>`) par :

```tsx
                {/* 3. Notes */}
                <div className="border-t border-hairline pt-5">
                  <label
                    htmlFor="booking-notes"
                    className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft"
                  >
                    {session ? "2." : "3."} Notes (optionnel)
                  </label>
                  <textarea
                    id="booking-notes"
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    rows={2}
                    className="ds-focus w-full rounded-[var(--radius-panel)] border-2 border-hairline bg-white px-4 py-3 text-base text-prune placeholder:text-prune-soft/50"
                    placeholder="Précisions, préférences…"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1">
                    <Button type="submit" disabled={loading} fullWidth>
                      {loading
                        ? "Traitement…"
                        : `Réserver · ${offer.discountPrice.toFixed(0)} TND`}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowBooking(false)}
                  >
                    Annuler
                  </Button>
                </div>
```

Le `<p>` qui surmontait le `<textarea>` devient un vrai `<label htmlFor>` : le champ n'était associé à aucune étiquette. Le `text-sm` passe à `text-base`, même raison qu'au-dessus.

**C'est le seul `Button` primaire de cet écran.** « Annuler » est en variante fantôme.

Les deux boutons passent en colonne sur mobile (`flex-col sm:flex-row`) : côte à côte, « Réserver · 45 TND » et « Annuler » se serrent trop sur un écran étroit.

- [ ] **Étape 5 : importer `Button` et `Input`**

Près des autres imports, ajoute :

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
```

- [ ] **Étape 6 : vérifier que la logique d'authentification est intacte**

```bash
npx tsc --noEmit 2>&1 | grep -E "offer-client|booking-calendar"
grep -c "autoVerify\|signIn(\"credentials\"\|updateSession\|createBooking" "src/app/offre/[id]/offer-client.tsx"
grep -c "trackingToken\|tracking_ref" "src/app/offre/[id]/offer-client.tsx"
grep -n -E "text-red|bg-red|border-red|text-gray" "src/app/offre/[id]/offer-client.tsx"
grep -c "DT" "src/app/offre/[id]/offer-client.tsx"
npm test 2>&1 | grep -E "Test Files|Tests "
```

Attendu : aucune sortie de `tsc` ; l'enchaînement d'authentification intact (≥ 4) ; le tracking intact (≥ 3) ; aucune couleur hors palette ; **1** « DT » restant (la barre fixe, tâche 4) ; **180 tests au vert**.

- [ ] **Étape 7 : commit**

```bash
git add "src/app/offre/[id]/offer-client.tsx"
git commit -m "feat(design): formulaire de reservation et inscription integree"
```

---

## Tâche 4 : le salon, les avis et la barre fixe

**Fichiers :**
- Modifier : `src/app/offre/[id]/offer-client.tsx:467-546`

- [ ] **Étape 1 : le bloc « Le salon »**

Remplace les lignes 467 à 487 (de `        {/* Provider info */}` jusqu'au `</div>` qui ferme ce bloc) par :

```tsx
        {/* Provider info */}
        <div className="mt-16 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-8 md:mt-24 md:p-12">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Le salon</p>
          <h2 className="ds-display mb-3 text-xl text-prune">
            {offer.provider.salonName}
          </h2>
          {offer.provider.description && (
            <p className="text-base leading-relaxed text-prune-soft">{offer.provider.description}</p>
          )}
          {offer.provider.city && (
            <p className="mt-4 text-sm text-prune-soft">
              {offer.provider.city}
            </p>
          )}
          <Link
            href={`/salon/${offer.provider.id}`}
            className="ds-press ds-focus mt-6 inline-flex min-h-[48px] items-center justify-center rounded-[var(--radius-pill)] border-2 border-hairline px-6 text-base font-semibold text-prune hover:border-rose"
          >
            Voir le salon
          </Link>
        </div>
```

`luxury-badge` (surtitre encadré doré) devient un surtitre simple. Le lien « Voir le salon » est en variante fantôme — le rose est déjà pris par « Réserver ». C'est un `<Link>` et non un `<Button>` : `Button` rend un `<button>`, qui ne navigue pas. On reproduit son apparence à la main, volontairement.

- [ ] **Étape 2 : la section des avis**

Remplace les lignes 489 à 533 (de `        {/* Reviews section */}` jusqu'au `</div>` qui ferme la section) par :

```tsx
        {/* Reviews section */}
        <div className="mt-16 md:mt-24">
          <div className="mb-10 text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Avis clients</p>
            {reviews.length > 0 ? (
              <div className="flex items-center justify-center gap-3">
                <StarRating rating={Math.round(avgRating)} size="lg" />
                <span className="ds-display text-2xl text-prune">{avgRating.toFixed(1)}</span>
                <span className="text-base text-prune-soft">/ 5</span>
                <span className="ml-2 text-sm text-prune-soft">({reviews.length} avis)</span>
              </div>
            ) : (
              <p className="text-base text-prune-soft">Aucun avis pour le moment</p>
            )}
            <div className="mx-auto mt-6 h-px w-10 bg-hairline" />
          </div>

          <div className="mx-auto max-w-2xl space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-6">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-soft text-sm font-bold text-prune">
                      {review.clientName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-prune">{review.clientName}</p>
                      <p className="text-xs text-prune-soft">
                        {new Date(review.createdAt).toLocaleDateString("fr-TN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <StarRating rating={review.rating} />
                </div>
                {review.comment && (
                  <p className="text-sm leading-relaxed text-prune-soft">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        </div>
```

`luxury-divider` (filet doré) devient un filet `hairline`. L'initiale du client passe de 32px carrés à un disque de 40px, cohérent avec les pastilles du système.

- [ ] **Étape 3 : la barre fixe mobile**

Remplace les lignes 536 à 546 (de `      {/* Mobile sticky CTA…` jusqu'au `      )}` qui ferme le bloc) par :

```tsx
      {/* Barre fixe mobile — se pose au-dessus de BottomNav, qui occupe
          fixed bottom-0 z-50 h-[60px] avec la safe-area. Sans le calc(),
          la barre passe SOUS la navigation sur les iPhone a encoche. */}
      {!showBooking && (
        <div
          className="fixed left-0 right-0 z-40 border-t border-hairline bg-white p-4 md:hidden"
          style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}
        >
          <Button onClick={() => setShowBooking(true)} fullWidth>
            Réserver maintenant — {offer.discountPrice.toFixed(0)} TND
          </Button>
        </div>
      )}
```

**Le vrai correctif de cette tâche.** L'ancienne version utilisait `bottom-[60px]` en dur, **sans la safe-area** : sur un iPhone à encoche, la barre passait sous la barre de navigation. C'est exactement le défaut corrigé au lot 4 sur la fiche salon.

`z-40` reste sous le `z-50` de `BottomNav`. Le conteneur a déjà `pb-32 md:pb-20` (ligne 236) — ne le change pas, il joue le même rôle que le `pb-40` du lot 4.

Le dernier « DT » devient « TND ».

- [ ] **Étape 4 : vérifier**

```bash
npx tsc --noEmit 2>&1 | grep -E "offer-client|booking-calendar"
grep -c "DT" "src/app/offre/[id]/offer-client.tsx"
grep -n "safe-area-inset-bottom" "src/app/offre/[id]/offer-client.tsx" src/components/bottom-nav.tsx
grep -n "z-40\|z-50" "src/app/offre/[id]/offer-client.tsx" src/components/bottom-nav.tsx
```

Attendu : aucune sortie de `tsc` ; **0** « DT » ; la safe-area présente dans les deux fichiers ; `z-40` dans offer-client, `z-50` dans bottom-nav.

- [ ] **Étape 5 : commit**

```bash
git add "src/app/offre/[id]/offer-client.tsx"
git commit -m "feat(design): salon, avis et barre fixe de la fiche offre"
```

---

## Tâche 5 : l'écran de succès et la chasse aux interstices

L'écran affiché après réservation, plus le contrôle qui a manqué au lot 4.

**Fichiers :**
- Modifier : `src/app/offre/[id]/offer-client.tsx:191-222`

- [ ] **Étape 1 : l'écran de succès**

Remplace les lignes 191 à 222 (le bloc `if (success) {` en entier) par :

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
            Ta réservation pour <strong className="font-semibold text-prune">{offer.title}</strong> a été enregistrée.
            Procède au paiement pour recevoir ton QR code de confirmation.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href={`/cliente/paiement?bookingId=${bookingId}`}
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

La coche passe en `menthe` — confirmation, son usage exact. Le texte passe au tutoiement et retrouve ses accents (l'original écrivait « Reservation enregistree », sans accents). « Payer maintenant » est rose : c'est un écran distinct avec sa propre action principale, la règle est respectée.

Les deux liens sont des `<Link>` et non des `<Button>` : `Button` rend un `<button>`, qui ne navigue pas. Apparence reproduite à la main, volontairement.

- [ ] **Étape 2 : la chasse aux interstices — l'étape que le lot 4 a manquée**

```bash
grep -n "brand-" "src/app/offre/[id]/offer-client.tsx"
grep -n "luxury-" "src/app/offre/[id]/offer-client.tsx"
```

**Attendu : aucune sortie.**

Si une ligne apparaît, c'est un interstice — du code situé entre deux bornes de tâches, qu'aucune n'a couvert. Au lot 4, un `<h2>` avait ainsi survécu. Corrige-le en appliquant les mêmes conventions que la section qui l'entoure : `.luxury-heading` → `ds-display text-prune`, `text-brand-bordeaux` → `text-prune`, `text-brand-bordeaux/50` → `text-prune-soft`, `border-brand-gold/20` → `border-2 border-hairline`, `bg-brand-cream` → `bg-creme`.

- [ ] **Étape 3 : vérifier l'ensemble du lot**

```bash
grep -c "brand-" "src/app/offre/[id]/offer-client.tsx"
grep -c "luxury-" "src/app/offre/[id]/offer-client.tsx"
grep -c "DT" "src/app/offre/[id]/offer-client.tsx"
grep -c "brand-" src/components/booking-calendar.tsx
grep -c "luxury-" src/components/booking-calendar.tsx
grep -n -E "shadow|gradient|blur|text-red|text-amber|text-gray" "src/app/offre/[id]/offer-client.tsx" src/components/booking-calendar.tsx
```

Attendu : **0** partout. `grep -c` renvoie 0 et sort en code 1 quand il ne trouve rien — c'est normal.

- [ ] **Étape 4 : commit**

```bash
git add "src/app/offre/[id]/offer-client.tsx"
git commit -m "feat(design): ecran de succes de la fiche offre"
```

---

## Tâche 6 : vérification finale

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : la logique protégée doit être intacte**

```bash
grep -c "tracking_ref" "src/app/offre/[id]/offer-client.tsx"
grep -c "trackingToken" "src/app/offre/[id]/offer-client.tsx"
grep -c "autoVerify" "src/app/offre/[id]/offer-client.tsx"
grep -c "signIn(\"credentials\"" "src/app/offre/[id]/offer-client.tsx"
grep -c "updateSession" "src/app/offre/[id]/offer-client.tsx"
grep -c "slotsByDay\|availableDates" src/components/booking-calendar.tsx
```

Attendu : tous ≥ 1. Si l'un vaut 0, une protection a sauté — **surtout `tracking_ref`**, qui porte l'attribution des commissions d'influenceuses. Corrige avant de continuer.

- [ ] **Étape 2 : types, lint, tests**

```bash
npx tsc --noEmit 2>&1 | grep -E "offer-client|booking-calendar"
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -2
npm test 2>&1 | grep -E "Test Files|Tests "
```

Attendu : **aucune sortie du premier grep** ; le second doit afficher **23** — le nombre exact d'erreurs préexistantes dans le module de caisse. S'il dépasse 23, ce lot a introduit une régression ailleurs. ESLint doit rester à **52 problèmes** (pas plus). **180 tests au vert**.

- [ ] **Étape 3 : le build**

```bash
npm run build 2>&1 | tail -15
```

Attendu : succès. Si le build échoue sur `ECONNREFUSED` / `PrismaClientKnownRequestError`, c'est que la base n'est pas démarrée — voir l'étape suivante, ce n'est pas un défaut du code.

- [ ] **Étape 4 : démarrer une base pour le contrôle du rendu**

Le prérendu a besoin d'une base. Si aucune ne tourne :

```bash
docker run -d --name salonista-lot5 -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=beaute_marketplace -p 5433:5432 postgres:16-alpine
until docker exec salonista-lot5 pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
npx prisma migrate deploy
npm run db:seed
npm run build
```

- [ ] **Étape 5 : vérifier le HTML réellement servi**

**Ce contrôle compte plus que les `grep` sur les sources.** Lors d'un lot précédent, il a révélé une police jamais téléchargée que le code montrait pourtant comme correcte.

**Le piège du seed, à connaître avant :** après un seed, une fiche offre renvoie 404 ou n'affiche rien, parce que `prisma/seed.ts:1141` écrit `publishedToMarketplace: false` alors que les pages exigent `true`. Ce n'est pas une panne. Il faut publier temporairement :

```bash
npm run start &
until curl -s -o /dev/null http://localhost:3000/; do sleep 1; done

# Publier les offres qui ont une photo (le filtre l'exige aussi)
docker exec salonista-lot5 psql -U postgres -d beaute_marketplace -c \
  "UPDATE \"Offer\" SET \"publishedToMarketplace\"=true WHERE array_length(photos,1) > 0;"

OFFER_ID=$(docker exec salonista-lot5 psql -U postgres -d beaute_marketplace -t -A -c \
  "SELECT id FROM \"Offer\" WHERE \"publishedToMarketplace\"=true LIMIT 1;" | tr -d '\r')
echo "offre testee : $OFFER_ID"

curl -s "http://localhost:3000/offre/$OFFER_ID" -o /tmp/offre.html -w "HTTP %{http_code}\n"

echo "--- interdits (doit valoir 0) ---"
grep -oE 'shadow-|gradient|backdrop-blur' /tmp/offre.html | wc -l
echo "--- brand-/luxury- (doit valoir 0) ---"
grep -oE 'brand-|luxury-' /tmp/offre.html | grep -v 'bg-brand-cream\|text-brand-ink\|luxury-heading' | wc -l
echo "--- TND present ---"
grep -o 'TND' /tmp/offre.html | wc -l
echo "--- DT absent (doit valoir 0) ---"
grep -oE '[0-9] DT\b' /tmp/offre.html | wc -l
```

Attendu : HTTP 200 ; **0** interdit ; « TND » présent ; **0** « DT ».

**Note sur les `brand-` résiduels du HTML :** le `<body>` du layout racine et le composant `<Logo>` utilisent encore `bg-brand-cream`, `text-brand-ink` et `luxury-heading`. Ces deux fichiers sont **hors du périmètre de ce lot** — ils apparaissent sur toutes les pages du site, y compris celles déjà livrées. Le filtre `grep -v` ci-dessus les écarte. Ce qui doit valoir 0, c'est tout le reste.

- [ ] **Étape 6 : remettre la base en état et nettoyer**

```bash
docker exec salonista-lot5 psql -U postgres -d beaute_marketplace -c \
  "UPDATE \"Offer\" SET \"publishedToMarketplace\"=false;"
kill %1
docker rm -f salonista-lot5
rm -f /tmp/offre.html
```

- [ ] **Étape 7 : pousser la branche**

```bash
git status --short   # doit etre vide
git push -u origin design-lot5
```

`gh` n'est pas installé : la PR s'ouvre depuis l'URL que git affiche après le push.

---

## Contrôle visuel — pour l'utilisatrice

Aucun outil automatique ne dit si une page est réussie. À vérifier à l'œil, mobile **et** desktop :

1. **La barre fixe sur mobile** — reste-t-elle **au-dessus** de la barre de navigation, sans la recouvrir ? C'est le correctif principal du lot.
2. **Le formulaire d'inscription** — ouvre « Réserver maintenant », bascule entre « Nouveau client » et « J'ai déjà un compte ». Les champs sont-ils confortables ? **Sur iPhone : la page ne doit plus zoomer** quand on tape dans un champ.
3. **Le parcours complet sans compte** — déconnecte-toi, choisis un créneau, inscris-toi, réserve. C'est le vrai test : c'est le parcours des visiteuses venues d'un lien d'influenceuse.
4. **Le calendrier** — dates disponibles en vert, date choisie en rose. Les créneaux affichent-ils toujours « 3 places » / « Complet » ?
5. **Une seule action rose** — hors onglet actif (état de sélection) et écran de succès, il ne doit y avoir qu'un bouton rose plein.
6. **La galerie** — clique les vignettes, l'image principale change-t-elle ? Elle s'affiche désormais **immédiatement**, sans l'ancien fondu d'1,2 s.

---

## Découvertes en cours d'exécution

### L'interstice — deuxième fois, rattrapé par le contrôle global

**La description de l'offre** (`<p>{offer.description}</p>`) n'était couverte par
aucune tâche : elle se trouve entre le bloc prix (tâche 2) et le formulaire
(tâche 3), et est restée en `text-brand-ink-soft`.

Trouvée par `grep -c "brand-"` en fin de tâche 4, exactement comme l'en-tête
oublié du lot 4. Corrigée dans le commit de la tâche 5.

**La leçon se confirme sur deux lots consécutifs :** un découpage par bornes de
sections laisse toujours des trous. Le compteur global ramené à zéro est le seul
contrôle qui les attrape.

### « DT » subsiste dans la méta-description SEO — hors périmètre

Le HTML servi contient encore quatre « DT », alors que les deux fichiers du lot
sont à zéro. Ils viennent de `src/app/offre/[id]/page.tsx:32`, la
`description` des métadonnées — **du texte indexé par Google, visible dans les
résultats de recherche**.

Un `grep` à l'échelle du dépôt montre que **plus de douze fichiers** utilisent
encore « DT » : tableaux de bord admin, cliente, influenceuse, et la caisse.

Ce lot ne les corrige pas — ce serait l'étendre bien au-delà de la fiche offre.
Mais c'est une incohérence réelle : le site affiche « TND » sur les pages
publiques refaites et « DT » ailleurs, y compris dans ce que Google indexe.
**À traiter comme un chantier à part**, d'un seul geste sur tout le dépôt.

---

### Le pattern ARIA tablist est incomplet — volontairement

La revue finale a relevé que nos onglets portent bien `role="tablist"`,
`role="tab"` et `aria-selected`, mais **pas la navigation clavier par flèches**
que décrit le pattern APG (onglet inactif en `tabIndex={-1}`, flèches
gauche/droite pour circuler).

Vérification faite avant de décider : **`RoleTabs` ne l'implémente pas non plus**
— le primitif déjà livré et validé sur les pages Connexion et Inscription.

Le corriger ici créerait un écart : deux sélecteurs d'apparence identique au
comportement clavier différent, ce qui est pire que deux sélecteurs
imparfaits mais cohérents. À traiter d'un seul geste sur les deux, dans un lot
d'accessibilité dédié.

Rien n'est cassé : un lecteur d'écran annonce correctement « onglet,
sélectionné », et les deux boutons restent atteignables au Tab.

---

## Ce que ce plan ne fait pas

- Le bas de l'accueil (lot 6).
- Il ne modifie pas `RoleTabs`, ni aucun primitif.
- Il ne supprime aucun token `brand-*` ni `pos-*` de `globals.css`, ni aucune classe `.luxury-*` — 142 fichiers en dépendent, dont la caisse en production.
- Il ne touche ni au layout racine ni au composant `<Logo>`, qui gardent des classes `brand-*` visibles sur toutes les pages.
- Il ne modifie ni `createBooking`, ni `handleBook`, ni l'écriture de `tracking_ref`.
- **Il ne redimensionne pas les cases du calendrier** (~35px, sous les 44px). Même limite qu'au lot 4 : à traiter une fois pour les deux calendriers, séparément.
- Il ne corrige pas le contraste `text-white` sur `bg-rose` (2,94:1, sous le seuil AA de 4,5:1). Le token vient du lot 1 et concerne tout le site.
