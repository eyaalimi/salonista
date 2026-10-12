# Audit avant l'offre gratuite + Premium

Audit fait le 12/10/2026, avant toute écriture de code. Il liste chaque
endroit touché par les trois fonctions qui passent en Premium (fidélité,
équipe, commissions), et les écarts entre le brief et le code réel.

## 1. Fidélité — tous les tests du module `REWARDS`

| Fichier | Ce qu'il fait aujourd'hui |
|---|---|
| `src/app/api/rewards/program/route.ts` (GET, PUT) | `requireModule("REWARDS")` |
| `src/app/api/rewards/wallets/route.ts` | `requireModule("REWARDS")` |
| `src/app/api/rewards/wallets/[id]/route.ts` | `requireModule("REWARDS")` |
| `src/app/api/rewards/wallets/[id]/adjust/route.ts` | `requireModule("REWARDS")` |
| `src/app/api/rewards/stats/route.ts` | `requireModule("REWARDS")` |
| `src/app/api/rewards/top/route.ts` | `requireModule("REWARDS")` |
| `src/lib/rewards/wallet.ts` → `getWalletForPos` | `hasModule("REWARDS")`, utilisé par `/api/pos/customer/[customerId]/wallet` |
| `src/app/api/pos/catalog/route.ts` | résumé de portefeuille si `hasModule("REWARDS")` |
| `src/app/api/pos/customers/search/route.ts` | même résumé, **oublié du brief** |
| `src/app/(dashboard)/dashboard-layout-client.tsx` | lien « Fidélité » du tableau de bord, `module: "REWARDS"` |
| `src/app/(dashboard)/admin/subscriptions/subscriptions-client.tsx` | colonne REWARDS de l'admin |
| `src/components/pos/charge-modal.tsx` | tuile « Points fidélité », pilotée par `customer.wallet` |
| `src/components/pos/pos-shell-client.tsx` | lien WhatsApp après encaissement (`lienWhatsappFidelite`) ; n'apparaît que si la vente a fait gagner des points |
| `src/components/pos/fidelite/fidelite-client.tsx` | bandeau « Contactez Salonista » quand l'API répond 403 |

**Écarts constatés :**

- **Gagner et dépenser des points n'est contrôlé par AUCUN module.**
  `pos-sale-create.ts` appelle `applySaleEarnings` (qui ne regarde que
  `program.active`) et valide les paiements `LOYALTY_POINTS` sans tester
  `REWARDS`. Un salon sans abonnement gagnait donc des points dès qu'un
  programme existait — ce que l'onboarding (étape 4) crée. C'est la
  vérification serveur la plus importante de ce chantier.
- `/prestataire/fidelite` n'est plus qu'une redirection vers
  **`/pos/loyalty`**. Le bandeau à modifier est celui de `fidelite-client.tsx`.
- Aucun `<ModuleGate module="REWARDS">` ne subsiste ; tous les `<ModuleGate>`
  restants portent sur `POS`.
- Le **remboursement** (`src/lib/rewards/refund.ts`, `clawbackOnRefund`)
  retire les points d'une vente remboursée. Il reste actif en version
  gratuite : il défait un gain passé, il n'en crée pas.

## 2. Commissions — lectures et écritures

| Fichier | Lecture / écriture |
|---|---|
| `src/lib/pos-sale-create.ts` | lit `commissionRate`, écrit `commissionRateSnapshot` + `commissionAmount` |
| `src/app/api/pos/commissions/route.ts` | GET (agrégat par employée), PUT (marque `commissionPaid`) |
| `src/app/api/pos/analytics/by-employee/route.ts` | **renvoie `commissionPending` / `commissionPaid`** — oublié du brief |
| `src/app/api/pos/employees/route.ts` | GET renvoie `commissionRate`, POST l'écrit |
| `src/app/api/pos/employees/[id]/route.ts` | PUT écrit `commissionRate` |
| `src/components/pos/employees-list-client.tsx` | champ « Commission » du formulaire |
| `src/components/pos/commissions-client.tsx` | page `/pos/commissions` |
| `src/components/pos/analytics-client.tsx` | affiche les commissions par employée |

