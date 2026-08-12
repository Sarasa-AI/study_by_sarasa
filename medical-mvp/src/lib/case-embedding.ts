import { Prisma } from "@prisma/client";
import { embedText, vectorSql } from "@/lib/rag/vector-store";

export type CaseEmbeddingFields = {
  title: string;
  chiefComplaint: string;
  patientInfo: string;
  symptoms: string[];
  diagnosis: string;
  differentialDiagnosis: string[];
  management: string;
  teachingPoints: string[];
};

type ExecuteRawClient = {
  $executeRaw: (query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => Promise<unknown>;
};

/** Join the full clinical narrative into a single string for embedding. */
export function buildCaseEmbeddingText(fields: CaseEmbeddingFields): string {
  const parts = [
    fields.title,
    fields.chiefComplaint,
    fields.patientInfo,
    ...fields.symptoms,
    fields.diagnosis,
    ...fields.differentialDiagnosis,
    fields.management,
    ...fields.teachingPoints,
  ];

  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join("\n");
}

/** Short UI snippet derived from presentation fields (no dedicated clinicalScenario column). */
export function buildCaseScenarioSnippet(
  chiefComplaint: string,
  patientInfo: string,
  maxLen = 180,
): string {
  const combined = [chiefComplaint.trim(), patientInfo.trim()].filter(Boolean).join(" — ");
  if (combined.length <= maxLen) return combined;
  return `${combined.slice(0, maxLen - 1).trimEnd()}…`;
}

/**
 * Embed narrative text and store on Case.embedding via raw SQL
 * (Prisma cannot write Unsupported("vector") through normal create/update).
 */
export async function saveCaseEmbedding(
  db: ExecuteRawClient,
  caseId: string,
  text: string,
): Promise<void> {
  const embedding = await embedText(text);
  const vec = vectorSql(embedding);

  await db.$executeRaw`
    UPDATE "Case"
    SET embedding = ${vec}
    WHERE id = ${caseId}
  `;
}

export async function embedAndStoreCase(
  db: ExecuteRawClient,
  caseId: string,
  fields: CaseEmbeddingFields,
): Promise<void> {
  const text = buildCaseEmbeddingText(fields);
  if (!text.trim()) {
    throw new Error("Cannot embed case with empty narrative text");
  }
  await saveCaseEmbedding(db, caseId, text);
}
