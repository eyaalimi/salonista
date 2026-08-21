# Salonista — résumé du projet

**Une place de marché beauté pour la Tunisie**, doublée d'une caisse pour les
salons qui la veulent. Domaine : `salonista.tn`.

*Dernière mise à jour : 21 août 2026.*

---

## L'idée

Une cliente cherche une coiffeuse ou une esthéticienne près de chez elle,
compare les offres, réserve et paie en ligne. Elle reçoit un QR code qu'elle
présente au salon.

Un salon publie ses prestations, reçoit des réservations, et peut nouer des
collaborations avec des influenceuses payées à la conversion.

**La caisse est un module payant à part.** C'est un argument pour gagner des
salons, jamais un péage à l'entrée : un salon peut vivre sur Salonista sans y
toucher.

## Les quatre rôles

| Rôle | Ce qu'il fait |
|---|---|
| **Cliente** | Cherche, réserve, paie, présente son QR code au salon |
| **Salon** | Publie ses offres, gère ses rendez-vous, encaisse (option) |
| **Influenceuse** | Accepte des collaborations, partage un lien, touche une commission |
| **Admin** | Modère les comptes, les offres, les abonnements |

---

## Comment un salon arrive chez nous

Deux portes, pour deux situations réelles :

**Le commercial se déplace** (`/pos-start`). Il est dans le salon avec sa
tablette. Email, nom du salon, un mot de passe, un code PIN — la caisse tourne
en cinq minutes. Outil de terrain.

**Le salon nous trouve seul** (`/pro` → `/register`). À Djerba ou à Gabès,
personne n'est là pour l'aider. Il s'inscrit, un guide en trois étapes le mène
jusqu'à sa première offre publiée : *compléter son profil*, *ajouter un
service*, *définir ses horaires*.

> Les horaires sont une étape obligatoire pour une raison précise : sans eux,
> aucun créneau n'est généré. Le salon se croirait en ligne alors qu'aucune
> cliente ne pourrait réserver.

---

## La pile technique

| Couche | Choix |
|---|---|
| Cadre | Next.js 16.2 (App Router, Turbopack), React 19, Node 20 |
| Base | PostgreSQL via Prisma 7 — **35 modèles** |
| Auth | NextAuth v4 (JWT), identifiants + Google, code PIN pour la caisse |
| Style | Tailwind v4, un seul `globals.css` |
| Email | Nodemailer + Gmail SMTP |
| Hébergement | Amazon Lightsail, Nginx + PM2, TLS Let's Encrypt |
| Déploiement | GitHub Actions sur `main` → SSH → `deploy.sh` |

**Le volume :** 368 fichiers TypeScript, 103 routes d'API, 60 pages,
**214 tests**.

## La charte

Rose `#FF5C8A` pour l'action, prune `#3A1024` pour le texte, menthe pour les
confirmations et les économies, crème en fond. **Aucune ombre, aucun dégradé,
aucun flou.** Une seule action rose par écran. Cibles tactiles ≥ 44 px, texte
≥ 16 px.

Tous les contrastes sont calculés, pas estimés — y compris sur les trois fonds
que traverse la caisse. Le rose plafonne à 2,94:1 : il sert de **fond**, jamais
de couleur de texte.

---

## Ce qui a été fait dans la dernière session

**33 commits.** Les cinq chantiers, du plus structurant au plus fin :

**1. Un salon sans caisse retrouve son espace.** Le module bloquait *toute*
l'application : un salon non abonné ne voyait qu'un mur, ni ses rendez-vous ni
ses offres. Le verrou est descendu sur les seules pages de caisse. Une revue a
trouvé sept sous-routes encore ouvertes — dont une réception de stock chiffrée,
absente du menu et donc invisible à tout test manuel.

**2. Les réservations arrivent au salon.** Une réservation prise en ligne
était bien enregistrée mais n'apparaissait jamais dans l'agenda : l'API
répondait 403 sans le module caisse. Elle s'affichait ensuite « Sans client »,
parce que le code ne lisait que la fiche client du salon — une cliente venue du
site n'en a pas.

**3. Inscription autonome.** Page `/pro`, guide de démarrage, découverte de la
caisse depuis l'espace du salon.

**4. Simplification.** Le tableau de bord passe des graphiques aux phrases :
« Tu as gagné 340 TND », « 45 TND de plus qu'hier ». L'agenda passe d'une
grille de 28 lignes à une liste. Toute la caisse adopte la charte de la place
de marché.

**5. Corrections de parcours.** Défilement automatique vers le calendrier puis
les horaires ; heures en 24 h (la locale `fr-TN` affichait « 06:30 PM ») ;
encaissement depuis l'agenda, qui perdait l'identifiant du rendez-vous ; logo
du salon ; cartes côte à côte sur ordinateur.

---

## Les pièges à connaître

Ceux qui ont coûté du temps, et qui reviendront :

- **`fr-TN` affiche les heures sur 12 heures.** Passer par
  `src/lib/datetime.ts`, jamais par `toLocaleTimeString` directement.
- **Les photos ne sont pas optionnelles.** Toutes les surfaces publiques
  filtrent sur `photos: { isEmpty: false }` — une offre sans photo est publiée
  mais introuvable.
- **Utiliser `<UploadedImage>`** pour tout `/uploads/…` : l'optimiseur de
  Next.js ne voit pas les fichiers écrits après le build.
- **Énumérer les routes, jamais le menu.** Un garde d'accès dérivé de la
  navigation laisse les sous-routes ouvertes.
- **Vitest tourne sans jsdom** : aucun composant React n'est testable. Les 214
  tests portent sur la logique pure.
- **`npm run build` échoue en local** au prérendu de `/` (`ECONNREFUSED`) :
  la page d'accueil interroge Postgres. `✓ Compiled successfully` est le
  contrôle qui compte.

## Ce qui reste ouvert

- **Le paiement est un stub** — aucun prestataire réel n'est branché.
- **Les collaborations n'existent pas dans la caisse** : `/pos/collab` est un
  argumentaire « bientôt disponible ». L'API fonctionne, l'écran est à écrire.
- **L'API de la caisse est peu gardée** au niveau des modules — antérieur à
  cette session, mais le layout la protégeait indirectement avant.
- Pas de CDN devant `/uploads/` ; Nginx met en cache 7 jours.

---

## Pour reprendre

`CLAUDE.md` est le manuel d'exploitation — à lire à chaque session.
`CONTEXT.md` raconte le projet pour un humain.
`docs/superpowers/specs/` et `docs/superpowers/plans/` gardent la trace des
décisions : pourquoi telle option a été retenue, et laquelle a été écartée.
