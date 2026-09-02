# Salonista — Deployment Guide

Production deployment on **Amazon Lightsail Ubuntu** (`3.127.102.192`), domain `salonista.tn` via Cloudflare DNS-only, automated via **GitHub Actions**.

```
GitHub push (main)
      ↓
GitHub Actions (SSH)
      ↓
Lightsail VM
  ├─ Nginx :80/:443 → reverse proxy → Next.js :3000
  ├─ PM2 keeps Next.js alive
  ├─ PostgreSQL local :5432
  └─ Let's Encrypt SSL
```

---

## Prerequisites (already done)

- ✅ Lightsail Ubuntu instance running at `3.127.102.192`
- ✅ SSH key (`.pem`) provided
- ✅ Cloudflare DNS A records:
    - `salonista.tn` → `3.127.102.192` (DNS only, gray cloud)
    - `www.salonista.tn` → `3.127.102.192` (DNS only)
- ✅ GitHub repo: https://github.com/eyaalimi/salonista
- ✅ GitHub secrets configured:
    - `SSH_HOST` = `3.127.102.192`
    - `SSH_USER` = `ubuntu`
    - `SSH_PRIVATE_KEY` = contents of the `.pem` file

---

## Step 1 — First-time server bootstrap (manual, ONE TIME)

### 1.1 SSH into the server

From your local machine, with the `.pem` file available:

```bash
chmod 600 path/to/key.pem      # macOS / Linux only
ssh -i path/to/key.pem ubuntu@3.127.102.192
```

On Windows, use PuTTY or PowerShell with `ssh -i C:\path\to\key.pem ubuntu@3.127.102.192`.

### 1.2 Clone the repo

```bash
cd /home/ubuntu
git clone https://github.com/eyaalimi/salonista.git
cd salonista
```

### 1.3 Run the setup script

```bash
chmod +x scripts/deploy/setup-server.sh scripts/deploy/deploy.sh
./scripts/deploy/setup-server.sh
```

This installs Node 20, PostgreSQL, Nginx, PM2, certbot, configures the firewall, creates the database `salonista_prod` with user `salonista`, and writes the Nginx site config.

**⚠️ At the end of this script, a Postgres password is printed. Copy it now — you won't see it again.**

### 1.4 Create the production `.env`

```bash
cp scripts/deploy/.env.production.example .env
nano .env
```

Fill the values:

- `DATABASE_URL`: replace `CHANGE_ME` with the Postgres password from step 1.3.
  Final value should look like:
  `postgresql://salonista:THE_GENERATED_PASSWORD@localhost:5432/salonista_prod?schema=public`
- `NEXTAUTH_SECRET`: generate with:
  ```bash
  openssl rand -base64 32
  ```
- `NEXTAUTH_URL`: keep `https://salonista.tn`.
- Leave `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` empty for now.
- `REQUIRE_EMAIL_VERIFICATION=false` — keep this so users don't need to verify their email.

Save (Ctrl+O, Enter, Ctrl+X).

### 1.5 First deploy (manual)

```bash
./scripts/deploy/deploy.sh
```

This pulls `main`, installs deps, runs migrations, builds, and starts under PM2.

Verify it's running:

```bash
pm2 status
curl -I http://127.0.0.1:3000
```

You should see `HTTP/1.1 200 OK`.

### 1.6 Verify the site responds via HTTP

From your local browser, open: **http://salonista.tn** (DNS may take a few minutes to propagate).
You should see the Beauté.tn / Salonista homepage.

### 1.7 Issue the SSL certificate

Once HTTP works:

```bash
sudo certbot --nginx -d salonista.tn -d www.salonista.tn
```

Follow the prompts:
- Enter your email (for renewal notices).
- Agree to the terms.
- Choose option **2: Redirect** (force HTTPS).

certbot rewrites the Nginx config and reloads it. Check **https://salonista.tn**.

Let's Encrypt certs auto-renew via systemd timer — nothing more to do.

---

## Step 2 — Automated deploys (every push to `main`)

Once Step 1 is done, **every push to `main`** triggers `.github/workflows/deploy.yml`, which SSHs into the server and runs `scripts/deploy/deploy.sh`.

