import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const qnaItems = sqliteTable("qna_items", {
  id: int("id").primaryKey({ autoIncrement: true }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sourceDocument: text("source_document").notNull(),
  status: text("status", { enum: ["pending", "active", "deleted"] })
    .notNull()
    .default("pending"),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const unansweredQueries = sqliteTable("unanswered_queries", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  questionText: text("question_text").notNull(),
  timestamp: int("timestamp", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
