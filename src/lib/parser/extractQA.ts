import { mistral } from "../mistral";

export interface QAPair {
  question: string;
  answer: string;
}

const SYSTEM_PROMPT = `Ты — ассистент для создания базы знаний.
Из предоставленного текста извлеки все возможные пары вопрос-ответ.
Верни ТОЛЬКО валидный JSON-объект без лишнего текста, в формате:
{"pairs": [{"question": "...", "answer": "..."}, ...]}
Если пар не найдено, верни: {"pairs": []}`;

export async function extractQAPairsFromText(text: string): Promise<QAPair[]> {
  const response = await mistral.chat.complete({
    model: "mistral-small-latest",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text.slice(0, 24000) },
    ],
    responseFormat: { type: "json_object" },
  });

  const content = response.choices?.[0]?.message?.content ?? '{"pairs":[]}';
  const raw = typeof content === "string" ? content : '{"pairs":[]}';

  try {
    const parsed = JSON.parse(raw);
    const pairs: QAPair[] = Array.isArray(parsed)
      ? parsed
      : (parsed.pairs ?? []);
    return pairs.filter(
      (p) => typeof p.question === "string" && typeof p.answer === "string"
    );
  } catch {
    return [];
  }
}
