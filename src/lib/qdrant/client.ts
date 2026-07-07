import { QdrantClient } from "@qdrant/js-client-rest";

export const qdrant = new QdrantClient({
  host: process.env.QDRANT_HOST ?? "localhost",
  port: Number(process.env.QDRANT_PORT ?? 6333),
});

const collection = process.env.QDRANT_COLLECTION?.trim();
if (!collection) {
  throw new Error(
    "QDRANT_COLLECTION не задан. Проверьте .env.{APP_ENV}.local (см. Docs/spec.md §7.1)."
  );
}

export const COLLECTION = collection;
export const VECTOR_SIZE = 1024;