**Écarts constatés :**

- **Il n'existe ni route de détail par employée ni export PDF des
  commissions.** Rien à verrouiller de ce côté.
- **L'étape équipe de l'onboarding n'a pas de champ commission**
  (`step5-team.tsx` : nom, rôle, PIN). Rien à griser.
- `analytics/by-employee` fait partie des statistiques (gratuites) mais livre
  des montants de commission : en version gratuite, la route renvoie les
  chiffres de vente et omet les commissions.

## 3. Employées — chemins qui créent ou réactivent

| Chemin | Effet |
|---|---|
| `POST /api/pos/employees` | création |
| `PUT /api/pos/employees/[id]` | `active: true` (réactivation) **et** changement de rôle `OWNER` → autre (qui fait entrer la personne dans le décompte) |
| `PATCH /api/pos/onboarding` (étape 5) | création, ou mise à jour par nom — ne touche pas `active` |
| `POST /api/pos/signup` | crée la gérante (`OWNER`) — jamais comptée |
| `getCurrentEmployee()` (`src/lib/employee-session.ts`) | crée la gérante à la volée — jamais comptée |
| `superadmin/salons/[id]/action` | ne fait que réinitialiser le PIN ou débloquer — ni création ni réactivation |

Une employée `active: false` :

- **ne peut pas se connecter par PIN** — `verifierPinEmploye` refuse
  (`src/lib/verify-employee-pin.ts:60`) ;
- **n'apparaît pas sur l'écran PIN** — `tuilesDuSalon` filtre `active: true`
  (`src/lib/salon-pin-pairing.ts`), et c'est lui que sert `/api/salon-pin/resolve`.

**Écart constaté :** une session PIN **déjà ouverte** n'est jamais revérifiée.
Le jeton porte l'employée, et le callback `jwt` ne relit pas `active`. Une
employée mise en pause continuerait donc d'encaisser jusqu'à l'expiration de
sa session (30 jours). Correctif : `requireEmployee` lit déjà le salon à
chaque requête ; la même lecture vérifie désormais l'employée.

**Faille de la règle « la gérante ne compte jamais » :** si tout rôle `OWNER`
échappe à la limite, il suffit de nommer chaque employée `OWNER`. En version
gratuite, créer une `OWNER` ou promouvoir quelqu'un en `OWNER` est donc refusé
comme un ajout d'employée.

## 4. Expiration des points

- `lastActivityAt` est posé à chaque mouvement : gain (`earn.ts:216`),
  utilisation (`redeem.ts:119`), ajustement (`adjust.ts:54`), remboursement
  (`refund.ts:78`).
- `expireInactiveWallets()` (`src/lib/rewards/expiration.ts`) n'est lancé que
  par `POST /api/admin/rewards/expire-inactive` (ADMIN). Aucune tâche planifiée.

## 5. Données existantes (lecture seule)

Base **locale** (conteneur `salonista-lot6`) :

- 1 ligne `REWARDS` : statut `TRIAL`, échue le 16/09/2026, salon réel « Salon Nour ».
- 3 salons avec le module `POS`, dont 2 ont au moins une vente (1 démo, 1 réel).

**La production n'a pas été consultée** (pas d'accès depuis le poste). Le
script de rattrapage (`prisma/backfill-freemium.ts`) inspecte par défaut :
sans `--apply`, il affiche exactement ces chiffres sur le serveur sans rien
écrire.

## 6. Où afficher le bandeau

`src/app/(pos)/layout.tsx`, entre `<BandeauConsultation />` et la barre du
haut : il est rendu sur toutes les pages de la caisse, et le layout connaît
déjà l'employée et ses permissions (`employees.manage`).

## Autres écarts avec le brief

- **`npx prisma generate` fonctionne** (règle n° 7 de CLAUDE.md, résolue le
  12/08/2026). Les nouveaux fichiers utilisent le client typé, sans `as never`.
- Le brief demande `getPlan` + `hasFeature` par appel. La caisse appelle déjà
  `getActiveModules` dans le layout ; le plan y est calculé une fois et passé
  aux composants.
