import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { qnaItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { upsertQnaItem } from "@/lib/qdrant";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Context) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  const [item] = await db.select().from(qnaItems).where(eq(qnaItems.id, id));
  if (!item) return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });

  if (item.status !== "deleted") {
    return NextResponse.json({ error: "Запись не находится в корзине" }, { status: 400 });
  }

  const hasAnswer = Boolean(item.answer && item.answer.trim());
  // Без ответа: запись с отвергнутым ответом возвращается в «Не помогло», остальные — в «Не отвечен»
  const restoredStatus = hasAnswer
    ? "active"
    : item.rejectedAnswer
      ? "not_helpful"
      : "unanswered";

  await db.update(qnaItems).set({ status: restoredStatus }).where(eq(qnaItems.id, id));

  if (hasAnswer) {
    await upsertQnaItem({ id, question: item.question, answer: item.answer });
  }

  return NextResponse.json({ ok: true, status: restoredStatus });
}
