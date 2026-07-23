import mammoth from "mammoth";

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TXT_MIME = "text/plain";
const SRT_MIME = "application/x-subrip";
const VTT_MIME = "text/vtt";

/** Убирает BOM, чтобы он не мешал проверкам вида startsWith("WEBVTT"). */
function decodeUtf8(buffer: Buffer): string {
  return buffer.toString("utf-8").replace(/^\uFEFF/, "");
}

/**
 * Превращает субтитры (SRT/VTT) в связный текст: выбрасывает заголовок WEBVTT,
 * служебные блоки (NOTE/STYLE/REGION), порядковые номера реплик, строки
 * таймкодов ("00:01:02,500 --> 00:01:04,000") и разметку вида <i>, <c.color>.
 */
export function subtitlesToPlainText(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const kept: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    if (/^WEBVTT/.test(trimmed)) continue;
    if (/^(NOTE|STYLE|REGION)\b/.test(trimmed)) continue;
    if (/^\d+$/.test(trimmed)) continue; // порядковый номер реплики SRT
    if (trimmed.includes("-->")) continue; // строка таймкодов

    const text = trimmed.replace(/<[^>]*>/g, "").trim();
    if (text) kept.push(text);
  }

  return kept.join("\n");
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === PDF_MIME) {
    // Dynamic import avoids ESM/CJS conflict with pdf-parse
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (mimeType === DOCX_MIME) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mimeType === TXT_MIME) {
    return decodeUtf8(buffer);
  }

  if (mimeType === SRT_MIME || mimeType === VTT_MIME) {
    return subtitlesToPlainText(decodeUtf8(buffer));
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
