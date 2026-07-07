import { mistral } from "../mistral";
import { qdrant, COLLECTION, VECTOR_SIZE } from "./client";

export async function ensureCollection(): Promise<void> {
  const { collections } = await qdrant.getCollections();
  const exists = collections.some((c) => c.name === COLLECTION);
  if (exists) return;

  await qdrant.createCollection(COLLECTION, {
    vectors: { size: VECTOR_SIZE, distance: "Cosine" },
  });
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
