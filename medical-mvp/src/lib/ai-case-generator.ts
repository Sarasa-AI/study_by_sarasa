import { z } from "zod";
import { generateStructuredData } from "@/lib/ai";
import {
  aiCaseGenerationSchema,
  normalizeAiCaseGeneration,
  type AiCaseGeneration,
} from "@/lib/ai-schemas";

export type CaseDifficulty = "EASY" | "MEDIUM" | "HARD";

export type GenerateCaseWithAIInput = {
  topic: string;
  categoryName: string;
  difficulty?: CaseDifficulty;
  questionCount?: number;
  isRemedial?: boolean;
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
