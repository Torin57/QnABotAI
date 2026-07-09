import { Bot, InlineKeyboard } from "grammy";
import { db } from "@/db";
import { qnaItems, botLog } from "@/db/schema";
import { ensureCollection, searchQna, SearchResult } from "@/lib/qdrant";
import { mistral } from "@/lib/mistral";
import { createRateLimiter } from "@/lib/rate-limit";
import { getJudgeSettings } from "@/lib/settings";

// 3 вопроса в минуту на чат; счётчик только в памяти (chat_id не сохраняется)
const messageRateLimiter = createRateLimiter({
  limit: 3,
  windowMs: 60 * 1000,
});

async function judgeAnswer(
  userQuestion: string,
  candidates: { id: number; question: string; answer: string; score: number }[]
): Promise<number | null> {
  const candidatesList = candidates
    .map((c) => `ID ${c.id}: "${c.question}"`)
    .join("\n");

  const { model, temperature, prompt } = await getJudgeSettings();
  console.log("[bot] judge settings:", { model, temperature, promptLen: prompt.length });

  const response = await mistral.chat.complete({
    model,
    temperature,
    messages: [
      { role: "system", content: prompt },
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

    const rate = messageRateLimiter.check(String(ctx.chat.id));

    if (!rate.allowed) {
      console.log("[bot] rate limit exceeded for chat");

      if (rate.shouldNotify) {
        await ctx.reply(
          "Слишком много вопросов подряд. Подождите минуту и попробуйте снова."
        );
      }

      return;
    }

    console.log("[bot] user message:", userQuestion);

    try {
      console.log("[bot] searching QnA...");

      const candidates = await searchQna(userQuestion, 3);

      console.log("[bot] candidates found:", candidates);

      if (candidates.length === 0) {
        console.log("[bot] no candidates found");

        await logUnanswered(userQuestion);
        await logBotEvent(userQuestion, candidates, "null", null);

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
        await logBotEvent(userQuestion, candidates, "null", null);

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
        await logBotEvent(userQuestion, candidates, "null", null);

        await ctx.reply(
          "Не нашёл ответа.",
          contactKeyboard()
        );

        return;
      }

      console.log("[bot] sending answer:", chosen.answer);

      await ctx.reply(chosen.answer);
      await logBotEvent(userQuestion, candidates, "answered", chosen.answer);

      console.log("[bot] answer sent successfully");
    } catch (err) {
      console.error("[bot] error handling message:", err);

      await logBotError(userQuestion, err);

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

async function logBotError(questionText: string, err: unknown) {
  try {
    const message = err instanceof Error ? err.message : String(err);

    await db.insert(botLog).values({
      question: questionText,
      verdict: "error",
      error: message.slice(0, 500),
    });
  } catch (logErr) {
    // Ошибка записи лога не должна ронять обработчик
    console.error("[bot] failed to log error to bot_log:", logErr);
  }
}

async function logBotEvent(
  questionText: string,
  candidates: SearchResult[],
  verdict: "answered" | "null",
  answer: string | null
) {
  await db.insert(botLog).values({
    question: questionText,
    candidates: candidates.map((c) => ({ id: c.id, question: c.question, score: c.score })),
    verdict,
    answer,
  });
}

function contactKeyboard() {
  const teacherContactUrl = process.env.TEACHER_CONTACT_URL;

  if (!teacherContactUrl) {
    throw new Error("Не задана переменная окружения TEACHER_CONTACT_URL");
  }

  return {
    reply_markup: new InlineKeyboard().url(
      "Связаться с преподавателем",
      teacherContactUrl
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

