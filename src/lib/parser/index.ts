import { db } from "@/db";
import { faqItems } from "@/db/schema";
import { extractTextFromBuffer } from "./extractText";
import { extractQAPairsFromText } from "./extractQA";
import { parseExcelQA } from "./excel";

const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function processDocument(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<number> {
  let pairs: { question: string; answer: string }[];

  if (mimeType === EXCEL_MIME) {
    // Excel: read Q&A columns directly, no LLM needed
    pairs = await parseExcelQA(buffer);
  } else {
    // PDF / DOCX: extract text then use LLM
    const text = await extractTextFromBuffer(buffer, mimeType);
    pairs = await extractQAPairsFromText(text);
  }

  if (pairs.length === 0) return 0;

  await db.insert(faqItems).values(
    pairs.map((p) => ({
      question: p.question,
      answer: p.answer,
      sourceDocument: fileName,
    }))
  );

  return pairs.length;
}
