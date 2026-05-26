# План разработки семантического FAQ-бота

- [x] **Шаг 1:** Инициализировать проект Next.js (TypeScript, Tailwind, App Router) и установить зависимости (drizzle-orm, drizzle-kit, better-sqlite3, @qdrant/js-client-rest, @mistralai/mistralai, grammy, dotenv, pdf-parse, mammoth).
- [x] **Шаг 2:** Настроить схему SQLite через Drizzle ORM (таблица `unanswered_queries`) и сгенерировать первую миграцию.
- [x] **Шаг 3 (базовая часть):** Расширить схему БД (таблица `faq_items`), разработать модуль парсинга PDF/DOCX + LLM-извлечение Q&A, модуль Qdrant (ensureCollection, upsertFaqItem, searchFaq). Поднять Qdrant через Docker.
- [x] **Шаг 3 (дополнение):** Добавить Excel-парсер в `/src/lib/parser` — импорт `.xlsx` (колонки `question`/`answer`, без LLM) и экспорт FAQ/unanswered в `.xlsx` через `exceljs`. Установить `exceljs`.
- [x] **Шаг 4:** Написать логику Telegram-бота (`/src/bot`): приём сообщений, векторизация через Mistral, семантический поиск в Qdrant, выбор ответа LLM-судьёй, сохранение NULL-вопросов в SQLite.
- [x] **Шаг 5:** Настроить параллельный запуск Telegram-бота внутри Next.js (кастомный `server.ts`).
- [x] **Шаг 6:** Создать веб-админку в Next.js:
  - **`/admin/faq`** — страница управления базой знаний:
    - Загрузка `.xlsx` (Excel-импорт Q&A без LLM).
    - Загрузка `.pdf`/`.docx` (LLM-экстракция Q&A).
    - Кнопка «Выгрузить в Excel» (скачать active-пары).
    - Фильтр периода («с» / «по») по полю `created_at`.
    - Таблица с кнопками на каждой строке: **ОК** (publish → Qdrant), **Отмена** (delete), **Редактировать** (inline/модалка, с обновлением вектора в Qdrant).
  - **`/admin/unanswered`** — страница неотвеченных вопросов:
    - Фильтр периода.
    - Таблица `unanswered_queries`.
    - Кнопка «Выгрузить в Excel».
