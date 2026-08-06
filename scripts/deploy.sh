#!/usr/bin/env bash
#
# Деплой production. Запускать в прод-папке (~/workspace/QnABotAI).
# Использование: scripts/deploy.sh [-y]
#   -y, --yes   не спрашивать подтверждение (для неинтерактивного запуска)
#
# Автоматизирует порядок из Docs/spec.md §7.4. Скрипт всегда работает с тем
# репозиторием, в котором лежит сам, — текущий каталог не влияет. Разработка
# идёт в ~/workspace/QnABotAI-dev на ветке dev; сюда код попадает только через
# merge PR в main на GitHub.
#
# Сервис останавливается ДО обновления кода: иначе между merge и миграциями на
# диске лежит новый код при старой схеме, и автоперезапуск юнита поднимет его
# на неготовой базе (см. §7.4). Поэтому деплой = короткий простой бота.

set -euo pipefail

cd "$(dirname "$0")/.."

SERVICE="qnabotai"
PORT="${PORT:-3000}"
HEALTH_TIMEOUT=30

ASSUME_YES=0
case "${1:-}" in
  -y | --yes) ASSUME_YES=1 ;;
  "") ;;
  *) echo "Неизвестный аргумент: $1 (ожидается -y или --yes)" >&2; exit 2 ;;
esac

fail() { echo "Ошибка: $*" >&2; exit 1; }
step() { printf '\n=== %s\n' "$*"; }

# --- Проверки до любых изменений -------------------------------------------

# .env.production.local есть только в прод-папке — по нему и отличаем её от dev.
[ -f .env.production.local ] ||
  fail "нет .env.production.local — это не прод-папка. Деплой запускают из ~/workspace/QnABotAI"

branch="$(git symbolic-ref --quiet --short HEAD || true)"
[ "$branch" = "main" ] ||
  fail "текущая ветка «${branch:-detached HEAD}», а деплоим только с main"

git diff --quiet && git diff --cached --quiet ||
  fail "в прод-копии есть незакоммиченные изменения — правки вносят в dev-папке, а не здесь"

step "Забираю main с GitHub"
git fetch origin main
current="$(git rev-parse HEAD)"
target="$(git rev-parse FETCH_HEAD)"

if [ "$current" = "$target" ]; then
  echo "Прод уже на последнем коммите: $(git log -1 --format='%h %s')"
  echo "Деплоить нечего."
  exit 0
fi

git merge-base --is-ancestor "$current" "$target" ||
  fail "main на GitHub не является продолжением текущего коммита — нужен ручной разбор"

echo
echo "Будет развёрнуто коммитов: $(git rev-list --count "$current".."$target")"
git log --oneline --no-decorate "$current".."$target"
echo
echo "На время деплоя бот и админка будут недоступны."

if [ "$ASSUME_YES" -eq 0 ]; then
  read -r -p "Продолжить? [y/N] " answer
  case "$answer" in
    [yY] | [yY][eE][sS]) ;;
    *) echo "Отменено."; exit 0 ;;
  esac
fi

# Пока сервис остановлен, любой выход из скрипта должен объяснять, как чинить.
service_stopped=0
on_exit() {
  [ "$service_stopped" -eq 1 ] || return 0
  echo >&2
  echo "!!! Деплой прерван, сервис $SERVICE остановлен." >&2
  echo "    Поднять как есть:  sudo systemctl start $SERVICE" >&2
  echo "    Откатить код:      git reset --hard $current  (миграции не откатываются," >&2
  echo "                       база — из backups/, см. Docs/spec.md §7.3)" >&2
}
trap on_exit EXIT

# --- Собственно деплой ------------------------------------------------------

step "Останавливаю $SERVICE"
sudo systemctl stop "$SERVICE"
service_stopped=1

step "Бэкап прод-базы (до миграций)"
scripts/backup.sh

step "Перевожу прод-копию на $(git rev-parse --short "$target")"
git merge --ff-only "$target"

step "Обновляю локальные предохранители"
if cmp -s scripts/prod-post-checkout.sh .git/hooks/post-checkout; then
  echo "Хук post-checkout уже актуален"
else
  install -m 755 scripts/prod-post-checkout.sh .git/hooks/post-checkout
  echo "Установлен .git/hooks/post-checkout"
fi

step "Зависимости"
npm ci

step "Миграции БД"
APP_ENV=production npm run db:migrate

step "Сборка"
npm run build

step "Запускаю $SERVICE"
sudo systemctl start "$SERVICE"
service_stopped=0

# --- Проверка ---------------------------------------------------------------

step "Проверка"
deadline=$((SECONDS + HEALTH_TIMEOUT))
login_code=""
while [ "$SECONDS" -lt "$deadline" ]; do
  systemctl is-active --quiet "$SERVICE" ||
    fail "сервис не запустился. Смотреть: journalctl -u $SERVICE -n 50"
  login_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PORT/admin/login" || true)"
  [ "$login_code" = "200" ] && break
  sleep 2
done

[ "$login_code" = "200" ] ||
  fail "/admin/login отвечает «${login_code:-нет ответа}» вместо 200 за ${HEALTH_TIMEOUT}s. Смотреть: journalctl -u $SERVICE -n 50"

# Роуты из §7.4: корень редиректит на админку, API без сессии закрыт.
check_route() {
  local path="$1" expected="$2" actual
  actual="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PORT$path" || true)"
  if [ "$actual" = "$expected" ]; then
    echo "  $path → $actual"
  else
    echo "  $path → $actual (ожидалось $expected)" >&2
    return 1
  fi
}

routes_ok=0
check_route /admin/login 200 || routes_ok=1
check_route / 307 || routes_ok=1
check_route /api/qna 401 || routes_ok=1

[ "$routes_ok" -eq 0 ] ||
  fail "проверка роутов не прошла — сервис поднят, но ведёт себя неожиданно. Смотреть: journalctl -u $SERVICE -n 50"

echo
echo "Готово: $(git log -1 --format='%h %s')"
echo "Дальше — ручная проверка админки и бота (Docs/spec.md §7.4)."
