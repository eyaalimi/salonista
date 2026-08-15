# Refonte visuelle — lot 1b : page d'inscription

**Date :** 2026-08-15
**Statut :** validé, prêt pour le plan d'implémentation
**Précédent :** [lot 1 — fondations et connexion](2026-08-15-refonte-visuelle-lot1-design.md)

---

## Problème

Le lot 1 a refait la page de connexion avec le nouveau design system. Elle est
validée.

`/register` garde l'ancienne charte : beige, doré, Playfair Display — 66
occurrences de classes `brand-*` dans le fichier. Or les trois onglets de la page
de connexion **mènent directement à cette page**. Chaque personne qui crée un
compte voit donc la rupture visuelle, sur le parcours que le lot 1 vient de
mettre en avant.

## Objectif

Aligner la page d'inscription sur le design system, sans rien changer à son
fonctionnement.

## Contrainte posée par l'utilisateur

> « l'essentiel, ne touche à rien dans les données, seulement le design »

Ce lot ne modifie **que** les classes CSS et le balisage de présentation.

**Reste strictement intact :**

| Élément | État |
|---|---|
| Les 5 champs et leurs noms (nom, e-mail, téléphone, Instagram, mot de passe) | intacts |
| `POST /api/register` et son corps `{ email, password, name, phone, role, instagramHandle }` | intact |
| La logique des deux étapes et le bouton « Changer » | intacte |
| Le champ Instagram conditionnel au rôle `INFLUENCER` | intact |
| L'état `needsVerification` et sa logique | intacte |
| La lecture de `?role=` et le saut d'étape (ajoutés au lot 1) | intacts |
| Validations, messages d'erreur, redirection | intacts |

**Seule exception, validée explicitement :** l'écran de confirmation affiche
« Verifiez votre email » et « Un email de verification a ete envoye », sans
accents, alors que tout le reste du site est accentué. Les accents sont corrigés
et le texte passe au tutoiement, comme le reste du design system.

---

## Décisions

### Les deux étapes sont conservées

Écarté : fusionner en un seul écran avec `RoleTabs` en haut, comme le login.

L'étape 1 (« Choisissez votre profil ») garde une valeur pédagogique : ses trois
cartes expliquent ce que chaque profil apporte (« Je cherche des offres beauté »,
« Je propose des services beauté »). Quelqu'un qui arrive sans savoir quoi
choisir en a besoin.

Et depuis le lot 1, cet écran ne s'affiche **plus** aux personnes venant du
login : `?role=` pré-remplit le rôle et saute à l'étape 2. Fusionner ferait
gagner un clic à des gens qui ne le font déjà plus.

### Réécriture avec les primitifs, pas un simple échange de couleurs

Écarté : remplacer `brand-bordeaux` → `prune`, `brand-gold` → `rose` sans toucher
à la structure.

Cette option produirait une page qui *ressemble* au login sans se comporter
pareil : hauteurs de champs, états de focus, cibles tactiles resteraient
différents, et les cinq champs écrits à la main divergeraient au premier
changement.

Les cinq champs deviennent des `<Input>`, les boutons des `<Button>`. Un
changement futur du style des champs ne touchera qu'un fichier.

### Aucun nouveau primitif

Écarté : extraire une `Card` et un `RoleCard`.

Les trois cartes de l'étape 1 n'ont qu'un usage. Le lot 2 (le feed) aura de
vraies cartes salon ; on saura mieux à ce moment-là à quoi doit ressembler une
`Card` partagée. Les cartes restent donc écrites dans la page.

### Aucune carte de profil n'est rose par défaut

La règle du design system dit **une seule action primaire rose par vue**. À
l'étape 1, les trois cartes sont équivalentes : aucune ne doit attirer l'œil plus
que les autres. Le rose n'apparaît qu'au survol et au focus.

---

## Architecture

**Un seul fichier modifié :** `src/app/(auth)/register/register-client.tsx`
(323 lignes aujourd'hui).

Les primitifs du lot 1 sont réutilisés tels quels :

- `Button` — `variant` `primary` / `secondary` / `ghost`, `fullWidth`
- `Input` — `label`, `id`, `trailing`

### Étape 1 — le choix du profil

Trois cartes empilées, une par profil, contenu inchangé. Chaque carte est
cliquable donc en pill au rayon `--radius-card`, bordure `hairline`, fond blanc
sur crème. Au survol la bordure passe au rose ; à l'appui `scale(0.97)` via
`.ds-press`.

**Le bouton « Continuer avec Google » de cette étape est conservé.** Les sections
de design présentées ne le mentionnaient pas — omission relevée en lisant le
fichier. Il existe aujourd'hui (avec son séparateur « ou » et son logo Google en
SVG inline) et fonctionne : le supprimer retirerait une façon de s'inscrire. Il
devient un `<Button variant="ghost">`, le SVG restant inchangé.

### Étape 2 — le formulaire

Même carte que le login. En tête, un bloc « Profil : … » au rayon
`--radius-panel` (22px, le rayon des panneaux imbriqués) avec le bouton
« Changer » en texte discret — ce n'est pas l'action principale.

Puis les cinq champs en `<Input>`, et un unique `<Button>` rose
« Créer mon compte ».

### L'écran de confirmation

Titre « Vérifie ton e-mail », l'adresse saisie, la note sur l'expiration en 24
heures, et un `<Button>` vers la connexion.

L'icône d'enveloppe carrée disparaît : elle était dessinée avec une bordure dorée
qui n'existe plus dans le système.

---

## Vérification

Rien n'est testable automatiquement : Vitest tourne en `environment: "node"` sans
jsdom, et aucun test ne dit si une page est réussie.

1. `npm run build` réussit ; `npx tsc --noEmit` et ESLint sans erreur nouvelle.
2. `grep` sur le fichier : **plus aucune** classe `brand-*`, et aucun
   `shadow` / `gradient` / `blur`.
3. `npm test` reste à 169 passants — aucun test ajouté.
4. **Le parcours réel** : `/login` → onglet « Salon » → l'inscription s'ouvre à
   l'étape 2 avec « Prestataire » déjà choisi → la création de compte aboutit.
5. Le bouton « Changer » ramène bien à l'étape 1.
6. Le champ Instagram n'apparaît que pour le profil influenceuse.
7. **Contrôle visuel par l'utilisateur**, sur mobile et desktop.

Le point de non-régression qui compte : **une inscription réelle doit toujours
créer un compte**. C'est de la logique non touchée, mais c'est ce qu'il faut
vérifier.

---

## Ce que ce lot ne fait pas

- Ni le feed, ni les fiches salon, ni la caisse.
- Il ne supprime aucun token `brand-*` ni `pos-*` — d'autres pages les utilisent
  encore.
- Il ne crée aucun nouveau primitif.

**Suite :** lot 2, le feed d'accueil, avec les cartes salon de la maquette de
référence — badge menthe « LIBRE 14:00 », note en étoile, ligne
« quartier · catégories · dès N TND ». Les primitifs `Chip`, `Card` et `Badge`
y seront créés.
