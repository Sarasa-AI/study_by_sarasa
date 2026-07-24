import { z } from "zod";
import { generateStructuredData } from "@/lib/ai";
import {
  aiCaseGenerationSchema,
  aiRagCaseGenerationSchema,
  normalizeAiCaseGeneration,
  normalizeAiRagCaseGeneration,
  type AiCaseGeneration,
  type AiRagCaseGeneration,
} from "@/lib/ai-schemas";
import {
  similaritySearch,
  type ClinicalDocumentMatch,
} from "@/lib/rag/vector-store";

export type CaseDifficulty = "EASY" | "MEDIUM" | "HARD";

export type GenerateCaseWithAIInput = {
  topic: string;
  categoryName: string;
  difficulty?: CaseDifficulty;
  questionCount?: number;
  isRemedial?: boolean;
};

export type GenerateCaseWithRAGInput = {
  topic: string;
  categoryName: string;
  difficulty?: CaseDifficulty;
  questionCount?: number;
  retrievalLimit?: number;
};

export type GenerateCaseWithRAGResult = {
  case: AiRagCaseGeneration;
  retrievedDocuments: ClinicalDocumentMatch[];
  /** Authoritative source strings from the vector store (Tier 0 citations). */
  citationSources: string[];
};

const SYSTEM_INSTRUCTION = [
  "You are a senior Pediatrics attending physician authoring board-style teaching cases.",
  "Output must be clinically accurate, age-appropriate, and educationally focused.",
  "Use management and teachingPoints fields (not deprecated alternatives).",
  "Use optionA–optionD and correctAnswer (A|B|C|D) for each question.",
  "For every multiple-choice question, you must provide a step-by-step clinicalReasoning for the correct answer, and detailed distractorRationales explaining EXACTLY why each incorrect option is wrong.",
  "distractorRationales must be an object keyed by the three incorrect option letters (A|B|C|D excluding correctAnswer).",
  "Return a questions array (not a single question object).",
].join(" ");

const REMEDIAL_INSTRUCTION = [
  "This student is struggling with this category.",
  "Focus the case on the core concepts, common diagnostic pitfalls, and pathophysiology related to this topic to help them improve their understanding.",
  "Treat this as a Targeted Practice session.",
].join(" ");

function buildSystemInstruction(isRemedial: boolean): string {
  if (!isRemedial) return SYSTEM_INSTRUCTION;
  return [SYSTEM_INSTRUCTION, REMEDIAL_INSTRUCTION].join(" ");
}

function clampQuestionCount(questionCount?: number): number {
  const n = Number.isFinite(questionCount) ? Math.floor(questionCount as number) : 1;
  return Math.min(3, Math.max(1, n));
}

function buildClinicalPrompt(params: {
  categoryName: string;
  topic: string;
  questionCount: number;
  difficulty?: CaseDifficulty;
  isRemedial: boolean;
}): string {
  const focus = params.topic.trim()
    ? `Focus the case on: "${params.topic.trim()}".`
    : `Choose a high-yield pediatric topic appropriate for the "${params.categoryName}" category.`;

  const difficultyLine = params.difficulty
    ? `Target difficulty level: ${params.difficulty} (calibrate vignette complexity and MCQ discrimination accordingly).`
    : null;

  const lines = [
    "Generate one complete pediatric clinical teaching case.",
    focus,
    difficultyLine,
    `Include exactly ${params.questionCount} multiple-choice question(s) in the "questions" array.`,
    "Use evidence-based content aligned with Nelson Textbook of Pediatrics and UpToDate pediatric guidelines.",
    "Write clinical content in Persian (Farsi). Use standard medical abbreviations where appropriate.",
    "Include realistic age-appropriate presentation, vitals, exam findings, labs, and imaging when relevant.",
    "Each MCQ must test clinical reasoning (diagnosis or management), not trivia.",
    "Provide high-yield teachingPoints suitable for board review.",
    "Return JSON matching the required schema exactly.",
  ].filter((line): line is string => Boolean(line));

  if (params.isRemedial) {
    lines.splice(
      2,
      0,
      `This is a Targeted Practice session for the "${params.categoryName}" category — emphasize core concepts and common pitfalls.`,
    );
  }

  return lines.join("\n");
}

function buildRagContext(documents: ClinicalDocumentMatch[]): string {
  return documents
    .map((doc, index) => {
      return [
        `--- Context ${index + 1} ---`,
        `source: ${doc.source}`,
        `title: ${doc.title}`,
        doc.content,
      ].join("\n");
    })
    .join("\n\n");
}

