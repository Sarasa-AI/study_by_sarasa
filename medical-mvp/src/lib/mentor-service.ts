import { generateStructuredData } from "@/lib/ai";
import { mentorReplySchema } from "@/lib/ai-schemas";
import { getCaseById } from "@/lib/case-service";
import type { ClinicalMentorCaseContext, MentorChatMessage, MentorQuizContext } from "@/lib/mentor-types";
import { serializeQuizQuestions } from "@/lib/quiz";

type CaseWithQuestions = {
  id: string;
  title: string;
  chiefComplaint: string;
  patientInfo: string;
  symptoms: string[];
  diagnosis: string;
  differentialDiagnosis: string[];
  management: string;
  teachingPoints: string[];
  questions: Array<{
    id: string;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    orderIndex: number;
  }>;
};

export type MentorStudentContext = {
  weakAreas: string[];
};

type MentorCase = NonNullable<Awaited<ReturnType<typeof getCaseById>>>;

type MentorQuestion = {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation: string | null;
};

export type GenerateMentorReplyParams = {
  kase: MentorCase;
  history: MentorChatMessage[];
  quizContext?: MentorQuizContext;
  weakAreas?: string[];
};

export function buildMentorCaseContext(kase: CaseWithQuestions): ClinicalMentorCaseContext {
  const patient = JSON.parse(kase.patientInfo || "{}") as ClinicalMentorCaseContext["patientInfo"];

  return {
    id: kase.id,
    title: kase.title,
    chiefComplaint: kase.chiefComplaint,
    patientInfo: patient,
    symptoms: kase.symptoms,
    diagnosis: kase.diagnosis,
    differentialDiagnosis: kase.differentialDiagnosis,
    management: kase.management,
    teachingPoints: kase.teachingPoints,
    questions: serializeQuizQuestions(kase.questions).map(({ id, questionText, options }) => ({
      id,
      questionText,
      options,
    })),
  };
}

export function buildMentorSystemInstruction(weakAreaNames: string[]): string {
  const weakAreasText =
    weakAreaNames.length > 0 ? weakAreaNames.join(", ") : "none identified yet";

  return [
    "You are a Socratic Clinical Mentor for pediatric medical education simulations.",
    "",
    "CORE RULES:",
    "1. NEVER give direct answers, diagnoses, or solutions. Guide with questions.",
    "2. Use the Socratic method: one guiding question or logical step at a time.",
    "3. Encourage differential diagnosis reasoning and ask the student to explain pathophysiology.",
    '4. Language: Professional Persian (فارسی) intertwined with standard English medical terminology (e.g. "differential diagnosis", "pathophysiology").',
    "5. Keep replies concise: 1–2 short paragraphs maximum. Focus on ONE question or step.",
    "6. SAFETY: This is an educational simulation only. If asked for real-world advice about an actual patient, clearly refuse and redirect to seeking qualified clinical care. Never provide treatment recommendations for real patients.",
    "",
    "STUDENT PROFILE:",
    `This student struggles with: ${weakAreasText}.`,
    "Whenever the current case overlaps with these topics, ask deeper questions to reinforce their understanding.",
  ].join("\n");
}

function buildQuizContextSection(quizContext: MentorQuizContext | undefined, kase: MentorCase): string {
  if (!quizContext) return "Student quiz answers: not yet provided.";

  const questions = kase.questions as MentorQuestion[];
  const questionMap = Object.fromEntries(questions.map((q) => [q.id, q]));

  if (quizContext.result) {
    const lines = quizContext.result.feedback.map((item, index) => {
      const question = questionMap[item.questionId];
      const questionLabel = question?.questionText ?? item.questionId;
      return [
        `Question ${index + 1}: ${questionLabel}`,
        `  Selected: ${item.selected ?? "none"}`,
        `  Correct: ${item.isCorrect ? "yes" : "no"}`,
      ].join("\n");
    });
    return ["Student submitted quiz results:", ...lines].join("\n");
  }

  const answerLines = Object.entries(quizContext.answers)
    .filter(([, answer]) => answer)
    .map(([questionId, answer]) => {
      const question = questionMap[questionId];
      const questionLabel = question?.questionText ?? questionId;
      return `  - ${questionLabel}: ${answer}`;
    });

  if (answerLines.length === 0) {
    return "Student quiz answers: in progress, no selections yet.";
  }

  return ["Student in-progress quiz answers:", ...answerLines].join("\n");
}

export function buildMentorPrompt(
  kase: MentorCase,
  history: MentorChatMessage[],
  quizContext?: MentorQuizContext,
  weakAreas: string[] = [],
): string {
  const patient = JSON.parse(kase.patientInfo || "{}") as Record<string, unknown>;
  const weakAreasText =
    weakAreas.length > 0 ? weakAreas.join(", ") : "none identified yet";

  const studentProfileSection = [
    "## Student Profile",
    `This student struggles with: ${weakAreasText}.`,
    "Whenever the current case overlaps with these topics, ask deeper questions to reinforce their understanding.",
  ].join("\n");

  const caseSection = [
    "## Case Context",
    `Title: ${kase.title}`,
    `Chief complaint: ${kase.chiefComplaint}`,
    `Patient demographics: age=${patient.age ?? "unknown"}, gender=${patient.gender ?? "unknown"}`,
    `History: ${patient.history ?? "not provided"}`,
    `Physical exam: ${patient.physicalExam ?? "not provided"}`,
    `Lab results: ${patient.labResults ?? "not provided"}`,
    `Imaging: ${patient.imaging ?? "not provided"}`,
    `Symptoms: ${kase.symptoms.join("; ")}`,
    `Diagnosis: ${kase.diagnosis}`,
    `Differential diagnosis: ${kase.differentialDiagnosis.join("; ")}`,
    `Management: ${kase.management}`,
    `Teaching points: ${kase.teachingPoints.join("; ")}`,
  ].join("\n");

  const questionsSection = [
    "## Quiz Questions (with correct answers — for mentoring only; never reveal correct answers; only guide reasoning)",
    ...(kase.questions as MentorQuestion[]).map((q, index) =>
      [
        `Question ${index + 1}: ${q.questionText}`,
        `  A: ${q.optionA}`,
        `  B: ${q.optionB}`,
        `  C: ${q.optionC}`,
        `  D: ${q.optionD}`,
        `  Correct answer: ${q.correctAnswer}`,
        `  Explanation: ${q.explanation ?? "none"}`,
      ].join("\n"),
    ),
  ].join("\n\n");

  const quizSection = buildQuizContextSection(quizContext, kase);

  const historySection =
    history.length > 0
      ? [
          "## Conversation History",
          ...history.map((msg) => `${msg.role === "user" ? "Student" : "Mentor"}: ${msg.content}`),
        ].join("\n")
      : "## Conversation History\n(no prior messages)";

  return [
    studentProfileSection,
    caseSection,
    questionsSection,
    `## Student Quiz State\n${quizSection}`,
    historySection,
    "## Instruction",
    "Respond to the student's latest message as the Socratic Clinical Mentor.",
    'Return JSON with "reply" (your mentor response in professional Persian with English medical terms) and optional "clinicalReasoning" (array of key reasoning points).',
  ].join("\n\n");
}

export async function generateMentorReply({
  kase,
  history,
  quizContext,
  weakAreas = [],
}: GenerateMentorReplyParams) {
  return generateStructuredData({
    operation: "mentor-reply",
    schema: mentorReplySchema,
    systemInstruction: buildMentorSystemInstruction(weakAreas),
    prompt: buildMentorPrompt(kase, history, quizContext, weakAreas),
  });
}
