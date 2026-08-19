# Rendre l'espace salon accessible sans le module caisse

**Date :** 2026-08-19
**Statut :** validé, prêt pour le plan d'implémentation
**Nature :** correctif fonctionnel — ce n'est pas un lot de design.

---

## Problème

Un salon dont l'administrateur n'a pas activé le module caisse **n'a plus aucun
accès à son espace**. Il voit un écran unique : « Le module POS n'est pas activé
pour ce salon. »

C'est une régression de fond. Le produit vend d'abord une **place de marché** —
le salon publie ses offres, reçoit des réservations, noue des collaborations
avec des influenceuses. La caisse est un **module payant supplémentaire**, censé
attirer des salons, pas conditionner leur entrée.

Aujourd'hui, un salon sans caisse ne peut ni publier une offre, ni voir ses
rendez-vous, ni répondre à une collaboration.

## Objectif

Un salon accède à son espace **quel que soit son abonnement**. Seules les pages
réellement liées à l'encaissement restent bloquées.

---

## Ce que la lecture du code a révélé

### L'espace prestataire a été supprimé, pas seulement bloqué

Les sept pages de `/prestataire` ne sont plus que des **redirections de 5
lignes** vers `/pos`. Un commit antérieur les a vidées : « Le portail
prestataire est désormais la PWA POS ».

Le contenu d'origine reste dans l'historique — la page des offres faisait 343
lignes au commit `cf930a9`.

### Le blocage est au niveau du layout

`src/app/(pos)/layout.tsx` vérifie `hasModule(providerId, "POS")` et, si le
module manque, remplace **tout le contenu** par l'écran « Module non activé ».
Aucune page de la PWA n'est donc atteignable.

### L'outil du correctif existe déjà

`src/components/module-gate.tsx` fait exactement ce qu'il faut : bloquer une
page précise plutôt que le layout entier, avec un message et un `fallback`
optionnel. Il connaît déjà les deux modules, `POS` et `REWARDS`.

**Il n'est simplement pas utilisé au bon endroit.**

### `REWARDS` est un module distinct de `POS`

Le schéma Prisma définit deux modules. La fidélité relève donc de `REWARDS` —
la bloquer avec la caisse était une erreur de câblage, pas une décision.

---

## Décisions

### Une seule interface, pas deux

La demande initiale décrivait deux accès : la PWA pour les salons à caisse, un
espace navigateur pour les autres.

**Techniquement, une PWA Next.js *est* un site web.** La même URL s'ouvre dans
un navigateur et dans l'application installée — il n'y a pas deux codes à
écrire, et en écrire deux signifierait maintenir en double chaque écran métier
(offres, collaborations, rendez-vous) pour les mêmes données.

Retenu : **une seule interface**. Le salon à caisse installe la PWA pour le
plein écran et le hors-ligne ; les autres l'utilisent dans leur navigateur.
Aucun code en double.

Écarté : ressusciter l'ancien espace prestataire depuis git. Le contenu est
récupérable, mais on se retrouverait avec deux interfaces pour les mêmes
données.

### Le blocage descend du layout vers les pages

Le layout cesse de bloquer. Chaque page **de caisse** porte son propre
`ModuleGate`.

| Nature | Pages | Sans module caisse |
|---|---|---|
| **Métier** | services, calendrier, profil du salon, clientes | **accessibles** |
| **Fidélité** | programme de points | dépend de `REWARDS`, pas de `POS` |
| **Analytique** | statistiques | accessible, avec les données disponibles |
| **Caisse** | encaissement, tiroir, ventes, produits/stock, employés, commissions, incidents de synchro | bloquées |
| **Teasers** | collaborations, boutique | inchangées — voir ci-dessous |

### Correction : les collaborations n'existent pas dans la PWA

Une première version de cette spec annonçait les collaborations comme une page
métier à rendre accessible. **C'est faux.** `/pos/collab` et `/pos/store` sont
des `LockedFeaturePage` — des **argumentaires commerciaux** « bientôt
disponible », affichés délibérément à tout le monde (`locked: true` dans le
rail, qui ignore volontairement le filtre de permission).

La vraie fonctionnalité existe côté API (`/api/collaborations`), mais son écran
a été remplacé par une redirection de 5 lignes vers ce teaser. Ouvrir la porte
ne montrerait donc qu'une affiche.

**Décision : hors périmètre.** Reconnecter les collaborations demande de
réécrire un écran entier (343 lignes dans l'historique), pas de déplacer un
verrou. C'est un chantier distinct. Ces deux pages restent exactement ce
qu'elles sont aujourd'hui.

### La page d'accueil de la PWA est l'écran d'encaissement

`/pos` **est** la caisse — première entrée du rail, permission `pos.sell`. Un
salon sans le module y atterrit après connexion et se cogne au mur même une
fois le correctif posé.

**Décision :** sans le module caisse, `/pos` redirige vers `/pos/calendar` — le
quotidien d'un salon qui ne vend pas au comptoir : voir ses rendez-vous.

### La fidélité dépend de `REWARDS`

Les points s'accumulent aussi sur les réservations en ligne, pas seulement en
caisse. Et le schéma prévoit un module dédié. Un salon abonné à `REWARDS` sans
`POS` doit pouvoir paramétrer son programme.

### L'analytique reste accessible

Un salon sans caisse garde ses réservations en ligne — les masquer lui retirerait
toute visibilité sur son activité réelle. Les chiffres de vente apparaîtront
vides ou absents, ce qui est le comportement correct.

### La navigation s'adapte

Le menu de la PWA ne doit pas afficher des entrées qui mènent à un mur. Les
entrées de caisse disparaissent pour un salon sans le module — comme le fait
déjà la sidebar du tableau de bord avec `activeModules`.

---

## Ce que ce chantier ne touche pas

- **Le design de la PWA.** Ce n'est pas un lot visuel : on ne restyle rien.
- La logique d'encaissement, le tiroir, les ventes, le stock
- `getCurrentEmployee()` et l'authentification par code PIN
- Le manifeste PWA et le service worker
- Les espaces cliente et influenceuse, qui n'ont jamais été concernés

---

## Vérification

1. **Un salon sans module caisse accède à `/pos`** et voit ses services, ses
   collaborations, son calendrier, son profil.
2. **Les pages de caisse affichent « Module non activé »** — pas un écran blanc,
   pas une erreur.
3. **Le menu n'affiche pas les entrées bloquées** pour ce salon.
4. **Un salon avec le module ne voit aucun changement.** C'est le contrôle de
   non-régression le plus important : la caisse est en production.
5. `npx tsc --noEmit` filtré : aucune sortie. **23 erreurs préexistent**
   ailleurs.
6. ESLint : **52 problèmes**, comme sur `main`.
7. **180 tests au vert.**
8. `npm run build` réussit.

**Le contrôle décisif demande deux comptes** : un salon avec le module POS actif,
un sans. Sans les deux, on ne peut pas vérifier que le correctif marche **et**
qu'il n'a rien cassé.

---

## Réserve honnête

**Ce chantier touche la caisse, qui est en production chez de vrais salons.**

Le risque n'est pas d'oublier une page métier — ce serait visible immédiatement.
Le risque est d'ouvrir par erreur une page de caisse à un salon qui n'y a pas
droit, ou de casser l'accès d'un salon qui paie le module.

C'est pourquoi la vérification impose de tester **les deux cas**, pas seulement
celui qui motive le correctif.
