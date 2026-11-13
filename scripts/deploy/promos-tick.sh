#!/usr/bin/env bash
# promos-tick.sh — un passage du moteur d'envoi des promos WhatsApp.
# Cron (chaque minute) : /etc/cron.d/salonista-promos. Rotation du journal :
# /etc/logrotate.d/salonista-promos (voir scripts/deploy/README.md).
#
# Le secret est lu dans le .env de l'application, jamais ecrit dans le cron.
# Il passe a curl par l'ENTREE STANDARD (-H @-) et non en argument : un
# argument de commande est visible de tout utilisateur du serveur via `ps`.
#
# N'ECRIT RIEN quand il n'y a rien eu a faire. Le cron tourne 1 440 fois par
# jour : une ligne par passage noierait les seules qui comptent. On ecrit
# seulement si au moins un message est parti, a echoue ou sera reessaye, ou
# si l'appel lui-meme a echoue.
#
# `flock` : si un passage dure plus d'une minute (gros envoi), le suivant ne
# demarre pas par-dessus. La base l'empecherait deja d'envoyer deux fois
# (FOR UPDATE SKIP LOCKED) ; le verrou evite seulement des passages inutiles.

set -uo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/salonista}"
LOCK_FILE="/tmp/salonista-promos-tick.lock"
horodatage() { date -u +%FT%TZ; }

if [ ! -f "$APP_DIR/.env" ]; then
  echo "[$(horodatage)] ERREUR: $APP_DIR/.env introuvable"
  exit 1
fi

SECRET="$(grep -E '^CRON_SECRET=' "$APP_DIR/.env" | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
if [ -z "$SECRET" ]; then
  # Pas de secret = promos pas encore configurees : on sort sans bruit.
  exit 0
fi

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

# La derniere ligne de la sortie est le code HTTP (-w), le reste le corps.
# Les erreurs de curl vont dans un fichier a part : melangees a la sortie,
# elles se colleraient au code HTTP.
ERREURS="$(mktemp)"
trap 'rm -f "$ERREURS"' EXIT
SORTIE="$(printf 'Authorization: Bearer %s\n' "$SECRET" | curl -sS --max-time 300 \
  -X POST -H @- -w '\n%{http_code}' \
  http://127.0.0.1:3000/api/internal/promos/tick 2>"$ERREURS")"
CODE_CURL=$?
HTTP="${SORTIE##*$'\n'}"
CORPS="${SORTIE%$'\n'*}"

if [ "$CODE_CURL" -ne 0 ] || [ "$HTTP" != "200" ]; then
  echo "[$(horodatage)] ERREUR curl=$CODE_CURL http=$HTTP $(tr '\n' ' ' < "$ERREURS" | cut -c1-200)${CORPS:0:300}"
  exit 1
fi

# Tolere les espaces apres « : » (le JSON n'est pas tenu d'etre compact).
champ() { printf '%s' "$CORPS" | grep -oE "\"$1\"[[:space:]]*:[[:space:]]*[0-9]+" | head -n 1 | grep -oE '[0-9]+$'; }
ENVOYES="$(champ envoyes)"; ECHECS="$(champ echecs)"; REESSAIS="$(champ reessais)"; TERMINEES="$(champ terminees)"
ENVOYES="${ENVOYES:-0}"; ECHECS="${ECHECS:-0}"; REESSAIS="${REESSAIS:-0}"; TERMINEES="${TERMINEES:-0}"

if [ "$ENVOYES" -gt 0 ] || [ "$ECHECS" -gt 0 ] || [ "$REESSAIS" -gt 0 ]; then
  echo "[$(horodatage)] envoyes=$ENVOYES echecs=$ECHECS reessais=$REESSAIS campagnes_terminees=$TERMINEES"
fi
