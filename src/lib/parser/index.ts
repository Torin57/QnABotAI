import { db } from "@/db";
import { qnaItems } from "@/db/schema";
import { extractTextFromBuffer } from "./extractText";
import { extractQAPairsFromText } from "./extractQA";
import { parseExcelQA } from "./excel";
import { upsertQnaItem } from "@/lib/qdrant";

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
    const text = await extractTextFromBuffer(buffer, mimeType);
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
