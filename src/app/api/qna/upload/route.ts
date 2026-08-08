import { NextRequest, NextResponse } from "next/server";
import { processDocument, ImportLimitError } from "@/lib/parser";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/x-subrip",
  "text/vtt",
];

const TEXT_TYPES = ["text/plain", "application/x-subrip", "text/vtt"];

function mimeFromFileName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".srt")) return "application/x-subrip";
  if (lower.endsWith(".vtt")) return "text/vtt";
  return null;
}

/** Браузеры часто отдают пустой или generic type; расширение надёжнее.
 * Например, .srt браузер может отдать как text/plain — тогда файл не пройдёт
 * очистку от таймкодов. Поэтому сначала смотрим на расширение. */
function resolveEffectiveMime(file: File): string | null {
  const inferred = mimeFromFileName(file.name);
  if (inferred && ALLOWED_TYPES.includes(inferred)) return inferred;
  if (file.type && ALLOWED_TYPES.includes(file.type)) return file.type;
  return null;
}

/** Проверка содержимого: файл должен соответствовать заявленному типу.
 * PDF начинается с "%PDF", docx/xlsx — это ZIP-архивы ("PK\x03\x04").
 * Текстовые форматы magic bytes не имеют — проверяем, что это валидный UTF-8
 * без NUL-байтов; VTT дополнительно обязан начинаться с "WEBVTT". */
function matchesContent(buffer: Buffer, mimeType: string): boolean {
  if (TEXT_TYPES.includes(mimeType)) {
    if (buffer.length === 0) return false;
    if (buffer.includes(0)) return false; // NUL-байт — признак бинарника
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      return false;
    }
    if (mimeType === "text/vtt") {
      return text.replace(/^\uFEFF/, "").startsWith("WEBVTT");
    }
    return true;
  }

  if (buffer.length < 4) return false;
  if (mimeType === "application/pdf") {
    return buffer.subarray(0, 4).toString("latin1") === "%PDF";
  }
  // docx и xlsx — ZIP-контейнеры
  return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "Файл не передан" }, { status: 400 });

  const effectiveMime = resolveEffectiveMime(file);
  if (!effectiveMime)
    return NextResponse.json({ error: "Недопустимый тип файла" }, { status: 400 });
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: "Файл слишком большой (макс. 10 МБ)" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!matchesContent(buffer, effectiveMime))
    return NextResponse.json(
      { error: "Содержимое файла не соответствует его типу" },
      { status: 400 }
    );

  try {
    const result = await processDocument(buffer, effectiveMime, file.name);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ImportLimitError)
      return NextResponse.json({ error: err.message }, { status: 400 });

    const statusCode =
      err && typeof err === "object" && "statusCode" in err
        ? (err as { statusCode: number }).statusCode
        : null;

    const message =
      statusCode === 429
        ? "Превышен лимит запросов к Mistral API. Попробуйте позже."
        : "Ошибка при обработке файла";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