Watch a deploy:
1. Push a commit to `main`.
2. Open https://github.com/eyaalimi/salonista/actions to see the run.
3. The job will:
   - SSH in
   - `git pull`
   - `npm ci`
   - `prisma migrate deploy`
   - `npm run build`
   - `pm2 reload salonista`

If the build fails, the workflow fails and PM2 keeps the previous version running (because `pm2 reload` is graceful and won't replace a working process if the new one crashes immediately).

---

## Common operations

### View live logs
```bash
ssh -i key.pem ubuntu@3.127.102.192
pm2 logs salonista
```

### Restart the app
```bash
pm2 restart salonista
```

### Manual deploy (skip GitHub Actions)
```bash
cd /home/ubuntu/salonista
./scripts/deploy/deploy.sh
```

### Check Nginx status
```bash
sudo systemctl status nginx
sudo nginx -t
sudo tail -f /var/log/nginx/access.log
```

### Appliquer les en-têtes de sécurité sur `/uploads/` (lot C, une seule fois)

`deploy.sh` ne touche pas à la configuration Nginx : un serveur déjà en place
ne reçoit **pas** les en-têtes ajoutés à `setup-server.sh`. À appliquer une
fois, à la main :

```bash
sudo nano /etc/nginx/sites-enabled/salonista.tn
```

Dans le bloc `location /uploads/`, ajouter :

```nginx
add_header X-Content-Type-Options nosniff always;
default_type application/octet-stream;
```

Puis vérifier et recharger :

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -sI https://salonista.tn/uploads/<un-fichier>.webp | grep -i x-content-type
```

La dernière commande doit afficher `x-content-type-options: nosniff`.

### Serveur par défaut et `X-Forwarded-Host` (lot D, une seule fois)

Même remarque : `deploy.sh` ne touche pas à Nginx. Deux ajouts à appliquer à
la main dans `/etc/nginx/sites-enabled/salonista.tn`.

**1. Dans le bloc `location /`**, à côté des autres `proxy_set_header` :

```nginx
proxy_set_header X-Forwarded-Host $host;
```

Sans elle, Nginx transmet l'en-tête tel que le client l'a envoyé.

**2. Un serveur par défaut**, avant le bloc `server` existant :

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}
```

Il ferme la connexion pour tout `Host` inconnu. Sans lui, n'importe quel
domaine pointant vers l'IP affiche le site comme le sien.

> **Attention à l'ordre avec certbot.** Si le HTTPS est déjà configuré,
> certbot a créé ses propres blocs `listen 443`. Ajoutez alors le
> `default_server` sur le port 443 également, sinon il ne protège que le
> port 80. Vérifiez avec `sudo nginx -T | grep default_server`.

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -sI -H "Host: inconnu.example" http://127.0.0.1/   # doit ne rien renvoyer
```

### Open a Postgres shell
```bash
sudo -u postgres psql -d salonista_prod
```

### Create a production admin
```bash
cd /home/ubuntu/salonista
npx tsx scripts/create-admin.ts you@example.com YourPass123 "Your Name"
```

### Pull a fresh `.env` if lost
The example template is at `scripts/deploy/.env.production.example`. The actual `.env` is **not** in git (gitignored) — keep a backup somewhere safe.

---

## Switching Cloudflare to Proxied (orange cloud) later

Once Let's Encrypt is in place and the site is stable:

1. Go to Cloudflare dashboard → DNS for `salonista.tn`.
2. Click the gray cloud next to `salonista.tn` and `www.salonista.tn` — it turns orange.
3. Cloudflare → SSL/TLS → Overview → set **SSL/TLS encryption mode** to **Full (strict)**.
4. Done. Cloudflare now sits in front of the origin and provides DDoS protection + caching.

If you ever need to renew Let's Encrypt manually while proxied, temporarily switch back to gray, run `sudo certbot renew`, then switch back to orange.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `502 Bad Gateway` from Nginx | `pm2 status` — Next.js crashed. `pm2 logs salonista --lines 100` for the cause. |
| GitHub Actions deploy fails on SSH | Verify the secret `SSH_PRIVATE_KEY` contains the **entire** `.pem` content including `-----BEGIN ... -----` and `-----END ... -----`. |
| `could not read Username for 'https://github.com': No such device or address` | Le remote porte un jeton expiré. Le message est trompeur : la session SSH n'a pas de terminal où saisir un identifiant, d'où « No such device » plutôt qu'une invite. Le dépôt est **public**, aucun identifiant n'est requis pour lire. Corrigé automatiquement depuis que le workflow et `deploy.sh` forcent `git remote set-url origin https://github.com/eyaalimi/salonista.git`. Pour débloquer un serveur à la main : `cd /home/ubuntu/salonista && git remote set-url origin https://github.com/eyaalimi/salonista.git && git config --unset credential.helper` |
| Migration fails on deploy | SSH in, run `npx prisma migrate status` to see the gap. Manually apply or `migrate resolve` then redeploy. |
| Cloudflare shows "Error 521" | Origin is unreachable. Check Lightsail firewall has port 80/443 open and Nginx is running. |
| `permission denied` on uploads | `sudo chown -R ubuntu:ubuntu /home/ubuntu/salonista/public/uploads` |

---

## Files in this directory

- **`setup-server.sh`** — one-shot bootstrap (run once, manually, on the server)
- **`deploy.sh`** — incremental deploy (run by GitHub Actions on every push)
- **`.env.production.example`** — template for the production `.env`
- **`README.md`** — this file

---

## One-time scripts

After deploying a migration that needs data backfill, SSH in and run the
matching script. They're all idempotent — safe to re-run.

### `prisma/backfill-phase1.ts` (Phase 1)

Run once, after `prisma migrate deploy` on the Phase 1 deploy:

```bash
cd /home/ubuntu/salonista
npx tsx prisma/backfill-phase1.ts
```

What it does:
- Creates a `Customer` row for every `User` with role=CLIENT and a non-null phone.
- Sets `Booking.customerId` for existing bookings whose client has a matching phone.
- Creates an `OWNER` `SalonEmployee` row for every `ProviderProfile` that doesn't already have one.

Re-running it is a no-op once the data is in place.

### `prisma/backfill-phase3.ts` (Phase 3)

Run once, after `prisma migrate deploy` on the Phase 3 deploy:

```bash
cd /home/ubuntu/salonista
npx tsx prisma/backfill-phase3.ts
```

What it does:
- For every paid `Sale` with no `bookingId`, creates a phantom `Booking` (`phantom: true, walkIn: true, status: COMPLETED`) and links it back via `Sale.bookingId`. Makes the analytics dashboard count Phase 2 sales correctly.

Idempotent — re-runs are no-ops.

### `scripts/backfill-uploads.ts` — rattrapage des images d'avant le lot C

Le lot C re-encode chaque téléversement en WebP et le décline en 400/800/
1600 px, servis via `srcset`. Il ne vaut que pour les **nouveaux** fichiers :
les photos déjà sur le disque sont restées en `.jpg`/`.png`, reconnues comme
héritées par `aDesVariantes()` et servies **en pleine résolution**.

Mesuré en production le 24 août : une image de 1 600 px téléchargée pour
s'afficher dans 214 px, un premier rendu à 7,4 s en cache froid pour un TTFB à
277 ms.

```bash
cd /home/ubuntu/salonista
npx tsx scripts/backfill-uploads.ts            # SIMULE, n'écrit rien
npx tsx scripts/backfill-uploads.ts --apply    # convertit et réécrit la base
```

Ce qu'il fait :

- produit, pour chaque image sans canonique WebP, exactement ce que produit
  `POST /api/upload` — mêmes helpers importés depuis `src/lib/upload-image.ts`,
  donc aucune règle dupliquée qui pourrait diverger ;
- réécrit les URLs dans les cinq colonnes qui en portent : `User.avatar`,
  `ProviderProfile.photos[]`, `ProviderProfile.logo`, `Offer.photos[]`,
  `Product.photo`.

**Quand le relancer :** après toute reprise de fichiers déposés hors de la
route d'upload (restauration de sauvegarde, copie manuelle dans
`public/uploads/`). Un passage à vide ne coûte qu'une lecture du dossier.

