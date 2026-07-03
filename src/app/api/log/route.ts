import { NextResponse } from "next/server";
import { db } from "@/db";

const LIMIT = 200;

export async function GET() {
  const items = await db.query.botLog.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: LIMIT,
  });

  return NextResponse.json(items);
}
