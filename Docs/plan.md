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
