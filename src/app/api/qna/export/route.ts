import { NextResponse } from "next/server";
import { db } from "@/db";
import { qnaItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { exportQnaToExcel } from "@/lib/parser/excel";

export async function GET() {
  const items = await db.query.qnaItems.findMany({
    where: eq(qnaItems.status, "active"),
    orderBy: (t, { asc }) => [asc(t.id)],
  });

  const buffer = await exportQnaToExcel(
    items.map((i) => ({
      question: i.question,
      answer: i.answer,
      sourceDocument: i.sourceDocument,
      createdAt: i.createdAt,
    }))
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="qna-${Date.now()}.xlsx"`,
    },
  });
}
