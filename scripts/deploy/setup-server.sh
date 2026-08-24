#!/usr/bin/env bash
# One-shot server bootstrap. Run this ONCE on a fresh Ubuntu Lightsail VM as `ubuntu`.
# Usage:  bash scripts/deploy/setup-server.sh
set -euo pipefail

APP_DIR="/home/ubuntu/salonista"
APP_USER="ubuntu"
DB_NAME="salonista_prod"
DB_USER="salonista"
DOMAIN="salonista.tn"
WWW_DOMAIN="www.salonista.tn"
NODE_MAJOR=20

echo "================================================================"
echo "  Salonista — Server bootstrap"
echo "================================================================"

if [ "$(id -u)" -eq 0 ]; then
  echo "Do not run this script as root. Run as ubuntu (it will sudo when needed)."
  exit 1
fi

echo "[1/8] System update"
sudo apt-get update -y
sudo apt-get upgrade -y

echo "[2/8] Install base packages"
sudo apt-get install -y curl git ca-certificates ufw build-essential

echo "[3/8] Install Node.js ${NODE_MAJOR}"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt "${NODE_MAJOR}" ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v
npm -v

echo "[4/8] Install PM2"
sudo npm install -g pm2

echo "[5/8] Install PostgreSQL"
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql

echo "[6/8] Install Nginx + certbot"
sudo apt-get install -y nginx
sudo apt-get install -y certbot python3-certbot-nginx

echo "[7/8] Configure firewall (UFW)"
sudo ufw allow OpenSSH || true
sudo ufw allow 'Nginx Full' || true
sudo ufw --force enable

echo "[8/8] Create app directory"
mkdir -p "${APP_DIR}"

# --------------------------------------------------------------------
# PostgreSQL: create user and database if they don't exist
# --------------------------------------------------------------------
echo
echo "Configuring PostgreSQL..."
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" || echo "")
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" || echo "")

if [ "${USER_EXISTS}" != "1" ]; then
  DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-32)"
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
  echo
  echo "================================================================"
  echo "  POSTGRES PASSWORD (save this NOW, you won't see it again):"
  echo "  ${DB_PASSWORD}"
  echo "================================================================"
  echo
else
  echo "Postgres user '${DB_USER}' already exists — keeping current password."
fi

if [ "${DB_EXISTS}" != "1" ]; then
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
fi

# Allow local password auth for our app user
PG_HBA=$(sudo -u postgres psql -tAc "SHOW hba_file;")
if ! sudo grep -q "salonista app" "${PG_HBA}"; then
  echo "# salonista app" | sudo tee -a "${PG_HBA}" >/dev/null
  echo "host    ${DB_NAME}    ${DB_USER}    127.0.0.1/32    md5" | sudo tee -a "${PG_HBA}" >/dev/null
  sudo systemctl reload postgresql
fi

# --------------------------------------------------------------------
# Nginx: write site config
# --------------------------------------------------------------------
echo
echo "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/salonista >/dev/null <<NGINX
# Serveur par defaut : ferme la connexion sans repondre pour tout Host
# inconnu. Sans lui, Nginx sert l'application a n'importe quel nom pointant
# vers cette IP — un domaine tiers pouvait donc afficher le site comme le
# sien, et les scanners qui balaient les IP publiques obtenaient une reponse.
#
# 444 est propre a Nginx : la connexion est coupee, aucun octet n'est renvoye.
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};

    client_max_body_size 25M;

    # Static uploads served directly by Nginx
    location /uploads/ {
        alias ${APP_DIR}/public/uploads/;
        expires 7d;
        access_log off;

        # Defense en profondeur contre une XSS stockee. L'API n'accepte plus
        # que de vraies images (format detecte dans les octets, re-encodage en
        # WebP), mais si un fichier hostile arrivait ici par un autre chemin :
        #   - nosniff empeche le navigateur de deviner un type et d'executer
        #     du HTML ou du SVG servi depuis NOTRE origine ;
        #   - default_type force le telechargement plutot que l'affichage pour
        #     tout ce dont Nginx ne reconnait pas l'extension.
        add_header X-Content-Type-Options nosniff always;
        default_type application/octet-stream;
    }

    # Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # ECRASE l'en-tete envoye par le client. Sans cette ligne, Nginx le
        # transmettait tel quel : n'importe qui pouvait poser
        # `X-Forwarded-Host: evil.example` et detourner une redirection.
        # L'application n'en depend plus (voir src/lib/public-origin.ts), mais
        # laisser passer un en-tete falsifiable n'a aucun interet.
        proxy_set_header X-Forwarded-Host \$host;
        proxy_read_timeout 60s;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/salonista /etc/nginx/sites-enabled/salonista
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx


# --- Backups ---
echo "[setup] installing backup cron entry"
sudo mkdir -p /home/ubuntu/backups/db /home/ubuntu/backups/uploads
sudo chown -R ubuntu:ubuntu /home/ubuntu/backups
sudo tee /etc/cron.d/salonista-backup >/dev/null <<'CRON'
# Salonista nightly backup — 03:30 UTC daily
30 3 * * * ubuntu cd /home/ubuntu/salonista && bash scripts/deploy/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
CRON
sudo chmod 0644 /etc/cron.d/salonista-backup

# --------------------------------------------------------------------
# Done
# --------------------------------------------------------------------
echo
echo "================================================================"
echo "  Bootstrap complete."
echo
echo "  NEXT STEPS (manual, one time):"
echo
echo "  1) Clone the repo (if not already there):"
echo "     git clone https://github.com/eyaalimi/salonista.git ${APP_DIR}"
echo
echo "  2) Create the .env file at ${APP_DIR}/.env (see scripts/deploy/README.md)"
echo
echo "  3) Run the first deploy:"
echo "     cd ${APP_DIR} && ./scripts/deploy/deploy.sh"
echo
echo "  4) Once Next.js is running and Cloudflare DNS resolves to this IP,"
echo "     issue an SSL certificate:"
echo "     sudo certbot --nginx -d ${DOMAIN} -d ${WWW_DOMAIN}"
echo "================================================================"
