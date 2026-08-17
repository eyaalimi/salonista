# « DT » devient « TND » sur tout le site

**Date :** 2026-08-17
**Statut :** validé, prêt pour le plan d'implémentation
**Contexte :** deuxième des trois chantiers transverses ouverts après la série de refonte visuelle. Le premier — [contraste du rose](2026-08-17-contraste-rose-design.md) — est livré et poussé.

---

## Problème

La refonte visuelle a fait passer les pages publiques à « TND ». Le reste du site
affiche encore « DT » : tableaux de bord admin, espaces cliente et influenceuse,
caisse, tickets imprimés, e-mails transactionnels.

Deux notations coexistent donc pour la même monnaie. Le cas le plus visible :
une cliente voit « 45 TND » sur la fiche offre, puis reçoit un e-mail de
confirmation qui dit « 45 DT ».

**Le pire cas est indexé par Google :** la méta-description de chaque fiche
offre (`src/app/offre/[id]/page.tsx:32`) contient « DT », donc les résultats de
recherche affichent une notation différente de la page qu'ils annoncent.

## Objectif

Une seule notation — **TND** — partout : public, tableaux de bord, caisse,
tickets imprimés, e-mails.

---

## Ce que la mesure a révélé

Le chantier avait d'abord été annoncé à « plus de douze fichiers ». C'est faux :
**57 fichiers, 253 occurrences.** Mais la structure est bien plus favorable que
ce nombre ne le suggère.

### 132 occurrences passent par une fonction

`formatDT()` existe déjà dans `src/lib/money.ts:113`. Sa dernière ligne produit
`« 12,500 DT »`. **Changer cette seule ligne traite 132 usages d'un coup**, dont
la totalité des tickets thermiques — reçus de vente et rapports Z — qui n'ont
aucun « DT » en dur.

### 85 sont du texte en dur

| Zone | Occurrences |
|---|---|
| `src/lib/mail.ts` — e-mails aux clientes | ~25 |
| `src/components/pos` — caisse | 24 |
| `admin` | 15 |
| `cliente` + `influenceuse` | 14 |
| offre, vérification, API | 7 |

### Quatre tests figent le format actuel

`src/lib/money.test.ts` vérifie explicitement `formatDT("12.500") === "12,500 DT"`.
Changer la fonction sans toucher au test ferait échouer la suite — les 180 tests
doivent rester au vert.

---

## Décisions

### Le basculement couvre tout le site, caisse comprise

Retenu après arbitrage : **une seule notation partout**.

La caisse est utilisée en production par des salons, et ses tickets changeront
dès le déploiement. C'est assumé : la solution alternative — garder « DT » côté
pro — produirait l'incohérence inverse, un même salon voyant « TND » dans son
espace et « DT » sur ses tickets.

### Les tests sont mis à jour, pas contournés

Les quatre assertions de `money.test.ts` deviennent « TND ». Le test continue de
protéger ce qui compte — séparateur virgule, trois décimales, signe négatif ;
seule la devise change.

Écarté : ajouter des tests du nouveau format en gardant les anciens. Deux
assertions contradictoires sur la même fonction garantissent qu'une des deux
échoue.

### Le remplacement doit être ciblé, jamais global

**C'est la contrainte la plus importante de ce chantier.** Un `sed` sur « DT »
casserait des choses sans rapport :

| Motif | Rôle | Conséquence d'un remplacement |
|---|---|---|
| `formatDT` (132×) | nom de fonction | code cassé |
| `MILLIMES_PER_DT` | constante | code cassé |
| `CDTBQAAtQoAINQFAAC…` | chaîne encodée dans `booking-detail-drawer.tsx` | donnée corrompue |
| `DDTHH` | format de date ISO | horodatages faussés |

Vérifié : le motif `[0-9)}\`"'] DT` — un « DT » précédé d'un chiffre, d'une
accolade fermante ou d'un guillemet — isole exactement les **85** occurrences
d'affichage, sans toucher aux identifiants.

### `src/generated/prisma/` reste hors périmètre

Ce dossier est **généré** par `prisma generate` et contient une des chaînes
encodées. Toute modification serait écrasée au prochain build. Il ne doit jamais
être édité.

### Les commentaires ne sont pas traités

26 commentaires mentionnent « DT » (« 100 DT × 3 pts/DT », « 20 000 DT »). Ils
n'apparaissent nulle part à l'écran. Les changer gonflerait le diff sans bénéfice
et rendrait la relecture plus difficile.

---

## Périmètre

| Fichier / zone | Action |
|---|---|
| `src/lib/money.ts:119` | **la ligne clé** — traite 132 usages |
| `src/lib/money.test.ts` | 4 assertions |
| `src/lib/mail.ts` | e-mails transactionnels |
| `src/app/offre/[id]/page.tsx:32` | **méta-description indexée par Google** |
| `src/app/(dashboard)/**` | admin, cliente, influenceuse |
| `src/components/pos/**` | caisse |
| `src/app/api/pos/drawer/expenses/route.ts` | message d'API |
| `src/app/verification/page.tsx` | page de vérification |

### Hors périmètre, formellement

- `src/generated/prisma/` — dossier généré
- Les identifiants `formatDT`, `MILLIMES_PER_DT`
- Les chaînes encodées et les formats de date
- Les 26 commentaires

---

## Vérification

1. `grep` sur le motif d'affichage `[0-9)}\`"'] DT` : **0** dans `src/`, hors
   `generated/`.
2. `grep -c "formatDT"` : **inchangé** — la fonction garde son nom. La renommer
   toucherait 132 sites d'appel pour un gain de lisibilité seul.
3. **180 tests au vert**, avec les 4 assertions de `money.test.ts` mises à jour.
4. `npx tsc --noEmit` : **23 erreurs**, comme sur `main` — pas une de plus.
5. ESLint : **52 problèmes**, comme sur `main`.
6. `npm run build` réussit.
7. **Les tickets thermiques affichent TND** — contrôle sur le rendu, pas
   seulement sur le code.
8. **L'e-mail de confirmation affiche TND** — vérifiable sur le gabarit.
9. **Contrôle visuel par l'utilisatrice** : caisse, un ticket, un espace client.

---

## Ce que ce chantier ne fait pas

- Il ne renomme pas `formatDT` en `formatTND`.
- Il ne touche pas aux montants, aux calculs, ni au format numérique (virgule,
  trois décimales) — **seul le suffixe change**.
- Il ne touche pas à `src/generated/prisma/`.
- Il ne traite pas le pattern ARIA tablist — troisième chantier, indépendant.
- Il ne modifie aucun schéma ni aucune donnée en base : « DT » et « TND »
  désignent la même monnaie, le dinar tunisien.
