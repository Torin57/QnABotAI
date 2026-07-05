# План активного захода: выпуск в production (пилот)

**Цель:** запустить `@VibeCodingFAQBot` и админку в prod-режиме для двух пользователей (владелец + преподаватель) на **VPS Hostkey** (`82.21.92.121`), доступ к админке — **через домен + nginx + HTTPS**.

**Контекст:**
- Dev и prod — **одна машина**, одна `logs.db`, один Qdrant (`qdrant_storage/`).
- Сейчас работает **dev** (`APP_ENV=development`, `npm run dev:server`).
- Prod-секреты готовы (`.env.production.local`, права 600).
- Бэкап cron настроен (03:00 UTC); off-site — в backlog, не блокер первого запуска.
- **Инфраструктура:**
  - **Timeweb Cloud** — только домен и DNS (`catandsnake.ru`), серверов нет.
  - **Hostkey** — два арендованных VPS:
    - `82.21.92.121` — **этот сервер**, здесь QnABot;
    - `82.22.3.63` — другой сервер (`n8n.catandsnake.ru`), не трогаем.
- **Поддомен админки:** `qnabot.catandsnake.ru` → A-запись в Timeweb DNS → `82.21.92.121`. nginx на QnABot-сервере ставим с нуля.

---

## Шаг 1. Pre-flight (перед остановкой dev)

- [ ] `docker compose ps` — Qdrant up.
- [ ] `npm run build` — сборка без ошибок.
- [ ] Проверка prod-env (`validateEnv` через preload) — все 5 обязательных переменных на месте.
- [ ] Зафиксировать: **dev останавливаем**, prod занимает порт 3000 (localhost only после nginx).
- [ ] Убедиться, что в `logs.db` есть нужные `active`-записи (это станет prod-базой знаний).

**Критерий:** build зелёный, env валиден, Qdrant жив.

---

## Шаг 2. DNS: поддомен → Hostkey VPS

- [ ] В панели **Timeweb Cloud → DNS**: **A-запись** `qnabot` → **`82.21.92.121`** (Hostkey VPS с QnABot).
- [ ] Apex, www и `n8n` **не менять**.
- [ ] Дождаться propagation (`dig +short qnabot.catandsnake.ru` → `82.21.92.121`).

**Критерий:** поддомен резолвится в IP Hostkey VPS с QnABot.

---

## Шаг 3. Первый запуск production + systemd

- [ ] Остановить dev-процесс (`server.ts` с `APP_ENV=development`).
- [ ] `npm start` — приложение слушает `127.0.0.1:3000` (или `0.0.0.0:3000`, nginx всё равно проксирует).
- [ ] Создать **systemd unit** `qnabotai.service` (WorkingDirectory, User=ubuntu, Restart=always).
- [ ] `systemctl enable --now qnabotai`, проверить логи: бот подключился, Next.js ready.

**Критерий:** `curl http://127.0.0.1:3000/admin/login` → 200/redirect, процесс стабилен.

---

## Шаг 4. nginx + HTTPS (Let's Encrypt)

- [ ] Установить nginx + certbot (если ещё нет).
- [ ] Virtual host: `<поддомен>` → `proxy_pass http://127.0.0.1:3000`.
- [ ] Заголовки: `X-Forwarded-For`, `X-Forwarded-Proto` (rate limit логина берёт IP из `x-forwarded-for`).
- [ ] Certbot: `certbot --nginx -d <поддомен>` → авто-renew.
- [ ] Firewall: открыть 80/443, **закрыть прямой доступ к 3000** снаружи (опционально, но желательно).
- [ ] Cookie `secure` — проверить, что сессия работает по HTTPS (httpOnly cookie без Secure ok, но HTTPS уже есть).

**Критерий:** `https://<поддомен>/admin/login` открывается, сертификат валиден.

---

## Шаг 5. Smoke-тест (владелец)

| # | Проверка | Ожидание |
|---|---|---|
| 1 | Написать prod-боту `@VibeCodingFAQBot` известный вопрос | Ответ из базы знаний |
| 2 | Написать вопрос без ответа | «Не нашёл» + кнопка преподавателя |
| 3 | `https://<поддомен>/admin/login`, prod-пароль | Redirect на `/admin/qna` |
| 4 | Правка одной записи FAQ | Toast успех |
| 5 | `/admin/log` | Обращения видны |
| 6 | Rate limit бота (4+ вопроса/мин) | Сообщение о лимите |

**Критерий:** все 6 OK → закрыть backlog «Первый реальный запуск production».

---

## Шаг 6. Доступ преподавателя

- [ ] Передать URL: `https://<поддомен>/admin/qna`.
- [ ] Prod-пароль — по защищённому каналу (не в чат с ботом).
- [ ] Мини-инструкция: «База знаний» / «Журнал», добавление пары, неотвеченные.
- [ ] Принятый риск: один пароль на двоих (`threat-model.md`).

**Критерий:** преподаватель сам зашёл и отредактировал запись.

---

## Шаг 7. Эксплуатация (первые 2 недели)

- [ ] Раз в неделю — `/admin/log` (verdict=`error`).
- [ ] `npm audit` при обновлении зависимостей.
- [ ] Off-site бэкап Timeweb S3 — параллельно (backlog P1.5).
- [ ] Runbook деплоя в README: `git pull` → `npm install` → `npm run build` → `systemctl restart qnabotai`.

**Критерий:** runbook записан, certbot renew проверен (`certbot renew --dry-run`).

---

## Не входит в этот заход

- Перенос apex-домена или смена DNS-провайдера.
- Разделение `logs.db` по окружениям (P3); dev после prod **не запускать параллельно**.
- Multi-tenant, отдельные учётки (P2).
- Threat model для SaaS (P2).

---

## Порядок работы в чате

Двигаемся **по одному шагу**: согласовали → выполнили → проверили → следующий.

**Ожидает от владельца:** A-запись `qnabot.catandsnake.ru` → `82.21.92.121` (шаг 2; можно параллельно с шагом 1).
