export {
  chunkText,
  ingestClinicalText,
  type IngestClinicalTextResult,
} from "@/lib/rag/ingester";

export {
  embedText,
  similaritySearch,
  toVectorLiteral,
  vectorSql,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  type ClinicalDocumentMatch,
} from "@/lib/rag/vector-store";

export {
  generateCaseWithRAG,
  resolveCitationSources,
  type GenerateCaseWithRAGInput,
  type GenerateCaseWithRAGResult,
} from "@/lib/ai-case-generator";
