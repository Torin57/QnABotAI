## P1 — Важно сейчас

* [ ] Объединить FAQ и неотвеченные вопросы
* [ ] Добавить создание FAQ вручную
* [ ] Добавить индикатор обработки / индексации
* [ ] Улучшить UX уведомлений
* [ ] Довести redesign до консистентного состояния
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
