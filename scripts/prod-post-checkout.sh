#!/usr/bin/env bash
#
# Источник git-хука post-checkout для прод-папки.
# Устанавливается в .git/hooks/post-checkout скриптом scripts/deploy.sh
# (сами хуки не версионируются, поэтому держим их текст здесь).
#
# Зачем: 2026-08-06 прод-копию молча переключило с main на июльский dev.
# Сервис это пережил (отдаёт готовую сборку из .next), но перезапуск в таком
# состоянии поднял бы бота на старом коде против уже мигрированной базы.

branch_checkout=$3
[ "$branch_checkout" = "1" ] || exit 0

branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null)
[ "$branch" = "main" ] && exit 0

if [ -t 2 ]; then
	red=$(printf '\033[1;31m'); reset=$(printf '\033[0m')
else
	red=''; reset=''
fi

target=${branch:-"detached HEAD ($(git rev-parse --short HEAD))"}

cat >&2 <<EOF

${red}!!! ПРОД-ПАПКА УШЛА С main !!!${reset}
    $(pwd)
    сейчас: ${target}

    Прямо сейчас ничего не сломалось: сервис qnabotai отдаёт готовую сборку
    из .next, а код бота уже загружен в память. Но перезапуск сервиса в этом
    состоянии поднимет бота на коде этой ветки против прод-базы.

    Вернуть:      git checkout main
    Разработка:   ~/workspace/QnABotAI-dev

EOF
