import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { faqItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { upsertFaqItem, deleteFaqItem } from "@/lib/qdrant";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const { question, answer } = await request.json();

  const [item] = await db.select().from(faqItems).where(eq(faqItems.id, id));
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.update(faqItems).set({ question, answer }).where(eq(faqItems.id, id));

  if (item.status === "active") {
    await upsertFaqItem({ id, question, answer });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  const [item] = await db.select().from(faqItems).where(eq(faqItems.id, id));
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.update(faqItems).set({ status: "deleted" }).where(eq(faqItems.id, id));

  if (item.status === "active") {
    await deleteFaqItem(id);
  }

  return NextResponse.json({ ok: true });
}
