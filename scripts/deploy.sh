#!/usr/bin/env bash
# scripts/deploy.sh — pull, build and (re)start Teknodoz Sunum with PM2.
# Usage:  PORT=3001 BRANCH=main ./scripts/deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${BRANCH:-claude/nodejs-presentation-app-zu7ljh}"
export PORT="${PORT:-3001}"
export HOST="${HOST:-127.0.0.1}"

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
( crontab -l 2>/dev/null | grep -v 'pm2 resurrect' ; echo "$CRON_LINE" ) | crontab -

sleep 2
if curl -fsS "http://127.0.0.1:$PORT/api/health"; then
  echo -e "\n✅ Çalışıyor → http://127.0.0.1:$PORT"
else
  echo "❌ Sağlık kontrolü başarısız. Loglar: pm2 logs teknodoz-sunum --lines 50"
  exit 1
fi
