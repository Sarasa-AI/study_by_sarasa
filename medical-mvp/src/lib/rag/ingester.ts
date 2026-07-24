import { createHash, randomBytes } from "crypto";
import { getLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { embedText, vectorSql } from "@/lib/rag/vector-store";

const DEFAULT_MAX_CHUNK_CHARS = 1800;

export type IngestClinicalTextResult = {
  chunkCount: number;
  documentIds: string[];
};

function createDocumentId(): string {
  return `cld_${randomBytes(12).toString("hex")}`;
}

/**
 * Split clinical text into paragraph-aware chunks under maxChars.
 * Oversized paragraphs are hard-split; short adjacent paragraphs are merged.
 */
export function chunkText(content: string, maxChars = DEFAULT_MAX_CHUNK_CHARS): string[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) {
      chunks.push(current.trim());
      current = "";
    }
  };

  const pushHardSplit = (text: string) => {
    for (let i = 0; i < text.length; i += maxChars) {
      const piece = text.slice(i, i + maxChars).trim();
      if (piece) chunks.push(piece);
    }
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      pushCurrent();
      pushHardSplit(paragraph);
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChars) {
      pushCurrent();
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  pushCurrent();
  return chunks.filter(Boolean);
}

export async function ingestClinicalText(
  title: string,
  content: string,
  source: string,
  metadata: Record<string, unknown> = {},
): Promise<IngestClinicalTextResult> {
  const trimmedTitle = title.trim();
  const trimmedSource = source.trim();
  if (!trimmedTitle) throw new Error("title is required");
  if (!trimmedSource) throw new Error("source is required");

  const chunks = chunkText(content);
  if (chunks.length === 0) {
    throw new Error("content produced no chunks to ingest");
  }

  const contentHash = createHash("sha256").update(content).digest("hex").slice(0, 16);
  const documentIds: string[] = [];
  const startedAt = Date.now();

  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index]!;
    const embedding = await embedText(chunk);
    const id = createDocumentId();
    const now = new Date();
    const chunkMetadata = {
      ...metadata,
      chunkIndex: index,
      chunkCount: chunks.length,
      contentHash,
    };
    const metadataJson = JSON.stringify(chunkMetadata);
    const vec = vectorSql(embedding);

    await prisma.$executeRaw`
      INSERT INTO "ClinicalDocument" (
        id, title, content, source, metadata, embedding, "createdAt", "updatedAt"
      ) VALUES (
        ${id},
        ${trimmedTitle},
        ${chunk},
        ${trimmedSource},
        ${metadataJson}::jsonb,
        ${vec},
        ${now},
        ${now}
      )
    `;

    documentIds.push(id);
  }

  getLogger().info(
    {
      event: "rag.ingest",
      durationMs: Date.now() - startedAt,
      chunkCount: chunks.length,
      source: trimmedSource,
      title: trimmedTitle,
    },
    "Clinical text ingested into vector store",
  );

  return { chunkCount: chunks.length, documentIds };
}
