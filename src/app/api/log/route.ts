import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { qnaItems } from "@/db/schema";

const LIMIT = 200;

type StoredCandidate = { id: number; question: string; score: number };

export async function GET() {
  const items = await db.query.botLog.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: LIMIT,
  });

  const candidateIds = new Set<number>();
  for (const item of items) {
    const candidates = item.candidates as StoredCandidate[] | null;
    if (!candidates) continue;
    for (const c of candidates) candidateIds.add(c.id);
  }

  const answerById = new Map<number, string | null>();
  if (candidateIds.size > 0) {
    const rows = await db.query.qnaItems.findMany({
      where: inArray(qnaItems.id, [...candidateIds]),
      columns: { id: true, answer: true },
    });
    for (const row of rows) answerById.set(row.id, row.answer);
  }

  const enriched = items.map((item) => {
    const candidates = item.candidates as StoredCandidate[] | null;
    return {
      ...item,
      candidates: candidates
        ? candidates.map((c) => ({
            ...c,
            /** Актуальный ответ из базы знаний (может отличаться от снапшота на момент обращения). */
            answer: answerById.has(c.id) ? answerById.get(c.id) ?? null : null,
          }))
        : null,
    };
  });

  return NextResponse.json(enriched);
}
