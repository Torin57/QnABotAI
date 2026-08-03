import type { SubtitleCue } from "./extractText";

/** Целевой размер фрагмента для RAG-поиска (символов). */
const TARGET_CHUNK_CHARS = 1000;

export type DocChunkDraft = {
  text: string;
  /** Секунда начала фрагмента в видео (null для PDF/DOCX/TXT — там нет таймкодов). */
  startSeconds: number | null;
};

/** Субтитры: реплики склеиваются в фрагменты ~1000 символов, таймкод — от первой реплики. */
export function chunksFromCues(cues: SubtitleCue[]): DocChunkDraft[] {
  const chunks: DocChunkDraft[] = [];
  let buf: string[] = [];
  let bufStart: number | null = null;
  let bufLen = 0;

  const flush = () => {
    if (buf.length === 0) return;
    chunks.push({ text: buf.join("\n"), startSeconds: bufStart });
    buf = [];
    bufStart = null;
    bufLen = 0;
  };

  for (const cue of cues) {
    if (bufStart === null) bufStart = cue.startSeconds;
    buf.push(cue.text);
    bufLen += cue.text.length;
    if (bufLen >= TARGET_CHUNK_CHARS) flush();
  }
  flush();

  return chunks;
}

/** Обычный текст: режем по абзацам (иначе — по предложениям) в фрагменты ~1000 символов. */
export function chunksFromText(text: string): DocChunkDraft[] {
  const paragraphs = text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: DocChunkDraft[] = [];
  let buf: string[] = [];
  let bufLen = 0;

  const flush = () => {
    if (buf.length === 0) return;
    chunks.push({ text: buf.join("\n"), startSeconds: null });
    buf = [];
    bufLen = 0;
  };

  for (const paragraph of paragraphs) {
    // Слишком длинный абзац режем по предложениям, чтобы фрагменты не раздувались
    const pieces =
      paragraph.length > TARGET_CHUNK_CHARS * 2
        ? paragraph.split(/(?<=[.!?])\s+/)
        : [paragraph];

    for (const piece of pieces) {
      buf.push(piece);
      bufLen += piece.length;
      if (bufLen >= TARGET_CHUNK_CHARS) flush();
    }
  }
  flush();

  return chunks;
}
