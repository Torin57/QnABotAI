import { int, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const qnaItems = sqliteTable("qna_items", {
  id: int("id").primaryKey({ autoIncrement: true }),
  question: text("question").notNull(),
  answer: text("answer"),
  sourceDocument: text("source_document"),
  /**
   * Lifecycle: `unanswered` | `not_helpful` | `draft` → `active` → `deleted`.
   * `not_helpful` — ученик нажал «Это не помогло»: ответ был, но не подошёл.
   * `draft` — пара извлечена ИИ из документа и ждёт одобрения преподавателя.
   */
  status: text("status", {
    enum: ["unanswered", "not_helpful", "draft", "active", "deleted"],
  })
    .notNull()
    .default("unanswered"),
  /** Снапшот ответа, который ученик отверг (только для status="not_helpful"). */
  rejectedAnswer: text("rejected_answer"),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Анонимный лог каждого обращения к боту — фундамент для будущей debug-панели (P2). */
export const botLog = sqliteTable("bot_log", {
  id: int("id").primaryKey({ autoIncrement: true }),
  question: text("question").notNull(),
  /** Топ-3 кандидата из Qdrant: [{id, question, score}]. Ответы кандидатов не хранятся — "Судья" их не видит. */
  candidates: text("candidates", { mode: "json" }).$type<
    { id: number; question: string; score: number }[]
  >(),
  /**
   * `answered` / `null` — вердикт «Судьи»;
   * `error` — сбой обработки;
   * `not_helpful` — ученик нажал «Это не помогло» под выданным ответом.
   */
  verdict: text("verdict", {
    enum: ["answered", "null", "error", "not_helpful"],
  }).notNull(),
  answer: text("answer"),
  /** Текст ошибки обработки (только для verdict="error"), без stack trace. */
  error: text("error"),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Загруженные учебные материалы (транскрипты, конспекты) — источник для
 * генерации черновиков ответов (RAG). Хранится метаданные; текст — в `doc_chunks`.
 * Повторная загрузка файла с тем же именем заменяет документ целиком.
 */
export const documents = sqliteTable("documents", {
  id: int("id").primaryKey({ autoIncrement: true }),
  fileName: text("file_name").notNull(),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Фрагменты текста документа (~1000 символов) — единица RAG-поиска. */
export const docChunks = sqliteTable("doc_chunks", {
  id: int("id").primaryKey({ autoIncrement: true }),
  documentId: int("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  /** Порядок фрагмента внутри документа. */
  idx: int("idx").notNull(),
  text: text("text").notNull(),
  /** Секунда начала фрагмента в видео (только для субтитров SRT/VTT, иначе NULL). */
  startSeconds: int("start_seconds"),
});

/**
 * Настройки приложения (одна строка, id=1).
 * Модель/температура/промпт «Судьи» и ссылка «Связаться с преподавателем» — в БД,
 * чтобы менять из админки без правки .env. API-ключ Mistral по-прежнему только в .env.
 */export const appSettings = sqliteTable("app_settings", {
  id: int("id").primaryKey(),
  judgeModel: text("judge_model").notNull().default("mistral-small-latest"),
  judgeTemperature: real("judge_temperature").notNull().default(0),
  /** Системный промпт «Судьи»; пусто/NULL → дефолт из кода (`DEFAULT_JUDGE_PROMPT`). */
  judgePrompt: text("judge_prompt"),
  /**
   * Ссылка для Inline-кнопки «Связаться с преподавателем».
   * NULL/пусто → fallback на `TEACHER_CONTACT_URL` из `.env`.
   */
  teacherContactUrl: text("teacher_contact_url"),
  /**
   * Токен Telegram-бота.
   * NULL/пусто → fallback на `TG_BOT_TOKEN` из `.env`.
   * Секрет: в API отдаём только маску, не полное значение.
   */
  tgBotToken: text("tg_bot_token"),
  updatedAt: int("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
