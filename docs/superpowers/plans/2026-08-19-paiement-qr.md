# Paiement et QR code — plan d'implémentation

> **Pour les agents :** SOUS-SKILL REQUISE — utilise superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** aligner les deux dernières pages de l'espace cliente sur le design system — le paiement et le QR code de confirmation.

**Architecture :** deux fichiers, 544 lignes, aucun composant créé. La page de paiement a trois états, chacun traité dans sa propre tâche. Deux éléments sont explicitement protégés : l'image du QR code et l'indicateur d'activité.

**Stack :** Next.js 16.2 (App Router), React 19, Tailwind v4.

---

## Contexte pour qui n'a jamais vu ce dépôt

### Ce que font ces deux pages

Elles ferment le parcours de réservation. Une cliente paie, reçoit un QR code, puis le présente au salon qui le scanne pour valider sa visite.

**Le QR code est une pièce justificative**, pas une décoration. S'il devient illisible, la cliente se retrouve devant un salon incapable de confirmer son rendez-vous.

### Le design system

Quatre couleurs : `rose` (#FF5C8A, **action**), `prune` (#3A1024, texte), `menthe` (#A8E6CF, disponibilités, économies, **confirmations**), `creme` (#FFF6F1, fond). Plus `rose-soft`, `prune-soft`, `menthe-deep`, `hairline`. Trois règles absolues :

1. **Aucune ombre, aucun dégradé, aucun flou.**
2. **Une seule action rose pleine par vue.**
3. **Cibles tactiles ≥ 44px**, corps de texte ≥ 16px.

Classes utilitaires dans `src/app/globals.css` : `.ds-press` (transition + `scale(0.97)` + gère `:disabled`), `.ds-focus` (anneau rose au focus), `.ds-display` (police de titre).

**Les tokens `brand-*` et `pos-*` ne doivent JAMAIS être supprimés de `globals.css`**, ni les classes `.luxury-*` : 142 fichiers en dépendent, dont la caisse en production.

### Les primitifs

```tsx
<Button variant="primary" | "secondary" | "ghost" fullWidth={false} />  // min-h-48px, rose par défaut
<Input label="…" id="…" />                                              // min-h-52px, text-base, label et id OBLIGATOIRES
<Badge tone="menthe" | "rose" | "prune">…</Badge>
```

---

## Les trois protections de ce lot

### 1. Le QR code n'est jamais retouché

Deux images, générées côté serveur :

| Fichier | Ligne | Classe |
|---|---|---|
| `paiement/page.tsx` | 130 | `w-64 h-64` |
| `reservation/page.tsx` | 113 | `w-56 h-56` |

**Ni leur taille, ni leur fond, ni leur contraste ne changent.** Un QR altéré devient illisible au scanner. Seul le **cadre** autour est restylé.

Ne mets pas de fond coloré derrière un QR, ne réduis pas sa taille, n'ajoute pas d'opacité — sauf celle qui existe déjà sur un QR déjà utilisé (`opacity-60`), qui signale un état et reste.

### 2. `animate-pulse` est conservé

L'écran « Traitement en cours » (ligne 209) utilise `animate-pulse`. Le design system interdit les **animations d'apparition** — pas les indicateurs d'activité.

Le paiement simule un délai de 2 secondes. Sans retour visuel, la cliente croit que rien ne se passe, sur l'écran le plus anxiogène du parcours. **`animate-pulse` reste.**

### 3. Le formulaire de carte n'envoie rien — et doit le dire

Vérifié : le `POST /api/payment` n'envoie que `{ bookingId }`. Les champs `cardNumber`, `expiry`, `cvv`, `cardName` **ne sont transmis nulle part**.

Deux conséquences :

- Une mention **« Paiement de démonstration — aucune donnée bancaire n'est transmise. »** apparaît sous le formulaire.
- Le surtitre **« Paiement securise » (ligne 224) disparaît.** Sur un formulaire qui ne transmet rien, promettre la sécurité est trompeur.

---

## Ce qu'il ne faut toucher sous aucun prétexte

| Élément | Où | Pourquoi |
|---|---|---|
| `handlePayment` et son `POST /api/payment` | paiement | La logique de paiement |
| Le `setTimeout` de 2 secondes | paiement, ligne 73 | Comportement assumé du stub |
| Les états `step` (`form`/`processing`/`success`) | paiement | L'enchaînement des écrans |
| `/api/client/bookings`, `/api/payment?bookingId=` | les deux | Les données |
| **Les `<Suspense>`** (3 occurrences par fichier) | les deux | **Obligatoires** avec `useSearchParams()` en Next 16 — les retirer casse le build |
| `qrCode`, `qrToken` | les deux | L'image et son jeton |

### Contraintes générales

- **Aucun test de composant n'est possible.** Vitest tourne en `environment: "node"` sans jsdom. N'en écris pas.
- **180 tests doivent rester au vert.**
- **`tsc` n'est pas propre :** 23 erreurs préexistent sur `main`. Filtre toujours sur nos fichiers.
- **ESLint : 52 problèmes sur `main`.** Ce nombre ne doit pas augmenter.
- Interface en français, **tutoiement**, casse de phrase.

### La leçon des lots précédents

Sur trois lots, le découpage par bornes a laissé une portion non couverte, restée en `brand-*` jusqu'au contrôle final.

**Vérifié avant d'écrire ce plan :** toutes les occurrences tombent dans les bornes ci-dessous. Le contrôle reste exigé à la fin de chaque tâche :

```bash
grep -c "brand-" <fichier>   # doit finir à 0
grep -c "luxury-" <fichier>  # doit finir à 0
```

---

## Structure des fichiers

| Fichier | Lignes | Bornes | Tâche |
|---|---|---|---|
| `paiement/page.tsx` | 355 | 31, 98-107 (garde) | 1 |
| | | 206-218 (traitement) | 1 |
| | | 220-355 (formulaire) | 2 |
| | | 110-203 (succès) | 3 |
| `reservation/page.tsx` | 189 | tout (28-180) | 4 |

L'ordre suit le parcours : garde et traitement d'abord (courts), puis le formulaire, puis le succès, puis le QR.

---

## Tâche 0 : vérifier le point de départ

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : confirmer la branche**

```bash
git branch --show-current
git status --short
git log --oneline -2
```

Attendu : `design-paiement-qr`, arbre propre, et le commit parent doit être le merge de la PR #25 (la branche a été rebasée sur `main` à jour).

- [ ] **Étape 2 : établir la ligne de base**

```bash
npm test 2>&1 | grep -E "Test Files|Tests "
npm run lint 2>&1 | tail -2
```

Attendu : **180 tests au vert** (13 fichiers), et `✖ 52 problems (40 errors, 12 warnings)`.

- [ ] **Étape 3 : noter les compteurs de départ**

```bash
grep -c "brand-" "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -c "luxury-" "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -c "brand-" "src/app/(dashboard)/cliente/reservation/page.tsx"
grep -c "luxury-" "src/app/(dashboard)/cliente/reservation/page.tsx"
```

Attendu : `48`, `10`, `25`, `5`. Tous doivent valoir **0** à la fin.

- [ ] **Étape 4 : noter ce qui doit survivre**

```bash
grep -c "Suspense" "src/app/(dashboard)/cliente/paiement/page.tsx" "src/app/(dashboard)/cliente/reservation/page.tsx"
grep -n "w-64 h-64\|w-56 h-56" "src/app/(dashboard)/cliente/paiement/page.tsx" "src/app/(dashboard)/cliente/reservation/page.tsx"
grep -c "animate-pulse" "src/app/(dashboard)/cliente/paiement/page.tsx"
```

Attendu : **3** `Suspense` par fichier ; les deux tailles de QR ; **1** `animate-pulse`. Ces trois nombres doivent être **identiques à la fin**.

---

## Tâche 1 : le garde et l'écran de traitement

Deux blocs courts, pour commencer.

**Fichiers :**
- Modifier : `src/app/(dashboard)/cliente/paiement/page.tsx:31`, `:98-107`, `:206-218`

- [ ] **Étape 1 : le fond du `<Suspense>`**

Ligne 31, remplace :

```tsx
    <Suspense fallback={<div className="min-h-screen bg-brand-cream" />}>
```

par :

```tsx
    <Suspense fallback={<div className="min-h-screen bg-creme" />}>
```

**Ne retire pas le `<Suspense>`** — il est obligatoire avec `useSearchParams()` en Next 16.

- [ ] **Étape 2 : le garde « aucune réservation »**

Remplace les lignes 98 à 107 par :

```tsx
  if (!bookingId) {
    return (
      <div className="py-20 text-center">
        <p className="text-base text-prune-soft">Aucune réservation sélectionnée</p>
        <Link
          href="/cliente"
          className="ds-press ds-focus mt-4 inline-flex min-h-[48px] items-center rounded-[var(--radius-pill)] border-2 border-hairline px-6 text-base font-semibold text-prune hover:border-rose"
        >
          Retour
        </Link>
      </div>
    );
  }
```

Le bouton est en **bordure**, pas en rose : c'est un écran d'erreur, pas une conversion.

- [ ] **Étape 3 : l'écran de traitement**

Remplace les lignes 206 à 218 par :

```tsx
  // Processing animation
  if (step === "processing") {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        {/* `animate-pulse` est CONSERVE : le design system interdit les
            animations d'APPARITION, pas les indicateurs d'activite. Le
            paiement simule 2 secondes — sans retour visuel, la cliente croit
            que rien ne se passe, sur l'ecran le plus anxiogene du parcours. */}
        <div className="mx-auto mb-6 flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-rose-soft">
          <svg className="h-8 w-8 text-prune" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="ds-display mb-2 text-xl text-prune">Traitement en cours</p>
        <p className="text-base text-prune-soft">Un instant…</p>
      </div>
    );
  }
```

« Veuillez patienter... » devient « Un instant… » — tutoiement et vraie ellipse.

- [ ] **Étape 4 : vérifier**

```bash
grep -c "Suspense" "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -c "animate-pulse" "src/app/(dashboard)/cliente/paiement/page.tsx"
npx tsc --noEmit 2>&1 | grep -E "paiement"
```

Attendu : `Suspense` toujours à **3**, `animate-pulse` à **1**, aucune sortie de `tsc`.

Rappel : `npx tsc --noEmit` sans filtre affiche 23 erreurs préexistantes ailleurs — ignore-les, ne les corrige sous aucun prétexte.

- [ ] **Étape 5 : commit**

```bash
git add "src/app/(dashboard)/cliente/paiement/page.tsx"
git commit -m "feat(design): garde et ecran de traitement du paiement"
```

---

## Tâche 2 : le formulaire de paiement

**Fichiers :**
- Modifier : `src/app/(dashboard)/cliente/paiement/page.tsx:220-355`

- [ ] **Étape 1 : lire le bloc actuel**

```bash
sed -n '220,355p' "src/app/(dashboard)/cliente/paiement/page.tsx"
```

Le formulaire contient : un en-tête, un résumé de réservation, un bloc d'erreur, quatre champs de carte, et le bouton de paiement.

- [ ] **Étape 2 : l'en-tête et le résumé**

Remplace les lignes 220 à 248 (de `  // Payment form` jusqu'à la fermeture du bloc résumé) par :

```tsx
  // Payment form
  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8">
        {/* Le surtitre « Paiement securise » a ete retire : le formulaire
            n'envoie aucune donnee bancaire (le POST ne transmet que
            bookingId), promettre la securite serait trompeur. */}
        <h1 className="ds-display text-2xl text-prune">Finaliser le paiement</h1>
      </div>

      {/* Booking summary */}
      {booking && (
        <div className="mb-6 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Résumé</p>
          <h3 className="ds-display text-lg text-prune">
            {booking.items.map((i) => i.offer.title).join(", ")}
          </h3>
          <p className="mt-1 text-sm text-prune-soft">{booking.items[0]?.offer.provider.salonName}</p>
          {booking.items[0]?.slot && (
            <p className="mt-1 text-sm text-prune-soft">
              {new Date(booking.items[0].slot.startTime).toLocaleDateString("fr-TN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          <p className="ds-display mt-3 text-2xl text-prune">
            {Number(booking.totalPrice).toFixed(0)} TND
          </p>
        </div>
      )}
```

**Adapte les bornes** si le contenu réel diffère : le repère est le bloc `{booking && (…)}` qui affiche le résumé, jusqu'à sa fermeture. Garde toutes les données affichées — titre, salon, date, montant.

- [ ] **Étape 3 : le bloc d'erreur, les champs et le bouton**

Remplace le reste du formulaire (du bloc `{error && …}` jusqu'à la fin du fichier) par :

```tsx
      {error && (
        <div className="mb-6 rounded-[var(--radius-panel)] border-2 border-rose bg-rose-soft p-4 text-sm font-semibold text-prune">
          {error}
        </div>
      )}

      <form onSubmit={handlePayment} className="space-y-5 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-8">
        <Input
          label="Nom sur la carte"
          id="carte-nom"
          type="text"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          placeholder="Comme inscrit sur la carte"
          required
        />

        <Input
          label="Numéro de carte"
          id="carte-numero"
          type="text"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          placeholder="0000 0000 0000 0000"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Expiration"
            id="carte-expiration"
            type="text"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            placeholder="MM/AA"
            required
          />
          <Input
            label="CVV"
            id="carte-cvv"
            type="text"
            value={cvv}
            onChange={(e) => setCvv(e.target.value)}
            placeholder="123"
            required
          />
        </div>

        <Button type="submit" disabled={loading} fullWidth>
          {loading ? "Traitement…" : `Payer ${booking ? Number(booking.totalPrice).toFixed(0) : ""} TND`}
        </Button>

        {/* Mention honnete : le POST /api/payment n'envoie que { bookingId },
            aucun de ces champs n'est transmis. Sans cette phrase, une testeuse
            pourrait croire qu'un vrai encaissement a lieu. */}
        <p className="text-center text-sm text-prune-soft">
          Paiement de démonstration — aucune donnée bancaire n&apos;est transmise.
        </p>
      </form>
    </div>
  );
}
```

Points d'attention :

- **Les quatre champs passent par `Input`.** Il impose `min-h-[52px]` et `text-base` : en dessous de 16px, iOS zoome au focus. `Input` exige un `label` et un `id` — les champs actuels n'ont que des `placeholder`, invisibles pour un lecteur d'écran.
- **« Payer » est la seule action rose** de cet écran.
- **Ne touche pas à `handlePayment`**, ni aux quatre `useState` de carte : tu ne fais que les lier.

- [ ] **Étape 4 : importer `Button` et `Input`**

En haut du fichier, après la ligne 5, ajoute :

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
```

- [ ] **Étape 5 : vérifier**

```bash
grep -c "handlePayment" "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -c "cardNumber\|expiry\|cvv\|cardName" "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -c "securise" "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -c "démonstration" "src/app/(dashboard)/cliente/paiement/page.tsx"
npx tsc --noEmit 2>&1 | grep -E "paiement"
```

Attendu : `handlePayment` **≥ 2** (la fonction et son `onSubmit`) ; les champs **≥ 8** (4 valeurs + 4 setters) ; **0** « securise » ; **1** mention de démonstration ; aucune sortie de `tsc`.

- [ ] **Étape 6 : commit**

```bash
git add "src/app/(dashboard)/cliente/paiement/page.tsx"
git commit -m "feat(design): formulaire de paiement au design system"
```

---

## Tâche 3 : l'écran de succès

**Fichiers :**
- Modifier : `src/app/(dashboard)/cliente/paiement/page.tsx:110-203`

**C'est ici que se trouve le premier QR code.** Son image ne doit pas changer.

- [ ] **Étape 1 : remplacer le bloc**

Remplace les lignes 110 à 203 (de `  if (step === "success" && result) {` jusqu'à sa fermeture `}`) par :

```tsx
  // Success — show QR code
  if (step === "success" && result) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-menthe">
            <svg className="h-8 w-8 text-menthe-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Paiement confirmé</p>
          <h1 className="ds-display text-2xl text-prune">Merci pour ton paiement</h1>
        </div>

        <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-8">
          {/* QR Code */}
          <div className="mb-6 text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">
              Ton QR code de confirmation
            </p>
            {/* Le cadre est restyle, PAS l'image : un QR altere devient
                illisible au scanner. `w-64 h-64` et le fond blanc restent. */}
            <div className="inline-block rounded-[var(--radius-panel)] border-2 border-hairline bg-white p-4">
              <img src={result.qrCode} alt="QR Code" className="w-64 h-64" />
            </div>
            <p className="mt-3 text-sm text-prune-soft">
              Code : {result.qrToken}
            </p>
          </div>

          <div className="my-6 h-px bg-hairline" />

          {/* Booking details */}
          <div className="space-y-3 text-base">
            <div className="flex justify-between gap-3">
              <span className="text-prune-soft">Service</span>
              <span className="text-right font-semibold text-prune">{result.booking.offer.title}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-prune-soft">Salon</span>
              <span className="text-right text-prune">{result.booking.offer.provider.salonName}</span>
            </div>
            {result.booking.offer.provider.address && (
              <div className="flex justify-between gap-3">
                <span className="text-prune-soft">Adresse</span>
                <span className="text-right text-prune">
                  {result.booking.offer.provider.address}
                  {result.booking.offer.provider.city && `, ${result.booking.offer.provider.city}`}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-prune-soft">Date</span>
              <span className="text-right text-prune">
                {new Date(result.booking.bookedFor).toLocaleDateString("fr-TN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-prune-soft">Montant payé</span>
              <span className="ds-display text-xl text-prune">
                {Number(result.booking.totalPrice).toFixed(0)} TND
              </span>
            </div>
          </div>

          <div className="my-6 h-px bg-hairline" />

          <div className="rounded-[var(--radius-panel)] bg-creme p-4 text-center">
            <p className="text-sm leading-relaxed text-prune-soft">
              Présente ce QR code au salon lors de ta visite.
              Le prestataire le scannera pour confirmer ta réservation.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/cliente"
            className="ds-press ds-focus inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[var(--radius-pill)] border-2 border-hairline px-6 text-base font-semibold text-prune hover:border-rose"
          >
            Mes réservations
          </Link>
          <Link
            href={`/cliente/reservation?id=${result.booking.id}`}
            className="ds-press ds-focus inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[var(--radius-pill)] bg-rose px-6 text-base font-semibold text-prune hover:bg-[#F04A79]"
          >
            Voir le QR code
          </Link>
        </div>
      </div>
    );
  }
```

Trois points :

- **`w-64 h-64` et le fond blanc du QR sont repris à l'identique.** Seul son cadre change.
- Les `emerald-*` de la coche passent au **menthe** — usage documenté pour les confirmations.
- **« Voir le QR code » est la seule action rose** de cet écran ; « Mes réservations » reste en bordure.
- `luxury-divider` devient un filet `hairline` de 1px.

- [ ] **Étape 2 : la chasse aux interstices**

```bash
grep -n "brand-" "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -n "luxury-" "src/app/(dashboard)/cliente/paiement/page.tsx"
```

**Attendu : aucune sortie.** Si une ligne apparaît, c'est du code entre deux bornes qu'aucune tâche n'a couvert — c'est arrivé sur trois lots précédents. Corrige-le : `luxury-heading` → `ds-display text-prune`, `luxury-badge` → `text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft`, `luxury-divider` → `h-px bg-hairline`, `text-brand-bordeaux` → `text-prune`, `text-brand-bordeaux/40` → `text-prune-soft`, `border-brand-gold/20` → `border-2 border-hairline`, `bg-brand-cream` → `bg-creme`.

- [ ] **Étape 3 : vérifier**

```bash
grep -n "w-64 h-64" "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -n -E "emerald-|red-|amber-|gray-" "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -c "Suspense" "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -c "animate-pulse" "src/app/(dashboard)/cliente/paiement/page.tsx"
npx tsc --noEmit 2>&1 | grep -E "paiement"
npm test 2>&1 | grep -E "Tests "
```

Attendu : le QR toujours en `w-64 h-64` ; **aucune** couleur hors palette ; `Suspense` à **3** ; `animate-pulse` à **1** ; aucune sortie de `tsc` ; **180 tests au vert**.

- [ ] **Étape 4 : commit**

```bash
git add "src/app/(dashboard)/cliente/paiement/page.tsx"
git commit -m "feat(design): ecran de succes du paiement au design system"
```

---

## Tâche 4 : la page du QR code

**Fichiers :**
- Modifier : `src/app/(dashboard)/cliente/reservation/page.tsx:28`, `:56-189`

C'est la page que la cliente ouvre devant le salon. **Aucune action rose** : il n'y a rien à y faire, sinon montrer son écran.

- [ ] **Étape 1 : le fond du `<Suspense>`**

Ligne 28, remplace :

```tsx
    <Suspense fallback={<div className="min-h-screen bg-brand-cream" />}>
```

par :

```tsx
    <Suspense fallback={<div className="min-h-screen bg-creme" />}>
```

- [ ] **Étape 2 : les trois gardes**

Remplace les lignes 56 à 78 (les blocs `if (!bookingId)`, `if (loading)`, `if (error)` et `if (!data) return null`) par :

```tsx
  if (!bookingId) {
    return (
      <div className="py-20 text-center">
        <p className="text-base text-prune-soft">Aucune réservation sélectionnée</p>
        <Link
          href="/cliente"
          className="ds-press ds-focus mt-4 inline-flex min-h-[48px] items-center rounded-[var(--radius-pill)] border-2 border-hairline px-6 text-base font-semibold text-prune hover:border-rose"
        >
          Retour
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-base text-prune-soft">Chargement…</div>;
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 text-base font-semibold text-rose">{error}</p>
        <Link
          href="/cliente"
          className="ds-press ds-focus inline-flex min-h-[48px] items-center rounded-[var(--radius-pill)] border-2 border-hairline px-6 text-base font-semibold text-prune hover:border-rose"
        >
          Retour
        </Link>
      </div>
    );
  }

  if (!data) return null;
```

Le `text-red-500` du message d'erreur passe au **rose**, seule couleur d'alerte du système.

- [ ] **Étape 3 : le corps de la page**

Remplace les lignes 80 à 188 (de `  return (` jusqu'à sa fermeture) par :

```tsx
  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8">
        <Link
          href="/cliente"
          className="ds-press ds-focus mb-4 inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] text-base font-semibold text-prune-soft hover:text-rose"
        >
          Retour aux réservations
        </Link>
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Ma réservation</p>
        <h1 className="ds-display text-2xl text-prune">{data.booking.offerTitle}</h1>
      </div>

      <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-8">
        {/* Status */}
        <div className="mb-6 text-center">
          {data.verified ? (
            <span className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-menthe px-4 py-2">
              <svg className="h-4 w-4 text-menthe-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-semibold text-menthe-deep">Vérifié par le salon</span>
            </span>
          ) : (
            <span className="inline-flex items-center rounded-[var(--radius-pill)] border-2 border-hairline px-4 py-2 text-sm font-semibold text-prune">
              Payé — en attente de visite
            </span>
          )}
        </div>

        {/* QR Code */}
        <div className="mb-6 text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">
            {data.verified ? "QR code utilisé" : "Présente ce code au salon"}
          </p>
          {/* Le cadre est restyle, PAS l'image : un QR altere devient illisible
              au scanner. `w-56 h-56`, le fond blanc et l'`opacity-60` d'un code
              deja utilise restent inchanges. */}
          <div className={`inline-block rounded-[var(--radius-panel)] border-2 bg-white p-4 ${data.verified ? "border-menthe opacity-60" : "border-hairline"}`}>
            <img src={data.qrCode} alt="QR Code" className="w-56 h-56" />
          </div>
          <p className="mt-3 font-mono text-sm text-prune-soft">{data.qrToken}</p>
          {data.verified && data.verifiedAt && (
            <p className="mt-2 text-sm text-menthe-deep">
              Vérifié le {new Date(data.verifiedAt).toLocaleDateString("fr-TN", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        <div className="my-6 h-px bg-hairline" />

        {/* Details */}
        <div className="space-y-3 text-base">
          <div className="flex justify-between gap-3">
            <span className="text-prune-soft">Salon</span>
            <span className="text-right font-semibold text-prune">{data.booking.salonName}</span>
          </div>
          {data.booking.address && (
            <div className="flex justify-between gap-3">
              <span className="text-prune-soft">Adresse</span>
              <span className="text-right text-prune">
                {data.booking.address}
                {data.booking.city && `, ${data.booking.city}`}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-prune-soft">Date du rendez-vous</span>
            <span className="text-right text-prune">
              {new Date(data.booking.bookedFor).toLocaleDateString("fr-TN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-prune-soft">Montant payé</span>
            <span className="ds-display text-xl text-prune">
              {Number(data.booking.totalPrice).toFixed(0)} TND
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-prune-soft">Payé le</span>
            <span className="text-right text-prune">
              {new Date(data.booking.paidAt).toLocaleDateString("fr-TN", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        <div className="my-6 h-px bg-hairline" />

        <div className="rounded-[var(--radius-panel)] bg-creme p-4 text-center">
          <p className="text-sm leading-relaxed text-prune-soft">
            {data.verified
              ? "Ta visite a été confirmée. Merci de ta confiance."
              : "Montre ce QR code au prestataire à ton arrivée au salon. Il sera scanné pour valider ta réservation."}
          </p>
        </div>
      </div>
    </div>
  );
```

Points d'attention :

- **`w-56 h-56`, le fond blanc et l'`opacity-60` sont repris à l'identique.** L'opacité signale un code déjà utilisé — c'est de l'information, pas du style.
- Les `emerald-*` passent au **menthe**.
- **Aucune action rose** sur cette page : « Retour aux réservations » est un simple lien.
- Tous les textes passent au tutoiement et retrouvent leurs accents.

- [ ] **Étape 4 : la chasse aux interstices**

```bash
grep -n "brand-" "src/app/(dashboard)/cliente/reservation/page.tsx"
grep -n "luxury-" "src/app/(dashboard)/cliente/reservation/page.tsx"
```

**Attendu : aucune sortie.**

- [ ] **Étape 5 : vérifier**

```bash
grep -n "w-56 h-56" "src/app/(dashboard)/cliente/reservation/page.tsx"
grep -c "Suspense" "src/app/(dashboard)/cliente/reservation/page.tsx"
grep -n -E "emerald-|red-|amber-|gray-" "src/app/(dashboard)/cliente/reservation/page.tsx"
grep -c "qrToken\|qrCode" "src/app/(dashboard)/cliente/reservation/page.tsx"
npx tsc --noEmit 2>&1 | grep -E "reservation"
npm test 2>&1 | grep -E "Tests "
```

Attendu : le QR toujours en `w-56 h-56` ; `Suspense` à **3** ; aucune couleur hors palette ; `qrToken`/`qrCode` ≥ 3 ; aucune sortie de `tsc` ; **180 tests au vert**.

- [ ] **Étape 6 : commit**

```bash
git add "src/app/(dashboard)/cliente/reservation/page.tsx"
git commit -m "feat(design): page du QR code au design system"
```

---

## Tâche 5 : vérification finale

**Fichiers :** aucun (vérification seule)

- [ ] **Étape 1 : tous les compteurs à zéro**

```bash
for f in "src/app/(dashboard)/cliente/paiement/page.tsx" "src/app/(dashboard)/cliente/reservation/page.tsx"; do
  echo "$f : brand=$(grep -c 'brand-' "$f") luxury=$(grep -c 'luxury-' "$f") interdits=$(grep -c -E 'shadow|gradient|blur' "$f") horsPalette=$(grep -c -E 'amber-|blue-|emerald-|red-|gray-|green-|yellow-' "$f")"
done
```

Attendu : **0 partout**, sur les quatre colonnes.

- [ ] **Étape 2 : les trois protections ont survécu**

C'est le contrôle le plus important de ce lot.

```bash
grep -n "w-64 h-64" "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -n "w-56 h-56" "src/app/(dashboard)/cliente/reservation/page.tsx"
grep -c "animate-pulse" "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -c "Suspense" "src/app/(dashboard)/cliente/paiement/page.tsx" "src/app/(dashboard)/cliente/reservation/page.tsx"
```

Attendu : les **deux tailles de QR inchangées** ; `animate-pulse` à **1** ; `Suspense` à **3** dans chaque fichier.

Si une taille de QR a changé, **le code peut devenir illisible au scanner** — corrige avant de continuer.

- [ ] **Étape 3 : la logique est intacte**

```bash
grep -c "handlePayment" "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -c "setTimeout" "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -c 'step === "success"\|step === "processing"' "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -c "api/payment\|api/client/bookings" "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -c "api/payment" "src/app/(dashboard)/cliente/reservation/page.tsx"
```

Attendu : tous ≥ 1. Si l'un vaut 0, une protection a sauté.

- [ ] **Étape 4 : la mention de démonstration et le retrait de « securise »**

```bash
grep -c "démonstration" "src/app/(dashboard)/cliente/paiement/page.tsx"
grep -c "securise\|sécurisé" "src/app/(dashboard)/cliente/paiement/page.tsx"
```

Attendu : **1** mention de démonstration, **0** « securise ».

- [ ] **Étape 5 : plus aucun vouvoiement**

```bash
grep -n "Vous \|Votre \|Presentez\|veuillez\|Veuillez" "src/app/(dashboard)/cliente/paiement/page.tsx" "src/app/(dashboard)/cliente/reservation/page.tsx"
```

Attendu : **aucune sortie**.

- [ ] **Étape 6 : types, lint, tests, build**

```bash
npx tsc --noEmit 2>&1 | grep -E "paiement|reservation"
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -2
npm test 2>&1 | grep -E "Test Files|Tests "
npm run build 2>&1 | grep -E "Compiled successfully|Failed to compile"
```

Attendu : **aucune sortie du premier grep** ; le second doit afficher **23** — le nombre exact d'erreurs préexistantes. ESLint à **52 problèmes** ; **180 tests au vert** ; `✓ Compiled successfully`.

- [ ] **Étape 7 : pousser**

```bash
git status --short   # doit etre vide
git push -u origin design-paiement-qr
```

`gh` n'est pas installé : la PR s'ouvre depuis l'URL affichée après le push.

---

## Contrôle visuel — pour l'utilisatrice

**Le contrôle décisif de ce lot n'est pas visuel : il est fonctionnel.**

1. **Scanner un QR code avec ton téléphone.** C'est la seule preuve qu'il est resté lisible. Ouvre une réservation payée, puis scanne l'écran avec l'appareil photo. Si le code ne se lit pas, le lot a un défaut grave — dis-le-moi immédiatement.
2. **Le parcours de paiement complet** — depuis « Payer » sur une réservation : formulaire, deux secondes de traitement, écran de succès. L'indicateur d'activité doit tourner pendant l'attente.
3. **La mention de démonstration** sous le formulaire, et l'absence de « Paiement securise ».
4. **Sur téléphone : la page ne doit pas zoomer** quand tu tapes dans un champ de carte.
5. **Un QR déjà utilisé** — s'il en existe un, il s'affiche en menthe atténué avec « QR code utilisé ».

---

## Ce que ce plan ne fait pas

- **Il ne touche pas à l'image du QR code**, ni à ses dimensions.
- Il ne retire pas `animate-pulse` : c'est un indicateur d'activité, pas une animation d'apparition.
- Il ne masque pas les champs de carte — cela changerait le parcours, pas son apparence.
- Il ne modifie ni `handlePayment`, ni le délai simulé, ni les états `step`.
- Il ne retire aucun `<Suspense>` — ils sont obligatoires avec `useSearchParams()`.
- Il ne branche aucun prestataire de paiement réel : c'est un tout autre chantier.
- Il ne supprime aucun token `brand-*` ni `pos-*`, ni aucune classe `.luxury-*`.
