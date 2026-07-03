import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  verdict: text("verdict", { enum: ["answered", "null"] }).notNull(),
  answer: text("answer"),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
