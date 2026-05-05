import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { unansweredQueries } from "@/db/schema";
import { and, gte, lte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const conditions = [];
  if (dateFrom)
    conditions.push(gte(unansweredQueries.timestamp, new Date(dateFrom)));
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(unansweredQueries.timestamp, to));
  }

  const items = await db.query.unansweredQueries.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: (t, { desc }) => [desc(t.timestamp)],
  });

  return NextResponse.json(items);
}
