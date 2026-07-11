import { int, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const qnaItems = sqliteTable("qna_items", {
  id: int("id").primaryKey({ autoIncrement: true }),
  question: text("question").notNull(),
  answer: text("answer"),
  sourceDocument: text("source_document"),
  status: text("status", { enum: ["unanswered", "active", "deleted"] })
    .notNull()
    .default("unanswered"),
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
  verdict: text("verdict", { enum: ["answered", "null", "error"] }).notNull(),
  answer: text("answer"),
  /** Текст ошибки обработки (только для verdict="error"), без stack trace. */
  error: text("error"),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Настройки приложения (одна строка, id=1).
 * Модель/температура/промпт «Судьи» и ссылка «Связаться с преподавателем» — в БД,
 * чтобы менять из админки без правки .env. API-ключ Mistral по-прежнему только в .env.
 */
export const appSettings = sqliteTable("app_settings", {
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
  updatedAt: int("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
