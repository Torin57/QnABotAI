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
