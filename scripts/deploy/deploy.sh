#!/usr/bin/env bash
# Deploy script — invoked by GitHub Actions after pushing to main.
# Assumes the server has been bootstrapped via setup-server.sh.
set -euo pipefail

APP_DIR="/home/ubuntu/salonista"
APP_NAME="salonista"

cd "${APP_DIR}"

echo "[1/6] Pull latest code"
git fetch --all --prune
git reset --hard origin/main

echo "[2/6] Install dependencies"
# Use npm install (not npm ci) for tolerance with peer-dep edge cases.
# Lockfile is committed but npm 10 can't always do strict ci on it due to
# duplicated transient peer-dep ranges (e.g. preact via @auth/core).
npm install --no-audit --no-fund

echo "[3/6] Apply Prisma migrations"
npx prisma migrate deploy
# Clean the generated client dir before regenerating. An interrupted
# `prisma generate` (e.g. previous build was killed by the SSH timeout)
# can leave partial subdirs that crash the next run with EEXIST.
rm -rf src/generated/prisma
npx prisma generate

echo "[4/6] Build Next.js"
# Lightsail's 1 GB RAM + 2 GB swap is enough for `next build`, but Node's
# default old-space heap (~512 MB) caps the TypeScript checker before it
# can grow into swap. Raise the limit so the build can use available memory.
NODE_OPTIONS="--max-old-space-size=2048" npm run build

echo "[5/6] Ensure uploads dir exists with correct ownership"
mkdir -p "${APP_DIR}/public/uploads"

echo "[6/6] (Re)start app under PM2"
if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
  # Persist process list so it survives reboot
  pm2 save
  pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash || true
  pm2 save
fi

pm2 status

# Verifie que l'application repond vraiment. `pm2 reload` rend la main des que
# le processus est lance, pas quand il sert des requetes : un deploiement
# cassé (variable d'environnement manquante, migration a moitie appliquee)
# affichait "Deploy OK" alors que le site renvoyait 502.
echo "[7/7] Sonde de sante"
SANTE_OK=0
for i in $(seq 1 15); do
  if curl -fsS --max-time 5 "http://127.0.0.1:3000/api/health" >/dev/null 2>&1; then
    SANTE_OK=1
    echo "  Application en ligne (essai ${i})."
    break
  fi
  sleep 2
done

if [ "${SANTE_OK}" -ne 1 ]; then
  echo "ECHEC : /api/health ne repond pas apres 30 secondes." >&2
  echo "Les 40 dernieres lignes du journal :" >&2
  pm2 logs "${APP_NAME}" --lines 40 --nostream >&2 || true
  exit 1
fi

echo "Deploy OK."
