import { mistral } from "../mistral";
import { qdrant, COLLECTION, DOCS_COLLECTION, VECTOR_SIZE } from "./client";

async function ensureCollectionByName(name: string): Promise<void> {
  const { collections } = await qdrant.getCollections();
  const exists = collections.some((c) => c.name === name);
  if (exists) return;

  await qdrant.createCollection(name, {
    vectors: { size: VECTOR_SIZE, distance: "Cosine" },
  });
}

export async function ensureCollection(): Promise<void> {
  await ensureCollectionByName(COLLECTION);
}

export async function ensureDocsCollection(): Promise<void> {
  await ensureCollectionByName(DOCS_COLLECTION);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Лимит Mistral — 60 запросов в минуту, поэтому тексты идут пачками, а не по одному.
 * Ограничение и по количеству, и по объёму: у `mistral-embed` окно 8192 токена на вход. */
const EMBED_BATCH_SIZE = 32;
const EMBED_BATCH_CHARS = 32_000;

function splitIntoBatches(texts: string[]): string[][] {
  const batches: string[][] = [];
  let batch: string[] = [];
  let batchChars = 0;

  for (const text of texts) {
    if (batch.length > 0 && (batch.length >= EMBED_BATCH_SIZE || batchChars + text.length > EMBED_BATCH_CHARS)) {
      batches.push(batch);
      batch = [];
      batchChars = 0;
    }
    batch.push(text);
    batchChars += text.length;
  }
  if (batch.length > 0) batches.push(batch);

  return batches;
}

/** Не быстрее одного запроса эмбеддингов в секунду (лимит Mistral — 60 в минуту).
 * Вызовы выстраиваются в очередь: параллельные загрузка и вопрос в боте
 * не дают всплеска, а тратят общий бюджет по очереди. */
const EMBED_MIN_INTERVAL_MS = 1000;
let embedQueue: Promise<unknown> = Promise.resolve();
let lastEmbedStartedAt = 0;

function throttled<T>(task: () => Promise<T>): Promise<T> {
  const result = embedQueue.then(async () => {
    const wait = lastEmbedStartedAt + EMBED_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastEmbedStartedAt = Date.now();
    return task();
  });

  // Очередь не должна рваться из-за ошибки одного вызова
  embedQueue = result.catch(() => {});
  return result;
}

/** Задержки перед повтором после 429. Сумма (65 с) заведомо больше минутного
 * окна Mistral, поэтому квота успевает сброситься. */
const EMBED_RETRY_DELAYS_MS = [5_000, 15_000, 45_000];

function statusCodeOf(err: unknown): number | null {
  if (!err || typeof err !== "object" || !("statusCode" in err)) return null;
  const code = (err as { statusCode: unknown }).statusCode;
  return typeof code === "number" ? code : null;
}

/** Если Mistral прислал Retry-After — он точнее нашей лестницы задержек. */
function retryAfterMs(err: unknown): number | null {
  if (!err || typeof err !== "object" || !("headers" in err)) return null;
  const headers = (err as { headers?: { get?: (name: string) => string | null } }).headers;
  const raw = headers?.get?.("retry-after");
  if (!raw) return null;

  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(seconds, 65) * 1000;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await throttled(() =>
        mistral.embeddings.create({
          model: "mistral-embed",
          inputs: texts,
        })
      );
      // Порядок в ответе не гарантирован — восстанавливаем по index
      return response.data
        .slice()
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((d) => d.embedding!);
    } catch (err) {
      const isLastAttempt = attempt >= EMBED_RETRY_DELAYS_MS.length;
      if (statusCodeOf(err) !== 429 || isLastAttempt) throw err;

      const delay = retryAfterMs(err) ?? EMBED_RETRY_DELAYS_MS[attempt];
      console.warn(
        `[embed] 429 от Mistral, повтор через ${Math.round(delay / 1000)} с ` +
          `(попытка ${attempt + 1} из ${EMBED_RETRY_DELAYS_MS.length})`
      );
      await sleep(delay);
    }
  }
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  for (const batch of splitIntoBatches(texts)) {
    vectors.push(...(await embedBatch(batch)));
  }
  return vectors;
}

