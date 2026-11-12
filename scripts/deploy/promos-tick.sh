#!/usr/bin/env bash
# promos-tick.sh — un passage du moteur d'envoi des promos WhatsApp.
# Cron (chaque minute) : voir /etc/cron.d/salonista-promos, pose par
# setup-server.sh.
#
# Le secret est lu dans le .env de l'application, jamais ecrit dans le cron.
# Il passe a curl par l'ENTREE STANDARD (-H @-) et non en argument : un
# argument de commande est visible de tout utilisateur du serveur via `ps`.
#
# `flock` : si un passage dure plus d'une minute (gros envoi), le suivant ne
# demarre pas par-dessus. La base l'empecherait deja d'envoyer deux fois
# (FOR UPDATE SKIP LOCKED) ; le verrou evite seulement des passages inutiles.

set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/salonista}"
LOCK_FILE="/tmp/salonista-promos-tick.lock"

if [ ! -f "$APP_DIR/.env" ]; then
  echo "[$(date -u +%FT%TZ)] ERREUR: $APP_DIR/.env introuvable" >&2
  exit 1
fi

SECRET="$(grep -E '^CRON_SECRET=' "$APP_DIR/.env" | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
if [ -z "$SECRET" ]; then
  # Pas de secret = promos pas encore configurees : on sort sans bruit.
  exit 0
fi

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

printf 'Authorization: Bearer %s\n' "$SECRET" | curl -fsS --max-time 300 \
  -X POST -H @- \
  http://127.0.0.1:3000/api/internal/promos/tick \
  -o /dev/null
