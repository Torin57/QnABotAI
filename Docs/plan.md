# План разработки семантического FAQ-бота

- [ ] **Шаг 1:** Инициализировать проект `npx create-next-app@latest` (с TypeScript, Tailwind, App Router) и установить зависимости (drizzle-orm, drizzle-kit, sqlite3, @qdrant/js-client-rest, @mistralai/mistralai, grammy или telegraf, dotenv).
-[ ] **Шаг 2:** Настроить схему SQLite через Drizzle ORM (таблица `unanswered_queries`) и сгенерировать первую миграцию.
- [ ] **Шаг 3:** Разработать модуль работы с Qdrant и Mistral API (написать скрипт загрузки тестового `faq.json` в локальную векторную базу).
- [ ] **Шаг 4:** Написать логику Telegram-бота на JS/TS (прием сообщений, векторизация через Mistral, семантический поиск в Qdrant, сохранение неотвеченных в SQLite).
- [ ] **Шаг 5:** Настроить параллельный запуск Telegram-бота внутри Next.js (например, через кастомный server.ts или API Routes).
- [ ] **Шаг 6:** Создать страницу веб-админки в Next.js (Серверные компоненты) для красивого вывода данных из таблицы `unanswered_queries` через Drizzle.