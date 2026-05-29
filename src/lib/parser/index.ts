import { db } from "@/db";
import { qnaItems } from "@/db/schema";
import { extractTextFromBuffer } from "./extractText";
import { extractQAPairsFromText } from "./extractQA";
import { parseExcelQA } from "./excel";
import { upsertQnaItem } from "@/lib/qdrant";

const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function processDocument(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<number> {
  let pairs: { question: string; answer: string }[];

  if (mimeType === EXCEL_MIME) {
    // Excel: read question-answer columns directly, no LLM needed
    pairs = await parseExcelQA(buffer);
  } else {
    // PDF / DOCX: extract text then use LLM
    const text = await extractTextFromBuffer(buffer, mimeType);
    pairs = await extractQAPairsFromText(text);
  }

  if (pairs.length === 0) return 0;

  console.log(`[parser] inserting ${pairs.length} QnA items into SQLite (source: ${fileName})`);

  const inserted = await db
    .insert(qnaItems)
    .values(
      pairs.map((p) => ({
        question: p.question,
        answer: p.answer,
        sourceDocument: fileName,
        status: "active" as const,
      }))
    )
    .returning({
      id: qnaItems.id,
      question: qnaItems.question,
      answer: qnaItems.answer,
    });

  console.log(`[parser] SQLite insert done, indexing ${inserted.length} items in Qdrant...`);

  for (const item of inserted) {
    console.log(`[parser] indexing id=${item.id} "${item.question.slice(0, 60)}..."`);
    await upsertQnaItem({ id: item.id, question: item.question, answer: item.answer });
  }

  console.log(`[parser] Qdrant indexing complete (${inserted.length} items from ${fileName})`);

  return inserted.length;
}
