# Refonte visuelle — lot 1 : fondations et page de connexion

**Date :** 2026-08-15
**Statut :** validé, prêt pour le plan d'implémentation

---

## Problème

Trois constats de l'utilisateur :

1. **Les polices ne sont pas cohérentes** d'une page à l'autre. Le dépôt charge
   Geist et Playfair Display sans règle d'usage explicite.
2. **Les couleurs doivent changer.** La palette actuelle est beige/doré/charcoal
   — le token nommé `brand-rose` vaut `#D4A574`, un doré, pas un rose.
3. **La page de connexion est mauvaise sur mobile et sur desktop.** Elle utilise
   un écran scindé dont la moitié gauche disparaît sous `lg`, avec un dégradé et
   deux flous — trois choses que le nouveau design system interdit.

## Objectif

Installer les fondations du design system, et refaire la page de connexion comme
premier écran de référence.

## Le design system

Fourni par l'utilisateur (planche de style) :

| Token | Hex | Usage |
|---|---|---|
| Rose Gloss | `#FF5C8A` | Action primaire, accents |
| Prune | `#3A1024` | Texte, surfaces sombres |
| Menthe | `#A8E6CF` | Disponibilité, économies, commissions, confirmation |
| Crème | `#FFF6F1` | Fond |

**Deux polices, aux rôles stricts** — c'est ce qui règle le problème n° 1 :

- **Bricolage Grotesque** → titres, accroches, wordmark
- **Archivo** → interface, formulaires, montants

**Règles reprises du brief :** tout ce qui est cliquable est une pill
(`999px`) ; cartes à `36px`, panneaux imbriqués à `22px` ; **aucune ombre**,
aucun dégradé, aucun flou ; survol = couleur seule ; appui = `scale(0.97)` ;
focus = anneau rose 2px ; désactivé = opacité 0.4 ; transitions 120ms (état) et
200ms (mouvement) en `cubic-bezier(0.2, 0.8, 0.2, 1)` ; une seule action primaire
rose par vue ; menthe jamais pour une action neutre ou destructrice ; cibles
tactiles ≥ 44px ; corps ≥ 16px ; espacement par `gap`, pas par marges entre
frères.

---

## Décisions

### Les tokens vivent dans le CSS, et cohabitent avec les anciens

Source unique : `src/app/globals.css`. Aucune duplication dans un objet JS.

**Les anciens tokens `brand-*` restent en place.** Les supprimer casserait
instantanément 142 fichiers `.tsx`, dont la caisse que des salons pilotes
utilisent en production. Les nouveaux s'ajoutent à côté ; chaque lot migre des
pages, et les anciens disparaîtront quand plus rien ne les référencera.

Les tokens `pos-*` de la caisse ne sont pas touchés par ce lot.

### Bricolage Grotesque passe par `@import`, pas par `next/font`

Vérifié : `Archivo` figure dans le catalogue de `next/font/google` de la version
installée, **`Bricolage_Grotesque` non**. Les deux répondent en revanche
correctement chez Google Fonts (HTTP 200).

Archivo est donc chargée par le helper Next (self-hosting, pas de requête
tierce) ; Bricolage Grotesque par `@import` CSS. Asymétrie assumée : la seule
alternative serait d'auto-héberger les fichiers de police à la main, pour un gain
nul sur une police de titres.

### Le sélecteur de rôle oriente l'inscription, il ne filtre pas la connexion

**Vérifié dans le code :** `signIn("credentials")` ne prend aucun rôle, et
`/api/auth/redirect` redirige **après** connexion selon `session.user.role`. Le
rôle vient du compte, pas d'un choix à l'écran.

Un sélecteur qui filtrerait la connexion ajouterait une façon d'échouer pour une
information que le système connaît déjà : une cliente cliquant par erreur sur
« Salon » serait bloquée sans comprendre. Écarté.

Un sélecteur purement décoratif est écarté aussi — un contrôle qui ne fait rien
finit par tromper quelqu'un.

Les trois onglets changent donc l'accroche et la destination d'inscription :

| Onglet | Accroche | Destination |
|---|---|---|
| Cliente | « Réserve ton prochain soin. » | `/register?role=CLIENT` |
| Salon | « Gère tes rendez-vous et ta caisse. » | `/register?role=PROVIDER` |
| Influenceuse | « Monétise ton audience. » | `/register?role=INFLUENCER` |

La connexion elle-même est identique dans les trois cas.

**Conséquence à traiter :** `register-client.tsx` lit aujourd'hui `callbackUrl`
dans l'URL mais **pas** `role`. Il faut le lui faire lire, sinon l'onglet
« Salon » mène à un formulaire où il faut re-sélectionner « Prestataire ». Les
valeurs sont `CLIENT`, `PROVIDER`, `INFLUENCER` (majuscules) — un paramètre
inconnu est ignoré, le formulaire reste au comportement actuel.

