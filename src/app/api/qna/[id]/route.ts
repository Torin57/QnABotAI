import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { qnaItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { upsertQnaItem, deleteQnaItem } from "@/lib/qdrant";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const { question, answer } = await request.json();

  const [item] = await db.select().from(qnaItems).where(eq(qnaItems.id, id));
  if (!item) return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });

  await db.update(qnaItems).set({ question, answer }).where(eq(qnaItems.id, id));

  if (item.status === "active") {
    await upsertQnaItem({ id, question, answer });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  const [item] = await db.select().from(qnaItems).where(eq(qnaItems.id, id));
  if (!item) return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });

  await db.update(qnaItems).set({ status: "deleted" }).where(eq(qnaItems.id, id));

  if (item.status === "active") {
    await deleteQnaItem(id);
  }

  return NextResponse.json({ ok: true });
}
