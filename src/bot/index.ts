import { Bot, InlineKeyboard } from "grammy";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { qnaItems, botLog } from "@/db/schema";
import { ensureCollection, searchQna, SearchResult } from "@/lib/qdrant";
import { mistral } from "@/lib/mistral";
import { createRateLimiter } from "@/lib/rate-limit";
import { getJudgeSettings, getTeacherContactUrl, getTgBotToken } from "@/lib/settings";

// 3 вопроса в минуту на чат; счётчик только в памяти (chat_id не сохраняется)
const messageRateLimiter = createRateLimiter({
  limit: 3,
  windowMs: 60 * 1000,
});

const NOT_HELPFUL_PREFIX = "nh:";

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

export function createBot(token: string) {
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

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (!data.startsWith(NOT_HELPFUL_PREFIX)) {
      await ctx.answerCallbackQuery();
      return;
    }

    const logId = parseInt(data.slice(NOT_HELPFUL_PREFIX.length), 10);
    if (!Number.isFinite(logId)) {
      await ctx.answerCallbackQuery({ text: "Некорректная кнопка" });
      return;
    }

    console.log("[bot] not_helpful callback for log id:", logId);

    try {
      const original = await db.query.botLog.findFirst({
        where: eq(botLog.id, logId),
      });

      if (!original || original.verdict !== "answered") {
        await ctx.answerCallbackQuery({ text: "Запись не найдена" });
        return;
      }

      const already = await db.query.botLog.findFirst({
        where: and(
          eq(botLog.verdict, "not_helpful"),
          eq(botLog.question, original.question),
          eq(botLog.answer, original.answer ?? "")
        ),
      });

      if (already) {
        await ctx.answerCallbackQuery({ text: "Уже отмечено" });
        try {
          await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
        } catch {
          // сообщение могло быть уже без клавиатуры
        }
        return;
      }

      await logNotHelpful(original.question, original.answer);
      await db.insert(botLog).values({
        question: original.question,
        candidates: original.candidates,
        verdict: "not_helpful",
        answer: original.answer,
      });

      await ctx.answerCallbackQuery({ text: "Передали преподавателю" });

      try {
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
      } catch {
        // ignore
      }

      await ctx.reply("Спасибо, передали вопрос преподавателю.");
      console.log("[bot] not_helpful recorded for question:", original.question);
    } catch (err) {
      console.error("[bot] error handling not_helpful:", err);
      await ctx.answerCallbackQuery({ text: "Ошибка, попробуйте позже" });
    }
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
          await contactKeyboard()
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
          await contactKeyboard()
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
          await contactKeyboard()
        );

        return;
      }

      console.log("[bot] sending answer:", chosen.answer);

      const logId = await logBotEvent(
        userQuestion,
        candidates,
        "answered",
        chosen.answer
      );

      await ctx.reply(chosen.answer, notHelpfulKeyboard(logId));

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

/** Ученик отверг выданный ответ: сохраняем вопрос вместе со снапшотом отвергнутого ответа. */
async function logNotHelpful(questionText: string, rejectedAnswer: string | null) {
  console.log("[bot] logging not_helpful question");

  await db.insert(qnaItems).values({
    question: questionText,
    status: "not_helpful",
    rejectedAnswer,
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
): Promise<number> {
  const [row] = await db
    .insert(botLog)
    .values({
      question: questionText,
      candidates: candidates.map((c) => ({
        id: c.id,
        question: c.question,
        score: c.score,
      })),
      verdict,
      answer,
    })
    .returning({ id: botLog.id });

  return row.id;
}

function notHelpfulKeyboard(logId: number) {
  return {
    reply_markup: new InlineKeyboard().text(
      "Это не помогло",
      `${NOT_HELPFUL_PREFIX}${logId}`
    ),
  };
}

async function contactKeyboard() {
  const teacherContactUrl = await getTeacherContactUrl();

  return {
    reply_markup: new InlineKeyboard().url(
      "Связаться с преподавателем",
      teacherContactUrl
    ),
  };
}

type BotGlobals = typeof globalThis & {
  __qnabotInstance?: Bot;
  __qnabotRestartChain?: Promise<void>;
};

function getRunningBot(): Bot | undefined {
  return (globalThis as BotGlobals).__qnabotInstance;
}

function setRunningBot(bot: Bot | undefined) {
  (globalThis as BotGlobals).__qnabotInstance = bot;
}

/**
 * Остановить текущий polling (если есть) и запустить бота с новым токеном.
 * Экземпляр на `globalThis`, чтобы API-роут Next.js видел тот же бот, что и server.ts.
 */
export async function restartBot(token: string): Promise<void> {
  const g = globalThis as BotGlobals;
  const run = async () => {
    const prev = getRunningBot();
    if (prev) {
      console.log("[bot] stopping previous instance...");
      try {
        await prev.stop();
      } catch (err) {
        console.error("[bot] stop error:", err);
      }
      setRunningBot(undefined);
    }

    console.log("[bot] creating bot instance...");
    const bot = createBot(token);
    setRunningBot(bot);

    console.log("[bot] starting polling...");
    void bot.start().catch((err) => {
      console.error("[bot] polling crashed:", err);
    });
    console.log("[bot] started");
  };

  const chain = (g.__qnabotRestartChain ?? Promise.resolve())
    .catch(() => undefined)
    .then(run);
  g.__qnabotRestartChain = chain;
  await chain;
}

export async function startBot() {
  console.log("[bot] ensuring Qdrant collection...");
  await ensureCollection();

  const { token } = await getTgBotToken();
  await restartBot(token);

  return getRunningBot();
}
