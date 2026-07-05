#!/usr/bin/env bash
#
# Ежедневный бэкап logs.db (источник правды: qna_items + bot_log).
# Использование: scripts/backup.sh  (или через cron, см. Docs/spec.md §7.4)
#
# Qdrant не бэкапим — индекс восстанавливается из logs.db командой
# `npm run qdrant:reindex`. Секреты (.env.*.local) тоже не бэкапим.
#
# Горячий бэкап через sqlite3 ".backup" — безопасно при работающем боте.
# Храним последние 7 архивов, старые удаляются автоматически.

set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="backups"
KEEP=7
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/logs-$STAMP.db"

mkdir -p "$BACKUP_DIR"

sqlite3 logs.db ".backup '$TARGET'"
gzip "$TARGET"

echo "Бэкап создан: $TARGET.gz ($(du -h "$TARGET.gz" | cut -f1))"

# Ротация: оставляем KEEP самых свежих
ls -1t "$BACKUP_DIR"/logs-*.db.gz 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f "$old"
  echo "Удалён старый бэкап: $old"
done
