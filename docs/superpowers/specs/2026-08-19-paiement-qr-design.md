# Refonte visuelle — paiement et QR code

**Date :** 2026-08-19
**Statut :** validé, prêt pour le plan d'implémentation
**Précédents :** [l'espace cliente](2026-08-17-espace-cliente-design.md) (mergé, PR #22 et #24) · [la fidélité](2026-08-17-fidelite-cliente-design.md) (poussée, **pas encore mergée**)

---

## Problème

Ce sont les **deux dernières pages** de l'espace cliente restées à l'ancienne
charte. Elles ferment le parcours de réservation : une cliente paie, puis
présente son QR code au salon.

## Objectif

Terminer l'espace cliente.

---

## Périmètre

| Fichier | Lignes | `brand-*` | `luxury-*` | Hors palette |
|---|---|---|---|---|
| `src/app/(dashboard)/cliente/paiement/page.tsx` | 355 | 48 | 10 | 6 |
| `src/app/(dashboard)/cliente/reservation/page.tsx` | 189 | 25 | 5 | 6 |

**Total : 544 lignes.** La page de paiement est la plus grosse de l'espace
cliente et compte **trois états** : formulaire, traitement, succès.

---

## Ce que la lecture du code a révélé

### Le formulaire de carte n'envoie rien

La page affiche un formulaire bancaire complet — numéro, expiration, CVV, nom
du porteur. **Vérifié : aucune de ces données n'est transmise.** Le
`POST /api/payment` n'envoie que `{ bookingId }`.

C'est cohérent avec l'état du projet — le paiement est un stub, aucun
prestataire réel n'est branché. Mais rien ne le dit à l'écran, et la page
affiche même « Paiement securise ».

### Le QR code est le document que la cliente présente

`reservation/page.tsx` affiche le QR code que le salon scanne pour valider la
visite. C'est une pièce justificative, pas une page décorative.

---

## Décisions

### Une mention de démonstration sous le formulaire

Retenu : **« Paiement de démonstration — aucune donnée bancaire n'est
transmise. »**

C'est honnête envers la cliente, et ça évite qu'un testeur croie encaisser.

Conséquence : le surtitre **« Paiement securise » disparaît**. Sur un formulaire
qui ne transmet rien, il promet une sécurité qui n'a pas d'objet — c'est le
genre de mention qui se retourne contre un produit.

Écarté : masquer les champs de carte. Le bouton suffirait puisque rien n'est
transmis, mais cela changerait le **parcours**, pas seulement son apparence.
C'est une décision produit.

### Le QR code n'est jamais retouché

L'image (`<img src={data.qrCode}>`) est générée côté serveur. **Ni sa taille, ni
son fond, ni son contraste ne changent** — un QR altéré devient illisible au
scanner, et la cliente se retrouve devant un salon incapable de valider sa
visite.

Seul son cadre est restylé.

### Les états de succès passent au menthe

Six couleurs `emerald-*` marquent les confirmations — paiement accepté, QR
vérifié. Elles passent au `menthe`, dont c'est l'usage documenté.

Les deux `red-*` du message d'erreur passent au `rose`, seule couleur d'alerte
du système.

### L'animation de traitement est conservée

L'écran « Traitement en cours » utilise `animate-pulse`. Le design system
interdit les **animations d'apparition** — pas les indicateurs d'activité.

Une attente de deux secondes sans retour visuel donnerait l'impression que rien
ne se passe, sur l'écran le plus anxiogène du parcours. `animate-pulse` reste.

### Le rose primaire

| Écran | Action rose |
|---|---|
| Formulaire | « Payer » — la conversion |
| Succès | « Voir le QR code » — l'étape suivante |
| QR code | **aucune** — c'est une page de consultation |

Sur l'écran du QR, « Retour aux réservations » reste en bordure : rien n'y est
à faire, sinon montrer son écran.

### Le tutoiement et les accents

Les deux pages vouvoient et perdent leurs accents (« Ma reservation »,
« Presentez ce code », « Votre visite a ete confirmee »). Elles s'alignent sur
le reste de l'espace, refait aux lots précédents.

---

## Ce que ce chantier ne touche pas

- **`handlePayment`** et son `POST /api/payment`
- Le délai simulé de 2 secondes (`setTimeout`) — c'est le comportement du stub
- Les états `step` (`form` / `processing` / `success`) et leur enchaînement
- Les appels `/api/client/bookings` et `/api/payment?bookingId=`
- Les `<Suspense>` qui enveloppent les deux pages — obligatoires avec
  `useSearchParams()` en Next 16
- **L'image du QR code et son jeton**

---

## Vérification

Aucun test automatisé ne juge un rendu : Vitest tourne en `environment: "node"`
sans jsdom.

1. `grep` : **0** `brand-*`, **0** `luxury-*`, **0** couleur hors palette dans
   les deux fichiers.
2. **0** `shadow`, `gradient`, `blur` — mais `animate-pulse` **conservé**.
3. **Le QR code garde ses dimensions** : `w-56 h-56` et `w-64 h-64` inchangés.
4. Les trois états du paiement s'enchaînent toujours.
5. `npx tsc --noEmit` filtré : aucune sortie. **23 erreurs préexistent**
   ailleurs.
6. ESLint : **52 problèmes**, comme sur `main`.
7. **180 tests au vert.**
8. `npm run build` réussit.
9. **Contrôle visuel par l'utilisatrice**, et surtout : **scanner un QR code
   avec un téléphone** pour vérifier qu'il reste lisible.

---

## Note sur les branches

`design-fidelite` **n'est pas encore mergée**. Aucun fichier n'est commun aux
deux lots — ils peuvent être mergés dans n'importe quel ordre, sans conflit.
