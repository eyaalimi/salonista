# Créer et utiliser un compte superadmin

Procédure à suivre **sur le serveur**, après déploiement.
Compte prévu : `salonista.company@gmail.com`.

---

## Pourquoi un compte séparé

Un `User` ne porte **qu'un seul rôle**, et `/admin` exige exactement `ADMIN`.
Promouvoir `alimieyaa@gmail.com` en `SUPERADMIN` lui ferait donc **perdre
l'accès à `/admin`** — utilisateurs, offres, réservations, commissions.

D'où deux comptes :

| Compte | Rôle | Accès |
|---|---|---|
| `alimieyaa@gmail.com` | `ADMIN` | `/admin` |
| `salonista.company@gmail.com` | `SUPERADMIN` | `/superadmin` |

`SUPERADMIN` n'est **pas** un `ADMIN` supérieur : les deux rôles sont
disjoints, dans les deux sens.

---

## 1. Créer le compte

```bash
cd /home/ubuntu/salonista
npx tsx scripts/create-admin.ts salonista.company@gmail.com '<mot-de-passe>' 'Salonista — Superadmin'
```

Choisis un mot de passe solide : il ouvre le support de tous les salons.
S'il existe déjà, le script met simplement son mot de passe à jour.

## 2. Promouvoir

```bash
# Inspecte sans rien écrire
npx tsx scripts/superadmin.ts promote salonista.company@gmail.com

# Applique
npx tsx scripts/superadmin.ts promote salonista.company@gmail.com --apply
```

## 3. Enrôler la double authentification

1. Ouvre <https://salonista.tn/login>, connecte-toi avec ce compte.
2. Va sur <https://salonista.tn/superadmin> — tu es **automatiquement
   renvoyée** vers l'enrôlement : le mot de passe seul ne suffit jamais.
3. Scanne le QR avec **Google Authenticator**, **Authy** ou **1Password**.
   Si l'appareil photo ne lit pas le QR, déplie « Le QR ne se lit pas ? » :
   la clé s'affiche pour une saisie manuelle.
4. Saisis le code à 6 chiffres.

Le code est redemandé **toutes les 30 minutes**, pas à chaque page.

---

## Les autres commandes

```bash
npx tsx scripts/superadmin.ts list                              # qui est superadmin
npx tsx scripts/superadmin.ts reset-totp <email> --apply        # téléphone perdu
npx tsx scripts/superadmin.ts revoke    <email> --apply         # retirer l'accès
```

`revoke` **refuse de supprimer le dernier compte superadmin** : sans ce
garde-fou, l'équipe se retrouverait dehors sans recours autre qu'un accès
direct à la base.

---

## En cas de blocage

**« Email ou mot de passe incorrect »** — le compte n'existe pas sur CE
serveur, ou le mot de passe diffère. Vérifier :

```bash
sudo -u postgres psql salonista_prod -c \
  "SELECT email, role FROM \"User\" WHERE email LIKE '%salonista.company%';"
```

**Compte verrouillé après 5 codes faux** — le verrou dure 15 minutes, ou :

```bash
npx tsx scripts/superadmin.ts reset-totp salonista.company@gmail.com --apply
```

**Téléphone perdu** — même commande : elle efface le secret et un nouveau QR
est proposé au prochain accès.

**Renvoyée en boucle vers `/login`** — le rôle n'est pas `SUPERADMIN`.
Relancer l'étape 2.

---

## Ce qu'on ne peut pas faire, volontairement

- **Créer un superadmin depuis l'interface web.** Aucune route API n'écrit ce
  rôle ; un test inspecte le code source de toutes les routes et échoue si
  quelqu'un l'ajoute. Le seul chemin est ce script, donc un accès au serveur.
- **Désactiver la double authentification.** Elle est obligatoire.
- **Effacer une ligne du journal d'audit.** Il est en lecture seule : aucune
  route `PATCH` ni `DELETE`, et le script ne sait pas l'effacer.
