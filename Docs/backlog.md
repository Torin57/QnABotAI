## P1 — Важно сейчас

* [ ] Добавить создание FAQ вручную
* [ ] Добавить индикатор обработки / индексации
* [ ] Улучшить UX уведомлений
* [ ] Довести redesign до консистентного состояния
  * [x] Объединить FAQ и неотвеченные вопросы в один canonical route `/admin/qna` (вкладки)
  * [x] Cleanup legacy: удалена `/admin/unanswered` page+route, упоминания в `spec.md`/`README.md` подровнены (API `/api/unanswered` оставлен — используется вкладкой)
  * [x] Упростить UX QnA: вкладки «Основная» / «Неотвеченные вопросы» заменены на единый список с фильтром по статусу (Все / Неотвеченные / Активные / Удалённые). Таблица `unanswered_queries` удалена — всё живёт в `qna_items` (lifecycle `unanswered → active → deleted`)
  * [x] **(анонимность)** Колонка «Пользователь» (Telegram user id) убрана из UI и экспорта; бот больше не сохраняет `userId` (см. `Docs/plan.md`)
* [ ] Добавить bulk actions (checkbox + select all + delete)

---

## P1.5 — Security foundation before public launch

### Core security / trust boundaries

* [ ] Threat modeling для public SaaS режима
* [ ] Продумать trust boundaries и tenant boundaries
* [ ] Secret separation (dev/staging/prod)
* [ ] Отдельный Telegram bot для production

### Upload / file handling security

* [ ] Безопасная обработка upload файлов
* [ ] Ограничения размера файлов
* [ ] Ограничения MIME/type файлов
* [ ] Upload isolation (non-public storage)
* [ ] Валидация Excel / CSV импорта
* [ ] Ограничение количества строк / размера импортов

### Auth / abuse protection

* [ ] Admin panel hardening
* [ ] Добавить авторизацию
* [ ] Rate limiting
* [ ] Basic audit logging

### AI / tooling hygiene

* [ ] Проверить Cursor / AI tooling boundaries
* [ ] Регулярная проверка dependency vulnerabilities
* [ ] Настроить basic backup strategy
* [ ] Проверить production .env hygiene перед релизом

---

## P2 — Важно позже

* [ ] Поддержка картинок
* [ ] Observability / debug panel
* [ ] Улучшение readability / accessibility
* [ ] Спеки и архитектурная документация
* [ ] Добавить soft duplicate detection
* [ ] Подсветка возможных дублей
* [ ] Продумать UX повторной загрузки FAQ
* [ ] Восстановление из корзины: UI-кнопка «Восстановить» для записей со `status="deleted"`. Удаление уже soft-delete (`src/app/api/qna/[id]/route.ts`), данные не теряются. Нужно: API-эндпоинт restore (`status="deleted"` → `active` + повторный `upsertQnaItem` в Qdrant) и кнопка в списке при активном фильтре Deleted. Делать после того, как в текущем redesign появится фильтр по статусу

### Упрощение domain model

* [x] Зафиксировать unified lifecycle: `unanswered → active → deleted` (без `pending`) — сделано в рамках P1 redesign (см. `Docs/plan.md`)
* [x] Удалить статус `pending` из схемы `qna_items` и из UI (фильтры, бэйджи) — сделано; кнопка «Опубликовать» теперь переводит `unanswered → active`
* [x] Обновить `Docs/spec.md` под новый lifecycle — раздел админки, схема БД и логирование обновлены

### Категории / разделы FAQ

* [ ] Продумать систему разделов и подразделов FAQ
* [ ] Добавить поле "Раздел" в админку
* [ ] Поддержать иерархию вида `LLM.Кодинг`
* [ ] Добавить фильтрацию по разделам
* [ ] Добавить dropdown + text search для разделов
* [ ] Продумать свободную систему тегов для преподавателей

---

## P3 — Future / optional

### AI / RAG

* [ ] Настройки чанков и векторизации
* [ ] OpenRouter migration
* [ ] Fallback AI providers
* [ ] Semantic duplicate detection

### Product / platform

* [ ] Landing page
* [ ] Multi-tenant
* [ ] Mobile app

### Data / collaboration

* [ ] Versioning FAQ
* [ ] Conflict resolution
