import { NextRequest, NextResponse } from "next/server";
import {
  getEnvTeacherContactUrl,
  getTeacherContactUrl,
  setTeacherContactUrl,
} from "@/lib/settings";

const URL_MAX_LEN = 500;

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET() {
  let url: string;
  try {
    url = await getTeacherContactUrl();
  } catch {
    url = getEnvTeacherContactUrl();
  }

  return NextResponse.json({
    url,
    defaultFromEnv: getEnvTeacherContactUrl(),
  });
}

export async function PATCH(request: NextRequest) {
  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json(
      { error: "Укажите ссылку для кнопки «Связаться с преподавателем»" },
      { status: 400 }
    );
  }
  if (url.length > URL_MAX_LEN) {
    return NextResponse.json(
      { error: `Ссылка не длиннее ${URL_MAX_LEN} символов` },
      { status: 400 }
    );
  }
  if (!isValidHttpUrl(url)) {
    return NextResponse.json(
      { error: "Ссылка должна начинаться с http:// или https://" },
      { status: 400 }
    );
  }

  const saved = await setTeacherContactUrl(url);
  return NextResponse.json({ url: saved });
}
