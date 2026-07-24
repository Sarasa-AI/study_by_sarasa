import OpenAI from "openai";
import { Prisma } from "@prisma/client";
import { getLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

export type ClinicalDocumentMatch = {
  id: string;
  title: string;
  content: string;
  source: string;
  metadata: Prisma.JsonValue;
  distance: number;
};

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required for embeddings");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/** Convert a float embedding to a pgvector literal (safe: numeric-only). */
export function toVectorLiteral(embedding: number[]): string {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected embedding length ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`,
    );
  }
  for (const value of embedding) {
    if (!Number.isFinite(value)) {
      throw new Error("Embedding contains non-finite values");
    }
  }
  return `[${embedding.join(",")}]`;
}

export function vectorSql(embedding: number[]): Prisma.Sql {
  return Prisma.raw(`'${toVectorLiteral(embedding)}'::vector`);
}

export async function embedText(text: string): Promise<number[]> {
  const input = text.trim();
  if (!input) {
    throw new Error("Cannot embed empty text");
  }

  const response = await getOpenAIClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error("OpenAI returned an invalid embedding");
  }
  return embedding;
}

export async function similaritySearch(
  query: string,
  limit = 3,
): Promise<ClinicalDocumentMatch[]> {
  const take = Math.max(1, Math.min(50, Math.floor(limit)));
  const startedAt = Date.now();

  const embedding = await embedText(query);
  const vec = vectorSql(embedding);

  const matches = await prisma.$queryRaw<ClinicalDocumentMatch[]>`
    SELECT
      id,
      title,
      content,
      source,
      metadata,
      (embedding <=> ${vec})::float8 AS distance
    FROM "ClinicalDocument"
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vec}
    LIMIT ${take}
  `;

  const durationMs = Date.now() - startedAt;
  getLogger().debug(
    {
      event: "rag.similaritySearch",
      durationMs,
      matchCount: matches.length,
      sources: matches.map((m) => m.source),
      queryLength: query.trim().length,
      limit: take,
    },
    "Vector similarity search completed",
  );

  return matches;
}
