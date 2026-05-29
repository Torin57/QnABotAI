# План рефакторинга: переименование `faq` → `qna`

## Контекст

После переименования папки проекта `faqbotai` → `QnABotAI` мы решили **сделать всё однообразно** на уровне кода и данных:
доменный термин `faq` (как идентификатор/название коллекции/таблицы/роута/UI-надписи) заменяем на `qna`,
а имя бренда `FAQBotAI` → `QnABotAI`. БД (SQLite `logs.db` + коллекция Qdrant `faq`) **перезаливаем с нуля**.

Термин `qna` выбран как короткий, соответствующий имени проекта `QnABotAI`.

## Не трогаем (важно)

- Слово `FAQ` как **естественный язык** в пользовательских текстах, описывающих смысл бота
  (например, «семантический FAQ-бот без галлюцинаций» в README) — оставляем. FAQ — общеизвестный термин, и заменять его на «QnA» в живом тексте не нужно.
- Имя `unanswered_queries` и связанные роуты `/api/unanswered/*` — не затронуты, к `faq` отношения не имеют.

## Шаги

### 1. Категория B — Qdrant коллекция
- `src/lib/qdrant/client.ts`: `COLLECTION = "faq"` → `COLLECTION = "qna"`.
- Старая коллекция `faq` в Qdrant становится мусором; либо удалить вручную, либо игнорировать (на работу не влияет).

### 2. Категория C — SQLite schema + Drizzle миграции
- `src/db/schema.ts`: экспорт `faqItems` → `qnaItems`; имя таблицы `"faq_items"` → `"qna_items"`.
- Удалить весь каталог `src/db/migrations/` (две миграции `0000`/`0001`, снапшоты и `_journal.json`).
- Удалить `logs.db` (раз перезаливаем).
- Перегенерировать миграции через `drizzle-kit generate` (одной новой `0000_*.sql`).

### 3. Категория A — идентификаторы / UI / логи (массовый rename)
TypeScript-идентификаторы:
- `faqItems` → `qnaItems` (импорты во всех файлах)
- `FaqItem` → `QnaItem`
- `FaqPage` → `QnaPage`
- `exportFaqToExcel` → `exportQnaToExcel`
- `upsertFaqItem` → `upsertQnaItem`
- `deleteFaqItem` → `deleteQnaItem`
- `searchFaq` → `searchQna`

UI и логи (видимые тексты в коде):
- `FAQ Bot Admin` → `QnA Bot Admin`
- `🤖 FAQ Bot AI` → `🤖 QnA Bot AI`
- `FAQ Bot Admin Panel` → `QnA Bot Admin Panel`
- `Модерация и публикация вопросов FAQ` → `Модерация и публикация вопросов QnA`
- Excel worksheet `"FAQ"` → `"QnA"`
- Имя файла экспорта `faq-${Date.now()}.xlsx` → `qna-${Date.now()}.xlsx`
- Префикс логов `[FAQ]` → `[QnA]`, `searching FAQ...` → `searching QnA...`, `FAQ items` → `QnA items`
- В `JUDGE_PROMPT` упоминание «из FAQ» → «из базы знаний» (нейтральнее)

### 4. Категория D — Next.js routes (file-system based)
- Перенос: `src/app/api/faq/` → `src/app/api/qna/` (вместе со всеми подпапками и файлами).
- Перенос: `src/app/admin/faq/` → `src/app/admin/qna/`.
- В `src/app/admin/page.tsx`: `redirect("/admin/faq")` → `redirect("/admin/qna")`.
- В `src/app/admin/qna/page.tsx` все `fetch("/api/faq...")` → `fetch("/api/qna...")`.

### 5. Верификация
- `docker compose ps` — Qdrant должен быть жив (с уже починенным port-mapping).
- `npm run dev:server` — стартует без ошибок, проходит `[bot] ensuring Qdrant collection...` (создаст новую пустую коллекцию `qna`), доходит до `[bot] started` (если есть `TG_BOT_TOKEN`).
- Открыть `http://127.0.0.1:3000/admin/qna` через `npm run dev` — должна загрузиться страница админки.

## Откат (на случай чего)

- Изменения в репо легко откатить через `git checkout -- .` и `git clean -fd src/db/migrations/` (если git-чистый стейт).
- БД `logs.db` пересоздастся миграцией; коллекция `qna` в Qdrant пересоздастся `ensureCollection()`.
- Старая коллекция `faq` в Qdrant остаётся жива до явного удаления — на случай возврата.

## Прогресс

- [x] Согласованы термин (`qna`) и объём (A+B+C+D)
- [x] Шаг 1: Qdrant collection — `COLLECTION = "qna"` в `client.ts`; старая `faq` удалена через REST API
- [x] Шаг 2: Drizzle schema + reset миграций — `schema.ts` обновлён, `logs.db` пересоздан, новая миграция `0000_safe_magdalene.sql` сгенерирована drizzle-kit
- [x] Шаг 3: rename идентификаторов / UI / логов — все идентификаторы `Faq*` → `Qna*`, UI-надписи и логи обновлены
- [x] Шаг 4: перенос Next.js папок — `src/app/api/faq/` → `src/app/api/qna/`, `src/app/admin/faq/` → `src/app/admin/qna/`
- [x] Шаг 5: верификация запуска — `npm run dev:server` под Node 24: `[bot] ensuring Qdrant collection... / creating bot instance... / starting polling... / started`, `[server] ready on http://localhost:3000`
- [x] Бонус: документация подровнена — `Docs/spec.md` и `README.md` ссылаются на `qna_items`/`/admin/qna`

