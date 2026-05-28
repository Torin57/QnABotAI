import { QdrantClient } from "@qdrant/js-client-rest";

export const qdrant = new QdrantClient({
  host: process.env.QDRANT_HOST ?? "localhost",
  port: Number(process.env.QDRANT_PORT ?? 6333),
});

export const COLLECTION = "qna";
export const VECTOR_SIZE = 1024;
