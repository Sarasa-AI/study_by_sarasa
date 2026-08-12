import { z } from "zod";
import { generateStructuredData } from "@/lib/ai";
import {
  aiCaseGenerationSchema,
  aiRagCaseGenerationSchema,
  FALLBACK_REFERENCE_NOTE,
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
  /** True when generation used model base knowledge because RAG returned no matches. */
  isFallback: boolean;
};

// ─── Strict output contract sent to the model on every call ─────────────────
// Key names here MUST match the Zod schema in ai-schemas.ts exactly.
const SYSTEM_INSTRUCTION = [
  // Role & quality bar
  "You are a senior Pediatrics attending physician authoring board-style teaching cases.",
  "Output must be clinically accurate, age-appropriate, and educationally focused.",
  "",
  // ── CRITICAL JSON FORMAT RULES (violation causes a hard parsing failure) ───
  "CRITICAL OUTPUT RULES:",
  "1. Your ENTIRE response must be a single raw JSON object — nothing else.",
  "2. DO NOT wrap the JSON in markdown code fences (no ```json or ```).",
  "3. DO NOT include any text, commentary, or explanation outside the JSON object.",
  "",
  // ── Required top-level keys (exact names, matching the schema) ────────────
  "4. The JSON MUST contain ALL of the following top-level keys with EXACTLY these names:",
  '   "title", "chiefComplaint", "patientDemographics", "history", "physicalExam",',
  '   "labResults", "imaging", "symptoms", "diagnosis", "differentialDiagnosis",',
  '   "management", "teachingPoints", "questions".',
  '5. "patientDemographics" must be: { "age": <number or string>, "gender": <string> }.',
  '6. "symptoms", "differentialDiagnosis", and "teachingPoints" must be non-empty arrays of strings.',
  '7. "labResults" and "imaging" must be strings (use "" if not applicable).',
  "",
  // ── Required question-level keys ─────────────────────────────────────────
  '8. "questions" must be an array. Each element MUST have these exact keys:',
  '   "questionText", "optionA", "optionB", "optionC", "optionD",',
  '   "correctAnswer" (one of "A", "B", "C", or "D"),',
  '   "explanation", "clinicalReasoning", "distractorRationales".',
  '9. "distractorRationales" must be an object keyed by the three wrong option letters',
  "   (A|B|C|D, excluding correctAnswer), each value a non-empty explanation string.",
  "",
  // ── Clinical quality ──────────────────────────────────────────────────────
  "Use management and teachingPoints fields only (not deprecated alternatives).",
  "Each MCQ must test clinical reasoning (diagnosis or management) — never trivia.",
  "Provide a step-by-step clinicalReasoning for every correct answer.",
  "Return a questions array (not a single question object).",
].join("\n");

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
    "You must ground your clinical scenario and questions entirely on the provided guidelines.",
    "Base your clinical case ONLY on the following context.",
    "Do not hallucinate. Do not invent facts, labs, doses, or guidelines that are not supported by the context.",
    "If the context is incomplete for a detail, keep that detail general and clinically safe rather than inventing specifics.",
    "You MUST output a referenceText field detailing the exact guidelines used.",
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

/**
 * Normalises a raw question object from the model.
 * Fills in missing optional fields so Zod never throws over them.
 */
function patchQuestionFields(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const q = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...q };
  // These two fields are optional in the schema (default ""); ensure presence.
  out.clinicalReasoning = typeof out.clinicalReasoning === "string" ? out.clinicalReasoning : "";
  out.distractorRationales =
    out.distractorRationales && typeof out.distractorRationales === "object" && !Array.isArray(out.distractorRationales)
      ? out.distractorRationales
      : {};
  return out;
}

/**
 * Normalises a raw case object before Zod validation.
 *
 * Models occasionally use alternative key names (e.g. `historyOfPresentIllness`
 * instead of `history`) or omit optional string/array fields entirely.
 * This function remaps known aliases and fills safe empty defaults so that
 * Zod validation never hard-crashes over cosmetic naming drift.
 *
 * Existing keys always win — aliases are applied only when the canonical key
 * is absent.
 */
function patchCaseFields(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const obj = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...obj };

  // ── key-alias remapping (canonical key wins; alias fills gap) ────────────
  out.title           ??= obj.caseTitle ?? obj.case_title ?? "";
  out.chiefComplaint  ??= obj.chief_complaint ?? obj.presentingComplaint ?? obj.cc ?? "";
  out.history         ??= obj.historyOfPresentIllness ?? obj.hpi ?? obj.presentHistory ?? obj.history_of_present_illness ?? "";
  out.physicalExam    ??= obj.physicalExamination ?? obj.physical_exam ?? obj.exam ?? obj.pe ?? "";
  out.diagnosis       ??= obj.correctDiagnosis ?? obj.finalDiagnosis ?? obj.primaryDiagnosis ?? obj.dx ?? "";
  out.management      ??= obj.managementPlan ?? obj.treatment ?? obj.plan ?? obj.mx ?? "";
  out.labResults      ??= obj.lab_results ?? obj.labs ?? obj.laboratoryResults ?? "";
  out.imaging         ??= obj.imagingResults ?? obj.imaging_results ?? "";

  // ── ensure array fields are arrays ──────────────────────────────────────
  if (!Array.isArray(out.symptoms))              out.symptoms = [];
  if (!Array.isArray(out.differentialDiagnosis)) out.differentialDiagnosis = [];
  if (!Array.isArray(out.teachingPoints))        out.teachingPoints = [];
  if (!Array.isArray(out.questions))             out.questions = [];

  // ── ensure patientDemographics is an object with age + gender ────────────
  if (
    !out.patientDemographics ||
    typeof out.patientDemographics !== "object" ||
    Array.isArray(out.patientDemographics)
  ) {
    out.patientDemographics = {
      age:    obj.age ?? obj.patientAge ?? "نامشخص",
      gender: obj.gender ?? obj.patientGender ?? "نامشخص",
    };
  }

  // ── patch individual questions ────────────────────────────────────────────
  out.questions = (out.questions as unknown[]).map(patchQuestionFields);

  return out;
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
    maxTokens: 4000,
    patchParsed: patchCaseFields,
  });

  const normalized = normalizeAiCaseGeneration(raw as z.infer<typeof aiCaseGenerationSchema>);
  return enforceQuestionCount(normalized, questionCount);
}

/**
 * Grounded case generation: retrieve clinical chunks, inject into the system prompt,
 * and require referenceText. When the vector store has no matches, falls back to
 * ungrounded generation with isFallback=true and a Persian instructor note.
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
    const fallbackCase = await generateCaseWithAI({
      topic,
      categoryName: input.categoryName,
      difficulty: input.difficulty,
      questionCount,
    });

    return {
      case: { ...fallbackCase, referenceText: FALLBACK_REFERENCE_NOTE },
      retrievedDocuments: [],
      citationSources: [],
      isFallback: true,
    };
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
    maxTokens: 4000,
    patchParsed: patchCaseFields,
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
    isFallback: false,
  };
}
