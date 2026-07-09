import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

export const DEFAULT_JUDGE_MODEL = "mistral-small-latest";
export const DEFAULT_JUDGE_TEMPERATURE = 0;

export const DEFAULT_JUDGE_PROMPT = `Ты — ассистент выбора ответа из базы знаний.
Тебе даны вопрос пользователя и список кандидатов из базы знаний.
Выбери кандидата, чей вопрос точно отвечает на вопрос пользователя.
Верни ТОЛЬКО числовой ID кандидата. Если ни один не подходит — верни слово NULL.`;

export type JudgeSettings = {
  model: string;
  temperature: number;
  prompt: string;
};

const SETTINGS_ROW_ID = 1;

export async function getJudgeSettings(): Promise<JudgeSettings> {
  const row = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, SETTINGS_ROW_ID),
  });

  if (!row) {
    return {
      model: DEFAULT_JUDGE_MODEL,
      temperature: DEFAULT_JUDGE_TEMPERATURE,
      prompt: DEFAULT_JUDGE_PROMPT,
    };
  }

  const prompt =
    typeof row.judgePrompt === "string" && row.judgePrompt.trim()
      ? row.judgePrompt
      : DEFAULT_JUDGE_PROMPT;

  return {
    model: row.judgeModel || DEFAULT_JUDGE_MODEL,
    temperature:
      typeof row.judgeTemperature === "number" && Number.isFinite(row.judgeTemperature)
        ? row.judgeTemperature
        : DEFAULT_JUDGE_TEMPERATURE,
    prompt,
  };
}

export async function setJudgeSettings(input: {
  model: string;
  temperature: number;
  prompt: string;
}): Promise<JudgeSettings> {
  const model = input.model.trim();
  const temperature = input.temperature;
  const prompt = input.prompt.trim();
  const now = new Date();

  const existing = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, SETTINGS_ROW_ID),
  });

  if (existing) {
    await db
      .update(appSettings)
      .set({
        judgeModel: model,
        judgeTemperature: temperature,
        judgePrompt: prompt,
        updatedAt: now,
      })
      .where(eq(appSettings.id, SETTINGS_ROW_ID));
  } else {
    await db.insert(appSettings).values({
      id: SETTINGS_ROW_ID,
      judgeModel: model,
      judgeTemperature: temperature,
      judgePrompt: prompt,
      updatedAt: now,
    });
  }

  return { model, temperature, prompt };
}
