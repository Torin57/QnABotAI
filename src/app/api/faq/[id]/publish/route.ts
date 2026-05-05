import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { faqItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { upsertFaqItem } from "@/lib/qdrant";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Context) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  const [item] = await db.select().from(faqItems).where(eq(faqItems.id, id));
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.update(faqItems).set({ status: "active" }).where(eq(faqItems.id, id));
  await upsertFaqItem({ id, question: item.question, answer: item.answer });

  return NextResponse.json({ ok: true });
}
