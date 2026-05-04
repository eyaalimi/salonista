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

echo "[2/6] Install dependencies (production lockfile)"
npm ci --no-audit --no-fund

echo "[3/6] Apply Prisma migrations"
npx prisma migrate deploy
npx prisma generate

echo "[4/6] Build Next.js"
npm run build

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
echo "Deploy OK."
