import OpenAI from "openai";
import { Prisma } from "@prisma/client";
import { getLogger, logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { isTransientOpenAIError, withRetry } from "@/lib/retry";

export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
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

function getOpenRouterClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is required for embeddings");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Medical MVP",
      },
    });
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

  try {
    const response = await withRetry(
      () =>
        getOpenRouterClient().embeddings.create({
          model: "openai/text-embedding-3-small",
          input,
        }),
      {
        operation: "embedding.create",
        isRetryable: isTransientOpenAIError,
      },
    );

    const embedding = response.data[0]?.embedding;
    if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error("Embedding provider returned an invalid embedding");
    }
    return embedding;
  } catch (error) {
    logError(getLogger(), {
      event: "embedding.failure",
      operation: "embedding.create",
      error,
      msg: "Embedding request failed",
    });
    throw error;
  }
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
