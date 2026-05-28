# QnABotAI — семантический FAQ-бот без галлюцинаций

[![Stack](https://img.shields.io/badge/stack-Next.js%20%7C%20grammY%20%7C%20Qdrant-000?style=flat&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![DB](https://img.shields.io/badge/SQLite-Drizzle-003B57?style=flat)](https://orm.drizzle.team/)

> Telegram-бот и веб-админка на **Next.js** + **TypeScript**: понимает «живые» формулировки вопросов, но отвечает **только заранее утверждённым текстом** из базы знаний.

---

## Почему этот проект 🤔

На рынке часто сталкиваются с двумя крайностями:

| Подход | Проблема |
|--------|----------|
| «Умный» чисто LLM-бот | Понимает всё, но **может выдумывать** и вести себя непредсказуемо |
| Классический бот-калькулятор | **Жёсткие совпадения** — не понимает перефраз и опечатки |

**Золотая середина:** векторный поиск по FAQ + лёгкая LLM в роли **«судьи»**, которая выбирает **один** подходящий пункт из кандидатов или честно говорит, что ответа нет. Пользователь получает **детерминированный** ответ из вашей базы, а не сгенерированный «с нуля».

---

## Возможности ✨

- **Гибридный ответ:** эмбеддинги (`mistral-embed`) + топ кандидатов из **Qdrant** + выбор ID через **`mistral-small-latest`**.
- **Админка:** загрузка Excel (готовые Q/A), PDF/DOCX (извлечение пар через LLM), ревью, публикация в Qdrant, выгрузки в Excel.
- **Учёт пробелов:** вопросы без подходящего FAQ попадают в **`unanswered_queries`** и отображаются в админке.
- **Единый стек:** бот (**grammY**), API и UI — в одном репозитории на Node.js.

Подробная логика и схемы БД — в [`Docs/spec.md`](Docs/spec.md).

---

## Стек 🛠️

| Слой | Технологии |
|------|------------|
| Бот | [grammY](https://grammy.dev/), Node.js |
| Приложение | [Next.js](https://nextjs.org/) (App Router), React, Tailwind CSS |
| Данные | SQLite + [Drizzle ORM](https://orm.drizzle.team/) (`logs.db` в корне) |
| Векторы | [Qdrant](https://qdrant.tech/) (Docker, volume `./qdrant_storage`) |
| AI | Mistral API (`mistral-embed`, `mistral-small-latest`) |
| Документы | `pdf-parse`, `mammoth`, `exceljs` |

---

## Требования 📋

| Компонент | Минимум |
|-----------|---------|
| **Node.js** | **20 LTS** или новее (рекомендуется актуальный LTS под Next.js 16) |
| **npm** | поставляется с Node.js |
| **Docker** | Docker Engine + **Docker Compose** v2 (или Docker Desktop с Compose) — для Qdrant |

Опционально: переменные **`QDRANT_HOST`** / **`QDRANT_PORT`**, если Qdrant не на `localhost:6333`.

---

## Структура репозитория 📂

```
├── server.ts              # Единая точка входа: Telegram-бот + HTTP-сервер Next.js
├── docker-compose.yml     # Сервис Qdrant + volume в ./qdrant_storage
├── drizzle.config.ts      # Конфиг Drizzle Kit (SQLite → ./logs.db)
├── package.json
├── src/
│   ├── app/               # Страницы и API-роуты админки (Next.js)
│   ├── bot/               # Логика Telegram-бота
│   ├── db/                # Схема, миграции, подключение к SQLite
│   └── lib/               # Qdrant, Mistral, парсеры файлов
├── Docs/
│   └── spec.md            # Спецификация (SDD)
└── logs.db                # SQLite (создаётся при работе; не коммитить)
```

Маршруты админки из спецификации: **`/admin/faq`**, **`/admin/unanswered`**.

---

## Установка и запуск (пошагово) 🚀

### 1. Клонирование

```bash
git clone <URL-вашего-репозитория> QnABotAI
cd QnABotAI
```

### 2. Зависимости Node.js

```bash
npm install
```

### 3. Файл окружения `.env`

В корне создайте файл **`.env`** (он в `.gitignore`). Пример:

```env
# Обязательные
TG_BOT_TOKEN=ваш_токен_от_BotFather
MISTRAL_API_KEY=ваш_ключ_Mistral

# Опционально (по умолчанию Qdrant на localhost:6333)
# QDRANT_HOST=localhost
# QDRANT_PORT=6333

# Порт веб-приложения (по умолчанию 3000)
# PORT=3000
```

- **`TG_BOT_TOKEN`** — токен бота в Telegram ([BotFather](https://t.me/BotFather)).
- **`MISTRAL_API_KEY`** — ключ в [консоли Mistral](https://console.mistral.ai/).

### 4. Qdrant через Docker Compose

Из корня проекта:

```bash
docker compose up -d
```

Проверка: API Qdrant обычно доступен на **http://localhost:6333** (порты **6333** и **6334** проброшены в `docker-compose.yml`). Данные лежат в каталоге **`qdrant_storage/`** (volume).

Остановка при необходимости:

```bash
docker compose down
```

> На старых установках Docker команда может называться `docker-compose` вместо `docker compose`.

### 5. Миграции SQLite (Drizzle)

База **`logs.db`** создаётся/используется в корне; SQL-миграции лежат в **`src/db/migrations/`**.

Применить миграции через Drizzle Kit:

```bash
npm run db:migrate
```

> **Примечание:** при импорте модуля `@/db` в приложении также вызывается программный `migrate()` — для чистого деплоя удобно один раз явно выполнить `npm run db:migrate`, затем запускать сервер.

Если вы меняете схему в коде, генерируйте новые миграции:

```bash
npm run db:generate
```

(затем снова `npm run db:migrate`).

### 6. Запуск Next.js и бота

Проект поднимает **и бота, и Next.js** через **`server.ts`** (см. `npm run dev:server` / `npm start`).

**Режим разработки** (hot reload Next, бот в том же процессе):

```bash
npm run dev:server
```

Откройте админку в браузере: **http://localhost:3000** (или ваш `PORT`).

**Продакшен-сборка:**

```bash
npm run build
npm start
```

> Скрипт **`npm run dev`** запускает только `next dev` **без** Telegram-бота. Для полного сценария «бот + админка» используйте **`dev:server`** или **`start`** после `build`.

---

## Быстрый чеклист перед работой ✅

1. Запущен **Qdrant** (`docker compose ps`).
2. Заполнены **`TG_BOT_TOKEN`** и **`MISTRAL_API_KEY`** в `.env`.
3. Выполнены миграции (**`npm run db:migrate`**).
4. Запущен **`npm run dev:server`** (или `build` + `start`).

---

## Excel для массовой загрузки 📊

Для пути «готовые пары без LLM» в `.xlsx` используйте колонки **`question`** и **`answer`** (см. [`Docs/spec.md`](Docs/spec.md)).

---

## Безопасность (кратко) 🔐

- Секреты только в **`.env`**, не коммитить.
- Ограничения на размер и MIME-типы загрузок — по спецификации в **`Docs/spec.md`** (раздел про безопасность).

---

## Документация 📚

| Файл | Содержание |
|------|------------|
| [`Docs/spec.md`](Docs/spec.md) | SDD: пайплайны, схема БД, UI админки |

---

## Лицензия

См. поле **`license`** в `package.json` (в репозитории указано **ISC**, при необходимости замените на лицензию вашей организации).

---

*Если README чего-то не хватает под ваш деплой (systemd, reverse proxy, HTTPS) — можно дополнить отдельным разделом.*
