import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_JUDGE_MODEL,
  DEFAULT_JUDGE_PROMPT,
  DEFAULT_JUDGE_TEMPERATURE,
  getJudgeSettings,
  setJudgeSettings,
} from "@/lib/settings";

const MODEL_MAX_LEN = 100;
const PROMPT_MAX_LEN = 8000;

function isValidTemperature(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1.5;
}

export async function GET() {
  const settings = await getJudgeSettings();
  return NextResponse.json({
    model: settings.model,
    temperature: settings.temperature,
    prompt: settings.prompt,
    defaults: {
      model: DEFAULT_JUDGE_MODEL,
      temperature: DEFAULT_JUDGE_TEMPERATURE,
      prompt: DEFAULT_JUDGE_PROMPT,
    },
  });
}

export async function PATCH(request: NextRequest) {
  let body: { model?: unknown; temperature?: unknown; prompt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!model || model.length > MODEL_MAX_LEN) {
    return NextResponse.json(
      { error: "Укажите имя модели (не длиннее 100 символов)" },
      { status: 400 }
    );
  }

  if (!isValidTemperature(body.temperature)) {
    return NextResponse.json(
      { error: "Температура — число от 0 до 1.5" },
      { status: 400 }
    );
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json(
      { error: "Системный промпт не может быть пустым" },
      { status: 400 }
    );
  }
  if (prompt.length > PROMPT_MAX_LEN) {
    return NextResponse.json(
      { error: `Промпт не длиннее ${PROMPT_MAX_LEN} символов` },
      { status: 400 }
    );
  }

  const settings = await setJudgeSettings({
    model,
    temperature: body.temperature,
    prompt,
  });

  return NextResponse.json(settings);
}
