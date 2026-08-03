/**
 * Полная переиндексация Qdrant из SQLite.
 * Использование: npm run qdrant:reindex
 * (секреты какого окружения брать — через APP_ENV, как у остальных скриптов)
 *
 * Источник правды — SQLite (`DATABASE_PATH`). Восстанавливает обе коллекции:
 * - COLLECTION — активные пары вопрос-ответ (`qna_items`);
 * - DOCS_COLLECTION — фрагменты учебных материалов (`doc_chunks` + `documents`).
 *
 * Коллекции пересоздаются с нуля, чтобы не осталось устаревших точек.
 * Эмбеддинги считаются последовательно — при 429 от Mistral сработает
 * встроенный retry в embedText.
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { qnaItems, documents, docChunks } from "../src/db/schema";
import { qdrant, COLLECTION, DOCS_COLLECTION } from "../src/lib/qdrant/client";
import {
  ensureCollection,
  ensureDocsCollection,
  upsertQnaItem,
  upsertDocChunk,
} from "../src/lib/qdrant";

async function recreate(name: string, ensure: () => Promise<void>): Promise<void> {
  const { collections } = await qdrant.getCollections();
  if (collections.some((c) => c.name === name)) {
    await qdrant.deleteCollection(name);
    console.log(`Коллекция "${name}" удалена, создаю заново...`);
  }
  await ensure();
}

async function reindexQna(): Promise<void> {
  const items = await db
    .select()
    .from(qnaItems)
    .where(eq(qnaItems.status, "active"));

  console.log(`Коллекция Qdrant: ${COLLECTION}`);
  console.log(`Активных записей в qna_items: ${items.length}`);

  await recreate(COLLECTION, ensureCollection);

  let done = 0;
  for (const item of items) {
    await upsertQnaItem({
      id: item.id,
      question: item.question,
      answer: item.answer,
    });
    done++;
    if (done % 25 === 0 || done === items.length) {
      console.log(`  проиндексировано ${done}/${items.length}`);
    }
  }

  console.log(`Готово: ${done} записей в коллекции "${COLLECTION}".`);
}

async function reindexDocs(): Promise<void> {
  const docs = await db.select().from(documents);
  const fileNameById = new Map(docs.map((d) => [d.id, d.fileName]));

  const chunks = await db.select().from(docChunks);

  console.log(`Коллекция Qdrant: ${DOCS_COLLECTION}`);
  console.log(`Документов: ${docs.length}, фрагментов: ${chunks.length}`);

  await recreate(DOCS_COLLECTION, ensureDocsCollection);

  let done = 0;
  for (const chunk of chunks) {
    await upsertDocChunk({
      id: chunk.id,
      documentId: chunk.documentId,
      fileName: fileNameById.get(chunk.documentId) ?? "",
      text: chunk.text,
      startSeconds: chunk.startSeconds,
    });
    done++;
    if (done % 25 === 0 || done === chunks.length) {
      console.log(`  проиндексировано ${done}/${chunks.length}`);
    }
  }

  console.log(`Готово: ${done} фрагментов в коллекции "${DOCS_COLLECTION}".`);
}

async function main(): Promise<void> {
  await reindexQna();
  await reindexDocs();
}

main().catch((err) => {
  console.error("Ошибка переиндексации:", err);
  process.exit(1);
});
