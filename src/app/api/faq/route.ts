import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { faqItems } from "@/db/schema";
import { and, gte, lte, ne } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const conditions = [ne(faqItems.status, "deleted")];

  if (dateFrom) conditions.push(gte(faqItems.createdAt, new Date(dateFrom)));
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(faqItems.createdAt, to));
  }

  const items = await db.query.faqItems.findMany({
    where: and(...conditions),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  return NextResponse.json(items);
}
