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

export type SubtitleCue = {
  /** Начало реплики в секундах от начала видео. */
  startSeconds: number;
  text: string;
};

/** "01:02:03,500" / "02:03.500" → секунды; null, если строка не таймкод. */
function parseTimecode(value: string): number | null {
  const match = value.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{3})$/);
  if (!match) return null;
  const [, h, m, s] = match;
  return (h ? parseInt(h, 10) * 3600 : 0) + parseInt(m, 10) * 60 + parseInt(s, 10);
}

/**
 * Разбирает субтитры (SRT/VTT) на реплики с таймкодами начала.
 * Выбрасывает заголовок WEBVTT, служебные блоки (NOTE/STYLE/REGION),
 * порядковые номера реплик и разметку вида <i>, <c.color>.
 */
export function subtitlesToCues(raw: string): SubtitleCue[] {
  const lines = raw.split(/\r?\n/);
  const cues: SubtitleCue[] = [];
  let current: SubtitleCue | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    if (/^WEBVTT/.test(trimmed)) continue;
    if (/^(NOTE|STYLE|REGION)\b/.test(trimmed)) continue;
    if (/^\d+$/.test(trimmed)) continue; // порядковый номер реплики SRT

    if (trimmed.includes("-->")) {
      const start = parseTimecode(trimmed.split("-->")[0].trim().split(" ")[0]);
      current = { startSeconds: start ?? 0, text: "" };
      cues.push(current);
      continue;
    }

    const text = trimmed.replace(/<[^>]*>/g, "").trim();
    if (!text) continue;

    if (current) {
      current.text = current.text ? `${current.text}\n${text}` : text;
    } else {
      // текст до первого таймкода (нестандартный файл) — не теряем
      current = { startSeconds: 0, text };
      cues.push(current);
    }
  }

  return cues.filter((c) => c.text);
}

/** Субтитры → связный текст без таймкодов (для LLM-экстракции пар). */
export function subtitlesToPlainText(raw: string): string {
  return subtitlesToCues(raw)
    .map((c) => c.text)
    .join("\n");
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

export function isSubtitleMime(mimeType: string): boolean {
  return mimeType === SRT_MIME || mimeType === VTT_MIME;
}

export function subtitleCuesFromBuffer(buffer: Buffer): SubtitleCue[] {
  return subtitlesToCues(decodeUtf8(buffer));
}
