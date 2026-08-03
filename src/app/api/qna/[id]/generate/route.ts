import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { qnaItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { searchDocChunks, type ChunkSearchResult } from "@/lib/qdrant";
import { mistral } from "@/lib/mistral";

type Context = { params: Promise<{ id: string }> };

const SYSTEM_PROMPT = `Ты — помощник преподавателя онлайн-курса.
Тебе даны вопрос ученика и пронумерованные фрагменты лекций преподавателя.
Составь ответ на вопрос СТРОГО на основе этих фрагментов, формулировками преподавателя.
Ничего не выдумывай: если фрагменты не содержат ответа на вопрос, верни {"answer": null, "source": null}.
Верни ТОЛЬКО валидный JSON-объект без лишнего текста, в формате:
{"answer": "текст ответа", "source": номер фрагмента, на котором в основном построен ответ}`;

function formatSourceNote(chunk: ChunkSearchResult): string {
  if (chunk.startSeconds !== null) {
    const minute = Math.max(1, Math.round(chunk.startSeconds / 60));
    return `Подробнее: ${chunk.fileName}, ~${minute}-я минута`;
  }
  return `Подробнее: ${chunk.fileName}`;
}

export async function POST(_request: NextRequest, { params }: Context) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  const [item] = await db.select().from(qnaItems).where(eq(qnaItems.id, id));
  if (!item) return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });

  if (item.status !== "unanswered" && item.status !== "not_helpful") {
    return NextResponse.json(
      { error: "Генерация доступна только для вопросов без ответа" },
      { status: 400 }
    );
  }

  const chunks = await searchDocChunks(item.question, 4);
  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "Материалы не загружены — сначала загрузите транскрипты уроков" },
      { status: 404 }
    );
  }

  const fragmentsList = chunks
    .map((c, i) => `Фрагмент ${i + 1} (${c.fileName}):\n${c.text}`)
    .join("\n\n");

  // Для «Не помогло» передаём отвергнутый ответ как антипример
  const rejectedNote =
    item.status === "not_helpful" && item.rejectedAnswer
      ? `\n\nУченику уже выдавали такой ответ, и он НЕ помог — предложи другой, более полный:\n"${item.rejectedAnswer}"`
      : "";

  try {
    const response = await mistral.chat.complete({
      model: "mistral-small-latest",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Вопрос ученика: "${item.question}"${rejectedNote}\n\nФрагменты лекций:\n${fragmentsList}`,
        },
      ],
      responseFormat: { type: "json_object" },
    });

    const content = response.choices?.[0]?.message?.content;
    const raw = typeof content === "string" ? content : "{}";

    let answer: string | null = null;
    let sourceIdx: number | null = null;
    try {
      const parsed = JSON.parse(raw);
      answer = typeof parsed.answer === "string" && parsed.answer.trim() ? parsed.answer.trim() : null;
      sourceIdx =
        typeof parsed.source === "number" && parsed.source >= 1 && parsed.source <= chunks.length
          ? parsed.source
          : null;
    } catch {
      answer = null;
    }

    if (!answer) {
      return NextResponse.json(
        { error: "В загруженных материалах ответа на этот вопрос не нашлось" },
        { status: 404 }
      );
    }

    // Отсылка к уроку/минуте — от фрагмента, который выбрала модель (иначе от лучшего по score)
    const sourceChunk = sourceIdx !== null ? chunks[sourceIdx - 1] : chunks[0];
    const draft = `${answer}\n\n${formatSourceNote(sourceChunk)}`;

    return NextResponse.json({ answer: draft });
  } catch (err) {
    console.error("[generate] ERROR", err);
    const statusCode =
      err && typeof err === "object" && "statusCode" in err
        ? (err as { statusCode: number }).statusCode
        : null;
    const message =
      statusCode === 429
        ? "Превышен лимит запросов к Mistral API. Попробуйте позже."
        : "Ошибка при генерации ответа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