Quatre garanties tenues :

- **Idempotent.** Un fichier dont la canonique `<base>.webp` existe est ignoré.
  Les variantes `<base>-400.webp` sont reconnues comme telles et jamais
  reprises pour des originaux — sans ce filtre, chaque relance produirait
  `<base>-400-400.webp`.
- **Aucun original supprimé.** Les `.jpg`/`.png` restent en place : si une
  référence était manquée quelque part, elle continue de fonctionner au lieu
  d'afficher une image cassée. Le ménage se fera après vérification.
- **Séquentiel.** Un `sharp` à la fois. La Lightsail a 1 Go de RAM et `next
  build` y sature déjà la mémoire ; dix décodages de 1 600 px en parallèle la
  mettraient à genoux.
- **Une transaction par entité**, pas un verrou unique sur toute la base
  pendant la durée du lot.

Un fichier illisible est journalisé et le lot continue ; sa référence en base
reste alors sur l'original, toujours présent. Le script ne réécrit **que** vers
des fichiers qu'il a effectivement écrits.

---

## Notes

- **Service worker (`/sw.js`)** is a static file in `public/`. Nginx must serve it with `Cache-Control: no-cache`. The default config passes through to Next.js, which sets correct headers — no Nginx change needed unless you add explicit caching rules for `.js` files.
- **PWA manifest** at `/manifest.json` is also static; same rule.
- **PWA icons** in `public/icons/` are generated from `src/app/icon.svg` via `npm run icons:pwa` (one-time, then committed). Re-run only if the brand mark changes.
- **POS service worker (`public/sw.js`)** loads Workbox 7 via `importScripts` from `storage.googleapis.com/workbox-cdn`. Outbound CDN must be reachable from the salon's network for the first SW install on each device — afterwards the SW is cached. If your CSP restricts external scripts, allow `storage.googleapis.com` in `script-src` for `/sw.js`.
- **Cache busting on POS deploys**: bump `SW_VERSION` constant in `public/sw.js` if a release affects the POS shell and you need clients to pick it up immediately. Otherwise the existing SW will swap on the next page load thanks to `skipWaiting` + `clientsClaim`.

