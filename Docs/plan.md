# План активного захода: выпуск в production (пилот)

**Цель:** запустить `@VibeCodingFAQBot` и админку в prod-режиме для двух пользователей (владелец + преподаватель) на **VPS Hostkey** (`82.21.92.121`), доступ к админке — **через домен + nginx + HTTPS**.

**Контекст:**
- Dev и prod могут работать на **одном VPS** на этапе пилота, но используют **независимые ресурсы**: отдельные `.env.*.local`, отдельные SQLite (`logs-dev.db` / `logs-prod.db`) и отдельные коллекции Qdrant (`qna_dev` / `qna_prod`). Один Qdrant-инстанс (Docker), разные коллекции.
- Сейчас работает **dev** (`APP_ENV=development`, `npm run dev:server`), данные в legacy `logs.db` → при миграции копируем в `logs-prod.db`.
- Prod-секреты готовы (`.env.production.local`, права 600).
- Бэкап cron настроен (03:00 UTC); off-site S3 — **не блокер пилота**, но локальный бэкап не спасает от потери VPS (backlog P1.5).
- **Инфраструктура:**
  - **Timeweb Cloud** — только домен и DNS (`catandsnake.ru`), серверов нет.
  - **Hostkey** — два арендованных VPS:
    - `82.21.92.121` — **этот сервер**, здесь QnABot;
    - `82.22.3.63` — другой сервер (`n8n.catandsnake.ru`), не трогаем.
- **Поддомен админки:** `qnabot.catandsnake.ru` → A-запись в Timeweb DNS → `82.21.92.121`.

**Внешнее ревью (ChatGPT, 2026-07-05):** 8.5/10 — пилот можно выпускать после блокеров ниже. Согласовано.

---

## Шаг 0. Блокеры (до prod-запуска)

> Без этого шага prod не включаем.

### 0.1 Разделить SQLite dev / prod ✅ (2026-07-07)

- [x] `DATABASE_PATH` — единственный источник пути; обязательна в `validateEnv()`.
- [x] `src/db/index.ts`, `drizzle.config.ts` (+ `loadEnv`), `scripts/backup.sh`, `preload-env.ts` (+ validate до импорта `@/db`).
- [x] `data/`, `.gitignore`, примеры `.env.*.example`, обновлены `.env.development.local` / `.env.production.local`.
- [x] Миграция: `logs.db` → `data/logs-prod.db`, legacy `logs.db.legacy`.
- [x] Лог при старте: `[server] database: …`
- [x] **Smoke-тест изоляции** — `DEV TEST` только в `logs-dev.db`, в prod нет (2026-07-07).

**Критерий:** dev → `data/logs-dev.db`, prod → `data/logs-prod.db`; записи не пересекаются.

### 0.2 Закрепить версию Qdrant + разделить коллекции ✅ (2026-07-07)

- [x] `docker-compose.yml`: `qdrant/qdrant:v1.18.0` (совпадает с текущим running).
- [x] `QDRANT_COLLECTION` в env (`qna_dev` / `qna_prod` / `qna_staging`), обязательна в `validateEnv()`.
- [x] `src/lib/qdrant/client.ts` — без хардкода `"qna"`.
- [x] Лог при старте: `[server] qdrant collection: …`
- [x] Prod reindex в `qna_prod` (см. ниже).

**Миграция:** старая коллекция `qna` в Qdrant остаётся сиротой — можно удалить вручную после проверки `qna_prod`.

**Критерий:** dev reindex → `qna_dev`, prod reindex → `qna_prod`; коллекции не пересекаются.

### 0.3 Restore drill (prod-база) ✅ (2026-07-07)

- [x] Тестовые пары в `data/logs-prod.db` → `scripts/backup.sh` → архив + `.sha256`.
- [x] Удаление БД → `gunzip` restore → `integrity_check` OK → `sha256sum -c` OK.
- [x] `APP_ENV=production npm run qdrant:reindex` → 2/2 в `qna_prod`.
- [x] `sha256sum` в `backup.sh` (из 0.1).

**Критерий:** restore → reindex → данные на месте — **пройден**.

---

## Шаг 1. Pre-flight (перед остановкой dev) ✅ (2026-07-07)

