import { db } from "@/db";
import { qnaItems, documents, docChunks } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  extractTextFromBuffer,
  isSubtitleMime,
  subtitleCuesFromBuffer,
} from "./extractText";
import { chunksFromCues, chunksFromText, type DocChunkDraft } from "./chunks";
import { extractQAPairsFromText } from "./extractQA";
import { parseExcelQA } from "./excel";
import { upsertQnaItem, upsertDocChunk, deleteDocChunks } from "@/lib/qdrant";

const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Лимиты импорта — защита от случайной/злонамеренной загрузки гигантских наборов. */
export const MAX_IMPORT_PAIRS = 500;
export const MAX_QUESTION_LENGTH = 1000;
export const MAX_ANSWER_LENGTH = 8000;

/** Ошибка нарушения лимитов импорта — API отдаёт её админу как 400 с понятным текстом. */
export class ImportLimitError extends Error {}

function enforceImportLimits(
  pairs: { question: string; answer: string }[]
): { question: string; answer: string }[] {
  if (pairs.length > MAX_IMPORT_PAIRS)
    throw new ImportLimitError(
      `Слишком много пар вопрос-ответ: ${pairs.length} (макс. ${MAX_IMPORT_PAIRS} за одну загрузку)`
    );

  // Слишком длинные поля обрезаем, а не отклоняем: LLM-путь может дать длинный ответ,
  // и терять всю загрузку из-за одной строки неудобно.
  return pairs.map((p) => ({
    question: p.question.slice(0, MAX_QUESTION_LENGTH),
    answer: p.answer.slice(0, MAX_ANSWER_LENGTH),
  }));
}

/**
 * Сохраняет документ и его фрагменты как материал для генерации ответов.
 * Повторная загрузка файла с тем же именем заменяет старую версию
 * (типичный случай: преподаватель перезаписал урок).
 */
async function saveDocumentWithChunks(
  fileName: string,
  chunks: DocChunkDraft[]
): Promise<number> {
  const existing = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.fileName, fileName));

  if (existing.length > 0) {
    const oldIds = existing.map((d) => d.id);
    for (const oldId of oldIds) {
      await deleteDocChunks(oldId);
    }
    await db.delete(docChunks).where(inArray(docChunks.documentId, oldIds));
    await db.delete(documents).where(inArray(documents.id, oldIds));
    console.log(`[parser] replaced previous version of document "${fileName}"`);
  }

  const [doc] = await db
    .insert(documents)
    .values({ fileName })
    .returning({ id: documents.id });

  if (chunks.length > 0) {
    const inserted = await db
      .insert(docChunks)
      .values(
        chunks.map((c, i) => ({
          documentId: doc.id,
          idx: i,
          text: c.text,
          startSeconds: c.startSeconds,
        }))
      )
      .returning({
        id: docChunks.id,
        text: docChunks.text,
        startSeconds: docChunks.startSeconds,
      });

    for (const chunk of inserted) {
      await upsertDocChunk({
        id: chunk.id,
        documentId: doc.id,
        fileName,
        text: chunk.text,
        startSeconds: chunk.startSeconds,
      });
    }
  }

  console.log(`[parser] document "${fileName}" saved with ${chunks.length} chunks`);
  return doc.id;
}

export async function processDocument(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<number> {
  let pairs: { question: string; answer: string }[];
  // Пары из Excel преподаватель готовил сам — сразу active + индексация.
  // Пары, извлечённые LLM из документа, — черновики до одобрения (без индексации).
  let isTrusted: boolean;

  if (mimeType === EXCEL_MIME) {
    pairs = await parseExcelQA(buffer);
    isTrusted = true;
  } else {
    let text: string;
    let chunks: DocChunkDraft[];

    if (isSubtitleMime(mimeType)) {
      // Субтитры: фрагменты с таймкодами, текст для LLM — те же реплики без таймкодов
      const cues = subtitleCuesFromBuffer(buffer);
      chunks = chunksFromCues(cues);
      text = cues.map((c) => c.text).join("\n");
    } else {
      text = await extractTextFromBuffer(buffer, mimeType);
      chunks = chunksFromText(text);
    }

    // Материал сохраняем до LLM-экстракции: даже если пары извлечь не удалось,
    // документ пригодится для генерации ответов
    await saveDocumentWithChunks(fileName, chunks);

    pairs = await extractQAPairsFromText(text);
    isTrusted = false;
  }

  pairs = enforceImportLimits(pairs);

  if (pairs.length === 0) return 0;

  const status = isTrusted ? ("active" as const) : ("draft" as const);

  console.log(
    `[parser] inserting ${pairs.length} QnA items as "${status}" into SQLite (source: ${fileName})`
  );

  const inserted = await db
    .insert(qnaItems)
    .values(
      pairs.map((p) => ({
        question: p.question,
        answer: p.answer,
        sourceDocument: fileName,
        status,
      }))
    )
    .returning({
      id: qnaItems.id,
      question: qnaItems.question,
      answer: qnaItems.answer,
    });

  if (!isTrusted) {
    console.log(`[parser] ${inserted.length} drafts saved, awaiting moderation (${fileName})`);
    return inserted.length;
  }

  console.log(`[parser] SQLite insert done, indexing ${inserted.length} items in Qdrant...`);

  for (const item of inserted) {
    console.log(`[parser] indexing id=${item.id} "${item.question.slice(0, 60)}..."`);
    await upsertQnaItem({ id: item.id, question: item.question, answer: item.answer });
  }

  console.log(`[parser] Qdrant indexing complete (${inserted.length} items from ${fileName})`);

  return inserted.length;
}