## Optional: S3 offsite backups

The nightly `backup.sh` job writes locally to `/home/ubuntu/backups/`. To replicate to S3, configure these env vars in `/home/ubuntu/salonista/.env`:

```
BACKUP_S3_BUCKET=salonista-backups-<account>
AWS_ACCESS_KEY_ID=…
AWS_SECRET_ACCESS_KEY=…
AWS_REGION=eu-west-1
```

If the variables are absent, `backup.sh` runs local-only and the `/admin` banner shows an amber warning until you configure them.

### One-time AWS provisioning

1. **Create a private S3 bucket** `salonista-backups-<account>` in `eu-west-1`. Block all public access. SSE-S3 (default) is sufficient.

2. **Apply a lifecycle policy** (S3 console → Management → Lifecycle rules):
   ```json
   {
     "Rules": [{
       "ID": "salonista-backup-lifecycle",
       "Status": "Enabled",
       "Filter": { "Prefix": "" },
       "Transitions": [{ "Days": 30, "StorageClass": "GLACIER_IR" }],
       "Expiration": { "Days": 365 },
       "NoncurrentVersionExpiration": { "NoncurrentDays": 7 }
     }]
   }
   ```

3. **Create an IAM user** `salonista-backup-writer` with programmatic access only (no console).

4. **Attach this inline policy** (least privilege):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:ListBucket", "s3:GetObject", "s3:DeleteObject"],
       "Resource": [
         "arn:aws:s3:::salonista-backups-<account>",
         "arn:aws:s3:::salonista-backups-<account>/*"
       ]
     }]
   }
   ```

5. **Generate access keys** for the user, paste into the server's `/home/ubuntu/salonista/.env`.

6. **Install the AWS CLI** on the server: `sudo apt-get install -y awscli`.

7. **Smoke test**:
   ```bash
   aws s3 ls "s3://$BACKUP_S3_BUCKET/"
   bash /home/ubuntu/salonista/scripts/deploy/backup.sh
   aws s3 ls "s3://$BACKUP_S3_BUCKET/$(hostname)/db/"
   ```
   The last command should list today's dump.

### Restore

```bash
bash scripts/deploy/restore.sh /home/ubuntu/backups/db/salonista_YYYY-MM-DD_HHMM.dump
```
Type `restore` to confirm. Uploads are restored separately: `tar xzf /home/ubuntu/backups/uploads/uploads_*.tar.gz -C /home/ubuntu/salonista/public/`.
