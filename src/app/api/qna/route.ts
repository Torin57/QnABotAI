import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { qnaItems } from "@/db/schema";
import { and, eq, gte, lte, ne, type SQL } from "drizzle-orm";

const STATUS_VALUES = ["unanswered", "active", "deleted"] as const;
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
