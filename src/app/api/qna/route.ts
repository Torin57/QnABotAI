import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { qnaItems } from "@/db/schema";
import { and, eq, gte, lte, ne, type SQL } from "drizzle-orm";
import { upsertQnaItem } from "@/lib/qdrant";

const STATUS_VALUES = ["unanswered", "not_helpful", "draft", "active", "deleted"] as const;
type StatusValue = (typeof STATUS_VALUES)[number];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const status = searchParams.get("status");

  const conditions: SQL[] = [];

  if (status === "all") {
    // no status filter — show every lifecycle state
  } else if (status && STATUS_VALUES.includes(status as StatusValue)) {
    conditions.push(eq(qnaItems.status, status as StatusValue));
  } else {
    // default: hide deleted (active + unanswered)
    conditions.push(ne(qnaItems.status, "deleted"));
  }

  if (dateFrom) conditions.push(gte(qnaItems.createdAt, new Date(dateFrom)));
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(qnaItems.createdAt, to));
  }

  const items = await db.query.qnaItems.findMany({
    where: and(...conditions),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  let body: { question?: unknown; answer?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";

  if (!question || !answer) {
    return NextResponse.json(
      { error: "Заполните вопрос и ответ" },
      { status: 400 }
    );
  }

  const [item] = await db
    .insert(qnaItems)
    .values({ question, answer, status: "active" })
    .returning();

  await upsertQnaItem({ id: item.id, question: item.question, answer: item.answer });

  return NextResponse.json(item, { status: 201 });
}
