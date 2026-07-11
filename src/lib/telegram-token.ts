/**
 * Проверка токена через Telegram getMe (без логирования самого токена).
 */

const TOKEN_RE = /^\d{6,12}:[A-Za-z0-9_-]{20,}$/;

export function isPlausibleTgBotToken(token: string): boolean {
  return TOKEN_RE.test(token.trim());
}

export type TelegramBotInfo = {
  id: number;
  username: string | null;
  firstName: string;
};

export async function fetchTelegramBotInfo(
  token: string
): Promise<TelegramBotInfo> {
  const res = await fetch(`https://api.telegram.org/bot${token.trim()}/getMe`, {
    method: "GET",
    cache: "no-store",
  });

  let data: {
    ok?: boolean;
    description?: string;
    result?: { id?: number; username?: string; first_name?: string };
  };
  try {
    data = await res.json();
  } catch {
    throw new Error("Telegram не вернул ответ при проверке токена");
  }

  if (!data.ok || !data.result?.id) {
    throw new Error(
      typeof data.description === "string" && data.description
        ? `Неверный токен: ${data.description}`
        : "Неверный токен бота"
    );
  }

  return {
    id: data.result.id,
    username: data.result.username ?? null,
    firstName: data.result.first_name ?? "Bot",
  };
}
