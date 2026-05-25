import { NextRequest, NextResponse } from "next/server";
import { processDocument } from "@/lib/parser";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function mimeFromFileName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return null;
}

/** Браузеры часто отдают пустой или generic type; доверяем расширению после проверки allowlist. */
function resolveEffectiveMime(file: File): string | null {
  if (file.type && ALLOWED_TYPES.includes(file.type)) return file.type;
  const inferred = mimeFromFileName(file.name);
  if (inferred && ALLOWED_TYPES.includes(inferred)) return inferred;
  return null;
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

  try {
    const count = await processDocument(buffer, effectiveMime, file.name);
    return NextResponse.json({ imported: count });
  } catch (err) {
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