---

# План: единая таблица QnA + анонимность (unified lifecycle)

## Контекст и решение

Сейчас неотвеченные вопросы лежат в отдельной таблице `unanswered_queries`, а FAQ — в `qna_items`. В админке это две вкладки. По факту это **одна сущность** в разных состояниях жизненного цикла.

Решение (согласовано с заказчиком): **не объединять, а упростить** — удалить таблицу `unanswered_queries` целиком (в ней 1 запись, история не важна) и вести всё в `qna_items`. Бот пишет неотвеченный вопрос напрямую в `qna_items`. Telegram `userId` больше не сохраняем — **бот анонимный (must have)**.

Целевой lifecycle одной записи: `unanswered → active → deleted`. Статус `pending` **выпиливаем в этом же заходе** (из схемы, бэйджей, фильтров и кнопки «Опубликовать»).

## Целевая модель

- `qna_items.status`: `unanswered | active | deleted` (статус `pending` удалён).
- Неотвеченный вопрос = строка с `status = "unanswered"`, `answer` пустой, `sourceDocument` пустой/нейтральный.
- Таблицы `unanswered_queries` нет. `userId` нигде не хранится и не отображается.
- `/admin/qna` — один список + фильтр по статусу (All / Unanswered / Active / Deleted), без вкладок.

## Шаги

### 1. Схема БД (`src/db/schema.ts` + миграции)
- `status` enum: добавить `"unanswered"`, удалить `"pending"`. Итог: `unanswered | active | deleted`.
- `answer`: разрешить пустое/NULL (сейчас `NOT NULL`).
- `sourceDocument`: разрешить пустое/NULL или дефолт (сейчас `NOT NULL`).
- Удалить таблицу `unanswered_queries`.
- Перегенерировать миграции (или пересоздать `logs.db`, как и при rename).

### 2. Бот (`src/bot/index.ts`)
- `logUnanswered(...)` пишет в `qna_items` (`status="unanswered"`, `answer=""`, без `userId`), а не в `unanswered_queries`.

### 3. API
- Удалить `src/app/api/unanswered/route.ts` и `src/app/api/unanswered/export/route.ts`.
- `GET /api/qna`: параметризовать фильтр по статусу (сейчас хардкод `status != deleted`) — поддержать All/Unanswered/Active/Deleted.
- Проверить `upload`/`export`/`publish` на консистентность статусов.

### 4. UI (`src/app/admin/qna/page.tsx`)
- Убрать вкладки (`tab` state, `<nav role=tablist>`), оставить один список.
- Над списком — фильтр по статусу.
- Колонка «Пользователь» (`userId`) удаляется (анонимность).
- Пересмотреть состав колонок единого списка (вопрос/ответ/статус/источник/дата/действия), чтобы неотвеченные органично жили в общей таблице.

### 5. Excel-экспорт (`src/lib/parser/excel.ts`)
- Убрать колонку `user_id` из выгрузки неотвеченных (анонимность). Свести экспорт к единому формату qna.

### 6. Документация
- `Docs/spec.md`, `README.md`: описать единый список + lifecycle, убрать упоминания отдельной таблицы/вкладки/userId.

## Связь с backlog
- Это UI-половина задачи P2 «unified lifecycle `unanswered → active → deleted`». Делать совместно, чтобы не плодить временные решения.
- Анонимность («убрать колонку Пользователь») может уйти как часть этого же изменения — отдельный быстрый PR больше не нужен, т.к. таблица всё равно удаляется.

## Открытые вопросы / следствия
- Расхождение spec vs код: upload сейчас создаёт `active`, а не `pending` (`src/lib/parser/index.ts:38`). После удаления `pending` это становится корректным поведением (upload → сразу `active`); кнопка «Опубликовать» удаляется.
- Восстановление из корзины (`deleted` → `active` + reindex) — отдельная поздняя задача в P2, не входит в текущий заход. Но фильтр Deleted, который мы добавляем сейчас, — предпосылка для неё.

## Прогресс
- [x] Согласована модель: удаляем `unanswered_queries`, всё в `qna_items`, бот анонимный
- [x] Шаг 1: схема + миграции — `qna_items` (status `unanswered|active|deleted`, default `unanswered`, `answer`/`source_document` nullable), таблица `unanswered_queries` удалена, миграции пересозданы (`0000_medical_morlocks.sql`), `logs.db` пересоздаётся при старте
- [x] Шаг 2: бот пишет неотвеченный вопрос в `qna_items` (`status="unanswered"`, без `userId`)
- [x] Шаг 3: API — удалены `/api/unanswered/*`, в `GET /api/qna` добавлен фильтр `?status=all|unanswered|active|deleted`
- [x] Шаг 4: UI — единый список с фильтром по статусу, вкладки убраны, колонка «Пользователь» удалена
- [x] Шаг 5: Excel — удалён `exportUnansweredToExcel` (с `user_id`), остался единый `exportQnaToExcel`
- [x] Шаг 6: документация — `Docs/spec.md` и `README.md` обновлены под единый список и анонимность
- [x] Проверка: `tsc --noEmit` и линтер — без ошибок
