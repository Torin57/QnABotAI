import { NextResponse } from "next/server";
import { db } from "@/db";
import { faqItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { exportFaqToExcel } from "@/lib/parser/excel";

export async function GET() {
  const items = await db.query.faqItems.findMany({
    where: eq(faqItems.status, "active"),
    orderBy: (t, { asc }) => [asc(t.id)],
  });

  const buffer = await exportFaqToExcel(
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
      "Content-Disposition": `attachment; filename="faq-${Date.now()}.xlsx"`,
    },
  });
}
