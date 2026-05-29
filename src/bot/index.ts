import { Bot, InlineKeyboard } from "grammy";
import { db } from "@/db";
import { qnaItems } from "@/db/schema";
import { ensureCollection, searchQna } from "@/lib/qdrant";
import { mistral } from "@/lib/mistral";

const JUDGE_PROMPT = `Ты — ассистент выбора ответа из базы знаний.
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

  console.log("[bot] judge response:", content);

  if (content === "NULL") return null;

  const id = parseInt(content, 10);
  return isNaN(id) ? null : id;
}

export function createBot() {
  const token = process.env.TG_BOT_TOKEN;

  if (!token) {
    throw new Error("TG_BOT_TOKEN is not set");
  }

  const bot = new Bot(token);

  // Global update logger
  bot.use(async (ctx, next) => {
    console.log(
      "[bot] update received:",
      JSON.stringify(ctx.update, null, 2)
    );

    await next();
  });

  bot.command("start", async (ctx) => {
    console.log("[bot] /start command");

    await ctx.reply(
      "Привет! Задайте вопрос, и я постараюсь найти ответ в базе знаний."
    );
  });

  bot.on("message:text", async (ctx) => {
    const userQuestion = ctx.message.text;

    console.log("[bot] user message:", userQuestion);

    try {
      console.log("[bot] searching QnA...");

      const candidates = await searchQna(userQuestion, 3);

      console.log("[bot] candidates found:", candidates);

      if (candidates.length === 0) {
        console.log("[bot] no candidates found");

        await logUnanswered(userQuestion);

        await ctx.reply(
          "Не нашёл ответа на ваш вопрос.",
          contactKeyboard()
        );

        return;
      }

      console.log("[bot] judging candidates...");

      const chosenId = await judgeAnswer(userQuestion, candidates);

      console.log("[bot] chosen id:", chosenId);

      if (chosenId === null) {
        console.log("[bot] judge returned NULL");

        await logUnanswered(userQuestion);

        await ctx.reply(
          "Не нашёл подходящего ответа в базе знаний.",
          contactKeyboard()
        );

        return;
      }

      const chosen = candidates.find((c) => c.id === chosenId);

      console.log("[bot] chosen candidate:", chosen);

      if (!chosen) {
        console.log("[bot] chosen candidate not found in candidates");

        await logUnanswered(userQuestion);

        await ctx.reply(
          "Не нашёл ответа.",
          contactKeyboard()
        );

        return;
      }

      console.log("[bot] sending answer:", chosen.answer);

      await ctx.reply(chosen.answer);

      console.log("[bot] answer sent successfully");
    } catch (err) {
      console.error("[bot] error handling message:", err);

      await ctx.reply("Произошла ошибка. Попробуйте позже.");
    }
  });

  return bot;
}

async function logUnanswered(questionText: string) {
  console.log("[bot] logging unanswered question");

  await db.insert(qnaItems).values({
    question: questionText,
    status: "unanswered",
  });
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
  console.log("[bot] ensuring Qdrant collection...");

  await ensureCollection();

  console.log("[bot] creating bot instance...");

  const bot = createBot();

  console.log("[bot] starting polling...");

  bot.start();

  console.log("[bot] started");

  return bot;
}

