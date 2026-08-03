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

export async function embedText(text: string): Promise<number[]> {
  const maxRetries = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await mistral.embeddings.create({
        model: "mistral-embed",
        inputs: [text],
      });
      return response.data[0].embedding!;
    } catch (err) {
      lastError = err;
      const statusCode =
        err && typeof err === "object" && "statusCode" in err
          ? (err as { statusCode: number }).statusCode
          : null;
      if (statusCode === 429 && attempt < maxRetries) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
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

/** Индексация фрагмента учебного материала (точка = doc_chunks.id). */
export async function upsertDocChunk(chunk: {
  id: number;
  documentId: number;
  fileName: string;
  text: string;
  startSeconds: number | null;
}): Promise<void> {
  await ensureDocsCollection();
  const vector = await embedText(chunk.text);
  await qdrant.upsert(DOCS_COLLECTION, {
    points: [
      {
        id: chunk.id,
        vector,
        payload: {
          documentId: chunk.documentId,
          fileName: chunk.fileName,
          text: chunk.text,
          startSeconds: chunk.startSeconds,
        },
      },
    ],
  });
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
