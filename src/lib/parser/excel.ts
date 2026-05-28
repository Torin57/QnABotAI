import ExcelJS from "exceljs";
import type { QAPair } from "./extractQA";

export async function parseExcelQA(buffer: Buffer): Promise<QAPair[]> {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const sheet = workbook.worksheets[0];
  const pairs: QAPair[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const question = String(row.getCell(1).value ?? "").trim();
    const answer = String(row.getCell(2).value ?? "").trim();
    if (question && answer) pairs.push({ question, answer });
  });

  return pairs;
}

export async function exportQnaToExcel(
  items: { question: string; answer: string; sourceDocument: string; createdAt: Date }[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("QnA");

  sheet.columns = [
    { header: "question", key: "question", width: 50 },
    { header: "answer", key: "answer", width: 70 },
    { header: "source", key: "sourceDocument", width: 30 },
    { header: "created_at", key: "createdAt", width: 20 },
  ];

  sheet.addRows(items);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportUnansweredToExcel(
  items: { userId: string; questionText: string; timestamp: Date }[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Unanswered");

  sheet.columns = [
    { header: "user_id", key: "userId", width: 20 },
    { header: "question", key: "questionText", width: 70 },
    { header: "timestamp", key: "timestamp", width: 20 },
  ];

  sheet.addRows(items);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
