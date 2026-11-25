#!/usr/bin/env bash
# scripts/deploy.sh — pull, build and (re)start Teknodoz Sunum with PM2.
# Usage:  PORT=3030 ./scripts/deploy.sh   (first time)  →  ./scripts/deploy.sh   (afterwards, settings saved in .deploy.env)
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP_DIR/.deploy.env"

# Remember settings between deploys: values passed on the command line win, then .deploy.env, then defaults.
CLI_PORT="${PORT:-}"; CLI_BRANCH="${BRANCH:-}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && source "$ENV_FILE"
export PORT="${CLI_PORT:-${PORT:-3001}}"
BRANCH="${CLI_BRANCH:-${BRANCH:-claude/nodejs-presentation-app-zu7ljh}}"
export HOST="${HOST:-127.0.0.1}"
printf 'PORT=%s\nBRANCH=%s\n' "$PORT" "$BRANCH" > "$ENV_FILE"

cd "$APP_DIR"
echo "▶ Deploy: $APP_DIR  branch=$BRANCH  port=$PORT"

node -e 'const [maj]=process.versions.node.split(".").map(Number); if (maj < 20) { console.error("Node >= 20 gerekli, mevcut: " + process.version); process.exit(1) }'
command -v pm2 >/dev/null 2>&1 || npm install -g pm2

git fetch --prune origin "$BRANCH"
git reset --hard "origin/$BRANCH"

npm ci --no-audit --no-fund
npm run build

pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

# survive reboots without root: resurrect PM2 processes from the user's crontab
PM2_BIN="$(command -v pm2)"
CRON_LINE="@reboot PATH=$(dirname "$(command -v node)"):\$PATH $PM2_BIN resurrect"
# (`crontab -l` exits 1 when empty and grep exits 1 on no match → guard both, otherwise set -e/pipefail aborts here)
# + daily 03:17 backup of shared presentations (data/), last 14 kept in ~/backups/teknodoz-sunum
mkdir -p "$HOME/backups"
BACKUP_LINE="17 3 * * * $APP_DIR/scripts/backup.sh >> $HOME/backups/teknodoz-sunum.log 2>&1"
{ { crontab -l 2>/dev/null || true; } | { grep -v -e 'pm2 resurrect' -e 'scripts/backup.sh' || true; }; echo "$CRON_LINE"; echo "$BACKUP_LINE"; } | crontab - \
  || echo "⚠️  crontab yazılamadı — reboot sonrası 'pm2 resurrect' elle çalıştırılmalı"

sleep 2
if curl -fsS "http://127.0.0.1:$PORT/api/health"; then
  echo -e "\n✅ Çalışıyor → http://127.0.0.1:$PORT"
else
  echo "❌ Sağlık kontrolü başarısız. Loglar: pm2 logs teknodoz-sunum --lines 50"
  exit 1
fi