### Trois primitifs, pas douze

Le brief liste douze composants (`Chip`, `Card`, `Badge`, `ServiceRow`,
`SlotPicker`, `StatTile`, `LoyaltyStamps`…). Ce lot n'en crée que trois :
`Button`, `Input`, `RoleTabs` — ceux que la page de connexion utilise réellement.

Construire un `SlotPicker` que rien n'affiche encore serait du travail
spéculatif. Les autres viendront avec les écrans qui les emploient.

### Une seule mise en page, adaptative

L'écran scindé actuel (`hidden lg:flex lg:w-1/2`) disparaît : sa moitié gauche
n'existe pas sur mobile, ce qui donne deux expériences très différentes. À la
place, une carte centrée de ~420px maximum, identique partout, simplement plus
aérée sur grand écran.

---

## Architecture

| Fichier | Responsabilité | Action |
|---|---|---|
| `src/app/globals.css` | Tokens : couleurs, polices, rayons, transitions | **Modifier** |
| `src/app/layout.tsx` | Charger Archivo (helper Next) | **Modifier** |
| `src/components/ui/button.tsx` | Bouton pill, variantes `primary`/`secondary` | **Créer** |
| `src/components/ui/input.tsx` | Champ pill avec label | **Créer** |
| `src/components/ui/role-tabs.tsx` | Sélecteur à trois onglets | **Créer** |
| `src/app/(auth)/login/login-client.tsx` | Réécriture complète | **Modifier** |
| `src/app/(auth)/register/register-client.tsx` | Lire `?role=` dans l'URL | **Modifier** |

### La page de connexion

```
        salonista.            ← Bricolage Grotesque, point rose
     Ravie de te revoir.      ← accroche, varie selon l'onglet

  ┌────────────────────────┐  ← carte blanche, 36px, SANS ombre
  │  JE SUIS               │
  │ [Cliente][Salon][Infl] │  ← pills, actif = rose
  │  E-MAIL                │
  │ [                    ] │  ← champs en pill
  │  MOT DE PASSE          │
  │ [                 👁  ] │
  │ [   Se connecter     ] │  ← unique action rose
  │  ── ou ──              │
  │ [ Continuer Google   ] │  ← secondaire, prune
  └────────────────────────┘

     Mot de passe oublié ?
     Pas de compte ? Créer   ← destination selon l'onglet
```

Fond crème, carte blanche : la carte se détache par sa couleur, pas par une
élévation.

---

## Vérification

**Rien n'est testable automatiquement ici.** Vitest tourne en `environment:
"node"` sans jsdom, et aucun test ne dit si une page est belle. La vérification
est donc :

1. `npm run build` réussit ; `npx tsc --noEmit` et ESLint sans erreur nouvelle.
2. `grep` sur la page de connexion : **aucun** `shadow`, `gradient` ou `blur`.
3. Les deux polices se chargent (inspection du HTML servi).
4. **Contrôle visuel par l'utilisateur**, sur mobile et desktop — c'est l'arbitre.
5. Non-régression : la caisse (`/pos`), le feed et les fiches salon sont
   **inchangés**.
6. Les trois onglets mènent bien à `/register?role=…` avec la bonne valeur, et le
   formulaire d'inscription arrive pré-sélectionné.
7. Cibles tactiles ≥ 44px et corps ≥ 16px sur la page de connexion.

---

## Ce que ce lot ne fait pas

- Ni le feed, ni les fiches salon, ni la caisse.
- Il ne supprime pas les anciens tokens `brand-*` (142 fichiers en dépendent).
- Il ne migre ni les 281 `rounded-*` ni les 27 fichiers à ombres du reste du site.
- Il ne crée que 3 des 12 primitifs du brief.

**Suite logique :** lot 2 sur le feed d'accueil, avec les cartes salon de la
capture de référence — badge menthe « LIBRE 14:00 », note en étoile, ligne
« quartier · catégories · dès N TND ». Les primitifs `Chip`, `Card` et `Badge`
y seront créés.

## Note sur les références fournies

Deux captures ont servi de référence. La première (feed mobile) **est** le design
system voulu et guidera le lot 2.

La seconde montre une **autre application** — espagnole (« Soy », « Iniciar
como »), copyright « Salonista S.A. de C.V. ». Seule sa **structure** de page de
connexion est reprise (sélecteur de rôle en haut, carte centrée) ; ni son
identité visuelle, ni son logo, ni ses libellés.
