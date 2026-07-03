import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { qnaItems } from "@/db/schema";
import { inArray, ne, and } from "drizzle-orm";
import { deleteQnaItem } from "@/lib/qdrant";

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
    .select({ id: qnaItems.id, status: qnaItems.status })
    .from(qnaItems)
    .where(and(inArray(qnaItems.id, ids), ne(qnaItems.status, "deleted")));

  if (targets.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  await db
    .update(qnaItems)
    .set({ status: "deleted" })
    .where(inArray(qnaItems.id, targets.map((t) => t.id)));

  for (const item of targets) {
    if (item.status === "active") {
      await deleteQnaItem(item.id);
    }
  }

  return NextResponse.json({ deleted: targets.length });
}
