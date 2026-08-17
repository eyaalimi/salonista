# Accessibilité des sélecteurs à onglets

**Date :** 2026-08-17
**Statut :** validé, prêt pour le plan d'implémentation
**Contexte :** troisième et dernier des chantiers transverses ouverts après la série de refonte visuelle. Les deux premiers — [contraste du rose](2026-08-17-contraste-rose-design.md) et [DT vers TND](2026-08-17-dt-vers-tnd-design.md) — sont livrés et mergés (PR #19 et #20).

---

## Problème

Trois endroits du site portent `role="tablist"`. Les revues des lots 5 et 6 ont
signalé qu'aucun n'implémente la **navigation clavier par flèches** que décrit le
pattern APG : onglet inactif en `tabIndex={-1}`, flèches gauche/droite pour
circuler entre les onglets.

Le sujet avait été reporté deux fois, faute d'un périmètre cohérent : corriger un
seul sélecteur aurait créé un écart de comportement avec les deux autres.

## Objectif

Rendre chaque sélecteur correct **selon ce qu'il fait réellement**.

---

## La mesure a changé le chantier

Le sujet semblait uniforme : « ajouter les flèches aux trois tablists ». La
lecture du code montre **trois situations différentes**, dont une où le balisage
lui-même est le défaut.

| Sélecteur | Ce qu'il fait vraiment | Diagnostic |
|---|---|---|
| `RoleTabs` (Connexion) | Change une accroche et un lien d'inscription | **`tablist` inapproprié** |
| Onglets de la fiche offre | Bascule entre inscription et connexion — deux champs de plus | Vrai sélecteur |
| `settings-tabs` (caisse) | Bascule un formulaire entier contre un autre | Vrai tablist, **incomplet** |

Ajouter les flèches partout aurait donc **renforcé un balisage erroné** dans un
cas sur trois.

---

## Décisions

### `RoleTabs` perd son rôle de tablist

Son propre commentaire, écrit lors d'un lot précédent, dit l'essentiel :

> « IMPORTANT : il n'agit PAS sur l'authentification. `signIn("credentials")` ne
> prend aucun rôle […]. Ce sélecteur change l'accroche et la destination
> d'inscription — rien d'autre. »

Vérifié dans `login-client.tsx` : le rôle choisi alimente `current.tagline` (une
phrase affichée) et `current.registerHref` (la cible d'un lien). **Aucun panneau
n'est ouvert ni fermé.**

Un `role="tab"` promet à un lecteur d'écran qu'un panneau associé existe et va
changer. Ici, l'utilisatrice non voyante cherchera un contenu qui n'apparaîtra
jamais.

Retenu : `role="tablist"`/`role="tab"`/`aria-selected` sont remplacés par un
**groupe de boutons** — `role="group"` avec `aria-pressed` sur chaque bouton.
C'est ce que ce composant est : trois boutons dont un est enfoncé.

Écarté : lui ajouter un vrai panneau pour justifier le balisage. Ce serait
inventer une fonctionnalité pour satisfaire une étiquette.

### Les deux vrais sélecteurs gagnent la navigation clavier

Onglets de la fiche offre et `settings-tabs` reçoivent le pattern complet :

- `tabIndex={-1}` sur l'onglet inactif, `0` sur l'actif — au clavier, `Tab`
  entre dans le groupe une seule fois, au lieu de traverser chaque onglet ;
- **flèches gauche/droite** pour circuler, avec bouclage du dernier au premier ;
- le focus suit la sélection, conformément au pattern APG pour des onglets à
  activation automatique.

### `settings-tabs` gagne aussi les liens manquants

C'est le seul vrai tablist du site — il bascule un formulaire entier — et il lui
manque plus que les flèches : **aucun `aria-controls` ni `id` ne relie un onglet
à son panneau**, et le panneau n'a pas `role="tabpanel"`.

Sans ces liens, un lecteur d'écran ne peut pas annoncer quel contenu l'onglet
commande. Ils sont ajoutés.

### Aucun changement visuel

Ce chantier ne touche ni les couleurs, ni les tailles, ni la mise en page. Les
trois sélecteurs garderont exactement l'apparence qu'ils ont aujourd'hui.

---

## Périmètre

| Fichier | Nature | Action |
|---|---|---|
| `src/components/ui/role-tabs.tsx` | Sélecteur de préférence | `tablist` → `group` + `aria-pressed` |
| `src/app/offre/[id]/offer-client.tsx` | Onglets d'authentification | `tabIndex` + flèches |
| `src/components/pos/settings/settings-tabs.tsx` | Vrai tablist | `tabIndex` + flèches + `aria-controls`/`tabpanel` |

**`role-tabs.tsx` est utilisé uniquement par la page de connexion** — vérifié.
La page d'inscription ne l'importe pas.

---

## Ce que ce chantier ne touche pas

- **`signIn("credentials")` et la redirection par rôle.** Le sélecteur de la page
  de connexion n'a jamais agi sur l'authentification ; ce n'est pas ce chantier
  qui va commencer.
- La logique de bascule (`useState`) des trois sélecteurs.
- L'apparence : aucune classe de style ne change.
- Le formulaire d'inscription intégré de la fiche offre, ni les formulaires de
  la caisse — seuls leurs onglets sont concernés.

---

## Vérification

Aucun test automatisé ne juge l'accessibilité : Vitest tourne en
`environment: "node"` sans jsdom, et aucun outil d'audit n'est installé.

1. `grep` : `role="tablist"` ne subsiste que dans les **deux** vrais sélecteurs.
2. `role-tabs.tsx` porte `role="group"` et `aria-pressed`, plus aucun
   `role="tab"` ni `aria-selected`.
3. Les deux vrais sélecteurs ont `tabIndex`, `onKeyDown`, et gèrent
   `ArrowLeft`/`ArrowRight`.
4. `settings-tabs` a des `id`, `aria-controls` et un `role="tabpanel"` cohérents.
5. `npx tsc --noEmit` filtré sur les trois fichiers : aucune sortie. **23 erreurs
   préexistent** ailleurs — hors sujet.
6. ESLint : **52 problèmes**, comme sur `main`.
7. **180 tests au vert.**
8. `npm run build` réussit.
9. **Contrôle au clavier par l'utilisatrice** — c'est le vrai test :
   `Tab` pour atteindre les onglets, flèches pour circuler, `Entrée` inutile
   (l'activation est automatique).

---

## Réserve honnête

**Ce chantier ne se voit pas.** Aucun pixel ne bouge ; le bénéfice est invisible
pour qui navigue à la souris.

Il compte pour les personnes qui utilisent un lecteur d'écran ou naviguent au
clavier — et pour un éventuel audit d'accessibilité, où `role="tab"` sans panneau
associé est un défaut relevé.
