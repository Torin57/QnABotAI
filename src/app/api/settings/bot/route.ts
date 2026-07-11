import { NextRequest, NextResponse } from "next/server";
import {
  clearTgBotToken,
  getTgBotToken,
  maskTgBotToken,
  setTgBotToken,
} from "@/lib/settings";
import {
  fetchTelegramBotInfo,
  isPlausibleTgBotToken,
} from "@/lib/telegram-token";
import { restartBot } from "@/bot/index";

const TOKEN_MAX_LEN = 200;

export async function GET() {
  try {
    const { token, source } = await getTgBotToken();
    let username: string | null = null;
    try {
      const info = await fetchTelegramBotInfo(token);
      username = info.username;
    } catch {
      // токен есть, но Telegram недоступен / токен протух — маску всё равно отдаём
    }

    return NextResponse.json({
      maskedToken: maskTgBotToken(token),
      source,
      username,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Токен бота не задан",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  let body: { token?: unknown; resetToEnv?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (body.resetToEnv === true) {
    try {
      await clearTgBotToken();
      const { token, source } = await getTgBotToken();
      const info = await fetchTelegramBotInfo(token);
      await restartBot(token);
      return NextResponse.json({
        ok: true,
        source,
        maskedToken: maskTgBotToken(token),
        username: info.username,
      });
    } catch (err) {
      console.error("[api/settings/bot] reset ERROR", err);
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Не удалось вернуть токен из .env",
        },
        { status: 500 }
      );
    }
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json(
      { error: "Укажите токен бота или сбросьте к .env" },
      { status: 400 }
    );
  }
  if (token.length > TOKEN_MAX_LEN) {
    return NextResponse.json(
      { error: `Токен не длиннее ${TOKEN_MAX_LEN} символов` },
      { status: 400 }
    );
  }
  if (!isPlausibleTgBotToken(token)) {
    return NextResponse.json(
      { error: "Токен выглядит неверно (ожидается вид 123456:AA…)" },
      { status: 400 }
    );
  }

  let info;
  try {
    info = await fetchTelegramBotInfo(token);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Неверный токен бота",
      },
      { status: 400 }
    );
  }

  try {
    await setTgBotToken(token);
    await restartBot(token);
  } catch (err) {
    console.error("[api/settings/bot] apply ERROR", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Токен сохранён, но не удалось перезапустить бота",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    source: "settings" as const,
    maskedToken: maskTgBotToken(token),
    username: info.username,
  });
}
