import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { qnaItems } from "@/db/schema";
import { inArray, and, notInArray } from "drizzle-orm";
import { upsertQnaItem } from "@/lib/qdrant";

/** Массовая публикация: черновики/неотвеченные с непустым ответом → active + индексация. */
export async function POST(request: NextRequest) {
  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is number => typeof id === "number")
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Не выбрано ни одной записи" }, { status: 400 });
  }

  const targets = await db
    .select({ id: qnaItems.id, question: qnaItems.question, answer: qnaItems.answer })
    .from(qnaItems)
    .where(and(inArray(qnaItems.id, ids), notInArray(qnaItems.status, ["active", "deleted"])));

  const publishable = targets.filter((t) => t.answer && t.answer.trim());
  const skipped = targets.length - publishable.length;

  if (publishable.length === 0) {
    return NextResponse.json(
      { error: "Среди выбранных нет записей с ответом — публиковать нечего" },
      { status: 400 }
    );
  }

  await db
    .update(qnaItems)
    .set({ status: "active" })
    .where(inArray(qnaItems.id, publishable.map((t) => t.id)));

  for (const item of publishable) {
    await upsertQnaItem({ id: item.id, question: item.question, answer: item.answer });
  }

  return NextResponse.json({ published: publishable.length, skipped });
}
