#!/usr/bin/env bash
#
# Ежедневный бэкап production SQLite (источник правды: qna_items + bot_log).
# Использование: scripts/backup.sh  (или через cron, см. Docs/spec.md §7.3)
#
# Путь к БД — только из .env.production.local (DATABASE_PATH).
# Qdrant не бэкапим — индекс восстанавливается из SQLite: npm run qdrant:reindex.
# Секреты (.env.*.local) в архив не попадают.
#
# Горячий бэкап через sqlite3 ".backup" — безопасно при работающем боте.
# Храним последние 7 архивов, старые удаляются автоматически.

set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=".env.production.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "Ошибка: $ENV_FILE не найден" >&2
  exit 1
fi

DATABASE_PATH="$(grep -E '^DATABASE_PATH=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r')"
DATABASE_PATH="${DATABASE_PATH#\"}"
DATABASE_PATH="${DATABASE_PATH%\"}"
DATABASE_PATH="${DATABASE_PATH#\'}"
DATABASE_PATH="${DATABASE_PATH%\'}"

if [ -z "$DATABASE_PATH" ]; then
  echo "Ошибка: DATABASE_PATH не задан в $ENV_FILE" >&2
  exit 1
fi

if [ ! -f "$DATABASE_PATH" ]; then
  echo "Ошибка: файл БД не найден: $DATABASE_PATH" >&2
  exit 1
fi

BACKUP_DIR="backups"
KEEP=7
STAMP="$(date +%Y%m%d-%H%M%S)"
BASENAME="$(basename "$DATABASE_PATH" .db)"
TARGET="$BACKUP_DIR/${BASENAME}-$STAMP.db"

mkdir -p "$BACKUP_DIR"

sqlite3 "$DATABASE_PATH" ".backup '$TARGET'"
gzip "$TARGET"
sha256sum "$TARGET.gz" > "$TARGET.gz.sha256"

echo "Бэкап создан: $TARGET.gz ($(du -h "$TARGET.gz" | cut -f1))"
echo "Контрольная сумма: $TARGET.gz.sha256"

# Ротация: оставляем KEEP самых свежих
ls -1t "$BACKUP_DIR"/${BASENAME}-*.db.gz 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f "$old" "${old}.sha256"
  echo "Удалён старый бэкап: $old"
done