export async function embedText(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}

export async function upsertQnaItem(item: {
  id: number;
  question: string;
  answer: string | null;
}): Promise<void> {
  await ensureCollection();
  const vector = await embedText(item.question);
  await qdrant.upsert(COLLECTION, {
    points: [
      {
        id: item.id,
        vector,
        payload: {
          id: item.id,
          question: item.question,
          answer: item.answer ?? "",
        },
      },
    ],
  });
}

export async function deleteQnaItem(id: number): Promise<void> {
  try {
    await qdrant.delete(COLLECTION, { points: [id] });
  } catch {
    // Collection may not exist yet — nothing to delete
  }
}

export interface SearchResult {
  id: number;
  question: string;
  answer: string;
  score: number;
}

export async function searchQna(
  query: string,
  topK = 3
): Promise<SearchResult[]> {
  const vector = await embedText(query);
  const results = await qdrant.search(COLLECTION, {
    vector,
    limit: topK,
    with_payload: true,
  });

  return results.map((r) => ({
    id: r.payload!.id as number,
    question: r.payload!.question as string,
    answer: r.payload!.answer as string,
    score: r.score,
  }));
}

export type DocChunkPoint = {
  id: number;
  documentId: number;
  fileName: string;
  text: string;
  startSeconds: number | null;
};

/** Индексация фрагментов учебного материала (точка = doc_chunks.id).
 * Эмбеддинги считаются пачками: транскрипт на 100+ фрагментов иначе упирается
 * в лимит запросов Mistral и обрывает загрузку на середине.
 * Каждая пачка пишется в Qdrant сразу, поэтому сбой на середине сохраняет
 * уже проиндексированное; `onProgress` сообщает вызывающему, сколько успело дойти. */
export async function upsertDocChunks(
  chunks: DocChunkPoint[],
  onProgress?: (indexed: number) => void
): Promise<void> {
  if (chunks.length === 0) return;

  await ensureDocsCollection();

  let indexed = 0;
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const vectors = await embedTexts(batch.map((c) => c.text));

    await qdrant.upsert(DOCS_COLLECTION, {
      points: batch.map((chunk, j) => ({
        id: chunk.id,
        vector: vectors[j],
        payload: {
          documentId: chunk.documentId,
          fileName: chunk.fileName,
          text: chunk.text,
          startSeconds: chunk.startSeconds,
        },
      })),
    });

    indexed += batch.length;
    onProgress?.(indexed);
  }
}

/** Удаление всех фрагментов документа из индекса (по payload.documentId). */
export async function deleteDocChunks(documentId: number): Promise<void> {
  try {
    await qdrant.delete(DOCS_COLLECTION, {
      filter: {
        must: [{ key: "documentId", match: { value: documentId } }],
      },
    });
  } catch {
    // Коллекции может ещё не быть — удалять нечего
  }
}

export interface ChunkSearchResult {
  fileName: string;
  text: string;
  startSeconds: number | null;
  score: number;
}

/** Поиск фрагментов материалов, похожих на вопрос (для генерации ответа). */
export async function searchDocChunks(
  query: string,
  topK = 4
): Promise<ChunkSearchResult[]> {
  const { collections } = await qdrant.getCollections();
  if (!collections.some((c) => c.name === DOCS_COLLECTION)) return [];

  const vector = await embedText(query);
  const results = await qdrant.search(DOCS_COLLECTION, {
    vector,
    limit: topK,
    with_payload: true,
  });

  return results.map((r) => ({
    fileName: r.payload!.fileName as string,
    text: r.payload!.text as string,
    startSeconds: (r.payload!.startSeconds as number | null) ?? null,
    score: r.score,
  }));
}