- [x] `docker compose ps` — Qdrant up (контейнер `qnabotai-qdrant-1`, Up 5 weeks).
- [x] `npm run build` — сборка без ошибок (Next.js 16.2.10).
- [x] `npm audit` — нет critical/high (8 moderate, dev-зависимости).
- [x] Проверка prod-env (`validateEnv`) — все 7 обязательных переменных на месте.
- [x] В `logs-prod.db` есть нужные `active`-записи — 2 FAQ (Пушкин / Сталин) из dev; `qna_prod` reindex 2/2.
- [x] На prod-сервере деплой: **`npm ci`**, не `npm install`.

**Критерий:** build зелёный, env валиден, prod-БД готова — **пройден**.

---

## Шаг 2. DNS: поддомен → Hostkey VPS ✅ (2026-07-08)

- [x] В панели **Timeweb Cloud → DNS**: **A-запись** `qnabot` → **`82.21.92.121`**.
- [x] Apex, www и `n8n` **не менять**.
- [x] Propagation: `qnabot.catandsnake.ru` → `82.21.92.121`.

**Критерий:** `qnabot.catandsnake.ru` → `82.21.92.121` — **пройден**.

---

## Шаг 3. Первый запуск production + systemd ✅ (2026-07-08)

- [x] Остановить dev-процесс (вчера вручную; сейчас живых `dev`-процессов нет).
- [x] `npm start` — приложение на `127.0.0.1:3000`.
- [x] **systemd unit** `qnabotai.service`:
  - `Environment=NODE_ENV=production`, `Environment=APP_ENV=production`
  - `Restart=always`, `RestartSec=5`, `StartLimitBurst=5`, `StartLimitIntervalSec=60`
  - `NoNewPrivileges=yes`, `PrivateTmp=yes`
- [x] `systemctl enable --now qnabotai`
- [x] Проверка после рестарта:
  ```
  systemctl restart qnabotai
  systemctl status qnabotai
  journalctl -u qnabotai -n 50
  ```

**Критерий:** `curl http://127.0.0.1:3000/admin/login` → 200/redirect; сервис переживает restart — **пройден**.

---

## Шаг 4. nginx + HTTPS (Let's Encrypt)

- [ ] nginx + certbot.
- [ ] Virtual host `qnabot.catandsnake.ru` → `proxy_pass http://127.0.0.1:3000`.
- [ ] Заголовки: `X-Forwarded-For`, `X-Forwarded-Proto`.
- [ ] Certbot: `certbot --nginx -d qnabot.catandsnake.ru`.
- [ ] Firewall: 80/443 открыты, **3000 закрыт снаружи**.
- [ ] Проверка:
  ```
  curl http://127.0.0.1:3000/admin/login
  curl https://qnabot.catandsnake.ru/admin/login
  sudo certbot renew --dry-run
  ```

**Критерий:** HTTPS работает, renew dry-run OK, сессия админки жива.

---

## Шаг 5. Smoke-тест (владелец)

| # | Проверка | Ожидание |
|---|---|---|
| 1 | Prod-бот `@VibeCodingFAQBot`, известный вопрос | Ответ из базы |
| 2 | Вопрос без ответа | «Не нашёл» + кнопка |
| 3 | `https://qnabot.catandsnake.ru/admin/login` | Redirect на `/admin/qna` |
| 4 | Правка FAQ | Toast успех |
| 5 | `/admin/log` | Обращения видны |
| 6 | Rate limit (4+ вопроса/мин) | Сообщение о лимите |

**Критерий:** все 6 OK → закрыть backlog «Первый реальный запуск production».

---

## Шаг 6. Доступ преподавателя

- [ ] URL: `https://qnabot.catandsnake.ru/admin/qna`.
- [ ] Prod-пароль — защищённый канал.
- [ ] Мини-инструкция по админке.

**Критерий:** преподаватель сам зашёл и отредактировал запись.

---

## Шаг 7. Эксплуатация (первые 2 недели)

- [ ] Раз в неделю — `/admin/log` (verdict=`error`).
- [ ] `npm audit` при обновлении зависимостей.
- [ ] Off-site бэкап Timeweb S3 (backlog P1.5).
- [ ] Runbook в README: `git pull` → `npm ci` → `npm run build` → `systemctl restart qnabotai`.

---

## Желательно (не блокер пилота)

- `/healthz` endpoint
- logrotate для `journalctl` / app logs
- systemd hardening (если не сделано в шаге 3)

## После пилота

- Timeweb S3 off-site, отдельный VPS, CI/CD, multi-admin, compiled server (без tsx)

---

## Порядок работы в чате

Двигаемся **по одному шагу**. Сейчас: **шаг 4** (nginx + HTTPS).
