#!/usr/bin/env bash
# Daily backup of shared presentations (data/) — keeps the last 14 archives.
# Usage: ./scripts/backup.sh            (deploy.sh installs a daily cron entry for it)
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${DATA_DIR:-$APP_DIR/data}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/teknodoz-sunum}"
KEEP="${KEEP:-14}"
[ -d "$DATA_DIR" ] || { echo "data dir yok: $DATA_DIR"; exit 0; }
mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
tar -czf "$BACKUP_DIR/data-$STAMP.tar.gz" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
chmod 600 "$BACKUP_DIR/data-$STAMP.tar.gz"
# rotate
ls -1t "$BACKUP_DIR"/data-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "✅ Yedek: $BACKUP_DIR/data-$STAMP.tar.gz ($(du -h "$BACKUP_DIR/data-$STAMP.tar.gz" | cut -f1))"
