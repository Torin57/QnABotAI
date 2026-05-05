import { Bot, InlineKeyboard } from "grammy";
import { db } from "@/db";
import { unansweredQueries } from "@/db/schema";
import { ensureCollection, searchFaq } from "@/lib/qdrant";
import { mistral } from "@/lib/mistral";

const JUDGE_PROMPT = `Ты — ассистент выбора ответа из FAQ.
Тебе даны вопрос пользователя и список кандидатов из базы знаний.
Выбери кандидата, чей вопрос точно отвечает на вопрос пользователя.
Верни ТОЛЬКО числовой ID кандидата. Если ни один не подходит — верни слово NULL.`;

async function judgeAnswer(
  userQuestion: string,
  candidates: { id: number; question: string; answer: string; score: number }[]
): Promise<number | null> {
  const candidatesList = candidates
    .map((c) => `ID ${c.id}: "${c.question}"`)
    .join("\n");

  const response = await mistral.chat.complete({
    model: "mistral-small-latest",
    messages: [
      { role: "system", content: JUDGE_PROMPT },
      {
        role: "user",
        content: `Вопрос пользователя: "${userQuestion}"\n\nКандидаты:\n${candidatesList}`,
      },
    ],
  });

  const content =
    typeof response.choices?.[0]?.message?.content === "string"
      ? response.choices[0].message.content.trim()
      : "NULL";

  if (content === "NULL") return null;
  const id = parseInt(content, 10);
  return isNaN(id) ? null : id;
}

export function createBot() {
  const token = process.env.TG_BOT_TOKEN;
  if (!token) throw new Error("TG_BOT_TOKEN is not set");

  const bot = new Bot(token);

  bot.command("start", (ctx) =>
    ctx.reply(
      "Привет! Задайте вопрос, и я постараюсь найти ответ в базе знаний."
    )
  );

  bot.on("message:text", async (ctx) => {
    const userQuestion = ctx.message.text;
    const userId = String(ctx.from.id);

    try {
      const candidates = await searchFaq(userQuestion, 3);

      if (candidates.length === 0) {
        await logUnanswered(userId, userQuestion);
        await ctx.reply(
          "Не нашёл ответа на ваш вопрос.",
          contactKeyboard()
        );
        return;
      }

      const chosenId = await judgeAnswer(userQuestion, candidates);

      if (chosenId === null) {
        await logUnanswered(userId, userQuestion);
        await ctx.reply(
          "Не нашёл подходящего ответа в базе знаний.",
          contactKeyboard()
        );
        return;
      }

      const chosen = candidates.find((c) => c.id === chosenId);
      if (!chosen) {
        await logUnanswered(userId, userQuestion);
        await ctx.reply("Не нашёл ответа.", contactKeyboard());
        return;
      }

      await ctx.reply(chosen.answer);
    } catch (err) {
      console.error("[bot] error handling message:", err);
      await ctx.reply("Произошла ошибка. Попробуйте позже.");
    }
  });

  return bot;
}

async function logUnanswered(userId: string, questionText: string) {
  await db.insert(unansweredQueries).values({ userId, questionText });
}

function contactKeyboard() {
  return {
    reply_markup: new InlineKeyboard().url(
      "Связаться с преподавателем",
      "https://t.me/"
    ),
  };
}

export async function startBot() {
  await ensureCollection();
  const bot = createBot();
  bot.start();
  console.log("[bot] started");
  return bot;
}
