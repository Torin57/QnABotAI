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
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.update(qnaItems).set({ status: "active" }).where(eq(qnaItems.id, id));
  await upsertQnaItem({ id, question: item.question, answer: item.answer });

  return NextResponse.json({ ok: true });
}