function buildRagSystemInstruction(documents: ClinicalDocumentMatch[]): string {
  const allowedSources = [...new Set(documents.map((d) => d.source))];
  const context = buildRagContext(documents);

  return [
    "You are a pediatric board examiner.",
    "Base your clinical case ONLY on the following context.",
    "Do not hallucinate. Do not invent facts, labs, doses, or guidelines that are not supported by the context.",
    "If the context is incomplete for a detail, keep that detail general and clinically safe rather than inventing specifics.",
    `Set referenceText to exactly one of these source strings (copy verbatim): ${JSON.stringify(allowedSources)}.`,
    "",
    "CONTEXT:",
    context,
    "",
    SYSTEM_INSTRUCTION,
  ].join("\n");
}

function enforceQuestionCount<T extends { questions: unknown[] }>(
  normalized: T,
  questionCount: number,
): T {
  if (normalized.questions.length > questionCount) {
    return {
      ...normalized,
      questions: normalized.questions.slice(0, questionCount),
    };
  }

  if (normalized.questions.length < questionCount) {
    throw new Error(
      `AI returned ${normalized.questions.length} question(s); expected ${questionCount}`,
    );
  }

  return normalized;
}

/**
 * Resolve authoritative citation sources from retrieved docs.
 * Prefer a retrieved source that matches model referenceText; otherwise use all unique retrieved sources.
 */
export function resolveCitationSources(
  documents: ClinicalDocumentMatch[],
  referenceText: string,
): string[] {
  const uniqueSources = [...new Set(documents.map((d) => d.source).filter(Boolean))];
  if (uniqueSources.length === 0) return [];

  const matched = uniqueSources.find((source) => source === referenceText.trim());
  if (matched) return [matched];

  // Tier 0: never trust an unmatched model citation — fall back to retrieved sources.
  return uniqueSources;
}

export async function generateCaseWithAI(input: GenerateCaseWithAIInput): Promise<AiCaseGeneration> {
  const questionCount = clampQuestionCount(input.questionCount);
  const isRemedial = Boolean(input.isRemedial);

  const raw = await generateStructuredData({
    operation: "case-generation",
    schema: aiCaseGenerationSchema,
    systemInstruction: buildSystemInstruction(isRemedial),
    prompt: buildClinicalPrompt({
      categoryName: input.categoryName,
      topic: input.topic,
      questionCount,
      difficulty: input.difficulty,
      isRemedial,
    }),
  });

  const normalized = normalizeAiCaseGeneration(raw as z.infer<typeof aiCaseGenerationSchema>);
  return enforceQuestionCount(normalized, questionCount);
}

/**
 * Grounded case generation: retrieve clinical chunks, inject into the system prompt,
 * and require referenceText. Refuses to generate when the vector store has no matches.
 */
export async function generateCaseWithRAG(
  input: GenerateCaseWithRAGInput,
): Promise<GenerateCaseWithRAGResult> {
  const topic = input.topic.trim();
  if (!topic) {
    throw new Error("topic is required for RAG case generation");
  }

  const questionCount = clampQuestionCount(input.questionCount);
  const retrievalLimit = input.retrievalLimit ?? 3;

  const retrievedDocuments = await similaritySearch(topic, retrievalLimit);
  if (retrievedDocuments.length === 0) {
    throw new Error(
      "No clinical documents matched this topic. Ingest knowledge-base content before using RAG generation.",
    );
  }

  const raw = await generateStructuredData({
    operation: "case-generation",
    schema: aiRagCaseGenerationSchema,
    systemInstruction: buildRagSystemInstruction(retrievedDocuments),
    prompt: buildClinicalPrompt({
      categoryName: input.categoryName,
      topic,
      questionCount,
      difficulty: input.difficulty,
      isRemedial: false,
    }),
  });

  const normalized = enforceQuestionCount(
    normalizeAiRagCaseGeneration(raw as z.infer<typeof aiRagCaseGenerationSchema>),
    questionCount,
  );

  const citationSources = resolveCitationSources(retrievedDocuments, normalized.referenceText);

  return {
    case: {
      ...normalized,
      // Align model output with authoritative retrieved source when possible.
      referenceText: citationSources[0] ?? normalized.referenceText,
    },
    retrievedDocuments,
    citationSources,
  };
}
