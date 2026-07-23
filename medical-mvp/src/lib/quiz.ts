import { z } from "zod";
import { answerOptions } from "@/lib/case-schema";

export type AnswerMap = Record<string, string>;

type QuizAnswerOption = (typeof answerOptions)[number];
export type QuizFormValues = Record<string, QuizAnswerOption>;
export type DistractorRationales = Partial<Record<QuizAnswerOption, string>>;

export function parseDistractorRationales(value: unknown): DistractorRationales | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result: DistractorRationales = {};
  for (const key of answerOptions) {
    const text = (value as Record<string, unknown>)[key];
    if (typeof text === "string" && text.trim()) {
      result[key] = text.trim();
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

export type QuizQuestionView = {
  id: string;
  questionText: string;
  options: Record<(typeof answerOptions)[number], string>;
  orderIndex: number;
};

export type GradedQuestionFeedback = {
  questionId: string;
  selected: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string | null;
  clinicalReasoning: string | null;
  distractorRationales: DistractorRationales | null;
};

export type GamificationSummary = {
  xpEarned: number;
  newStreak: number;
  streakMaintained: boolean;
};

export type NewAchievementNotice = {
  code: string;
  title: string;
  description: string;
  icon: string;
};

export type QuizResultData = {
  resultId: string;
  score: number;
  total: number;
  percent: number;
  feedback: GradedQuestionFeedback[];
  xp: XpResult;
  streak: StreakResult;
  isNewStreakMilestone: boolean;
  gamification: GamificationSummary;
  newAchievements?: NewAchievementNotice[];
};

export type XpResult = {
  basePoints: number;
  speedBonus: number;
  streakBonus: number;
  total: number;
};

export type StreakResult = {
  newStreak: number;
  streakBroken: boolean;
  isNewMilestone: boolean;
};

export const ZERO_XP: XpResult = {
  basePoints: 0,
  speedBonus: 0,
  streakBonus: 0,
  total: 0,
};

export type QuizActionResult = {
  success: boolean;
  message: string;
  data?: QuizResultData;
};

type GradingQuestion = {
  id: string;
  correctAnswer: string;
  explanation: string | null;
  clinicalReasoning: string | null;
  distractorRationales: DistractorRationales | null;
  points: number;
};

type QuizQuestionRecord = {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  orderIndex: number;
};

const answerOptionSchema = z.enum(answerOptions);

export function scoreAnswers(correct: Record<string, { answer: string; points: number }>, user: AnswerMap) {
  let score = 0;
  let total = 0;
  for (const [qid, meta] of Object.entries(correct)) {
    total += meta.points;
    if (user[qid] && user[qid] === meta.answer) {
      score += meta.points;
    }
  }
  return { score, total };
}

export function serializeQuizQuestions(questions: QuizQuestionRecord[]): QuizQuestionView[] {
  return questions.map((question) => ({
    id: question.id,
    questionText: question.questionText,
    orderIndex: question.orderIndex,
    options: {
      A: question.optionA,
      B: question.optionB,
      C: question.optionC,
      D: question.optionD,
    },
  }));
}

export function buildCorrectMap(questions: Pick<GradingQuestion, "id" | "correctAnswer" | "points">[]) {
  const correctMap: Record<string, { answer: string; points: number }> = {};
  for (const question of questions) {
    correctMap[question.id] = { answer: question.correctAnswer, points: question.points };
  }
  return correctMap;
}

export function gradeQuiz(questions: GradingQuestion[], answers: AnswerMap) {
  const correctMap = buildCorrectMap(questions);
  const { score, total } = scoreAnswers(correctMap, answers);

  const feedback: GradedQuestionFeedback[] = questions.map((question) => {
    const selected = answers[question.id] ?? null;
    const isCorrect = selected === question.correctAnswer;
    return {
      questionId: question.id,
      selected,
      correctAnswer: question.correctAnswer,
      isCorrect,
      explanation: isCorrect ? null : question.explanation ?? "توضیحی ثبت نشده است",
      clinicalReasoning: question.clinicalReasoning ?? null,
      distractorRationales: question.distractorRationales ?? null,
    };
  });

  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  return { score, total, percent, feedback };
}

export function buildQuizAnswersSchema(questionIds: string[]) {
  const shape = Object.fromEntries(
    questionIds.map((id) => [id, answerOptionSchema]),
  ) as Record<string, typeof answerOptionSchema>;

  return z.object(shape);
}

export function validateQuizAnswers(questionIds: string[], answers: AnswerMap) {
  if (questionIds.length === 0) {
    throw new Error("هیچ سوالی برای اعتبارسنجی وجود ندارد");
  }

  return buildQuizAnswersSchema(questionIds).parse(answers);
}
