/**
 * Полная переиндексация Qdrant из SQLite (qna_items).
 * Использование: npm run qdrant:reindex
 * (секреты какого окружения брать — через APP_ENV, как у остальных скриптов)
 *
 * Qdrant — производный индекс, источник правды — logs.db. Скрипт нужен
 * для восстановления после потери qdrant_storage/ (бэкапим только logs.db).
 *
 * Коллекция пересоздаётся с нуля, чтобы не осталось устаревших точек.
 * Эмбеддинги считаются последовательно — при 429 от Mistral сработает
 * встроенный retry в embedText.
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { qnaItems } from "../src/db/schema";
import { qdrant, COLLECTION } from "../src/lib/qdrant/client";
import { ensureCollection, upsertQnaItem } from "../src/lib/qdrant";

async function main(): Promise<void> {
  const items = await db
    .select()
    .from(qnaItems)
    .where(eq(qnaItems.status, "active"));

  console.log(`Активных записей в qna_items: ${items.length}`);

  const { collections } = await qdrant.getCollections();
  if (collections.some((c) => c.name === COLLECTION)) {
    await qdrant.deleteCollection(COLLECTION);
    console.log(`Коллекция "${COLLECTION}" удалена, создаю заново...`);
  }
  await ensureCollection();

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

main().catch((err) => {
  console.error("Ошибка переиндексации:", err);
  process.exit(1);
});
