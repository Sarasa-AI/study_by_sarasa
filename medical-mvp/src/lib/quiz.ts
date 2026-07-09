import { z } from "zod";
import { answerOptions } from "@/lib/case-schema";
import { prisma } from "@/lib/prisma";

export type AnswerMap = Record<string, string>;

export type QuizQuestionView = {
  id: string;
  questionText: string;
  options: Record<(typeof answerOptions)[number], string>;
  orderIndex: number;
};

export type QuestionFeedback = {
  questionId: string;
  selected: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string | null;
};

export type QuizResultData = {
  resultId: string;
  score: number;
  total: number;
  percent: number;
  feedback: QuestionFeedback[];
  xp: XpResult;
  streak: StreakResult;
  isNewStreakMilestone: boolean;
};

export type QuizAttemptInput = {
  correctCount: number;
  completionTimeSeconds: number | null;
  currentStreak: number;
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

export type CategoryPerformance = {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  averageScore: number;
  attempts: number;
};

export type PerformanceData = {
  totalCasesCompleted: number;
  averageScore: number;
  totalXp: number;
  currentStreak: number;
  categoryScores: CategoryPerformance[];
  weakAreas: CategoryPerformance[];
};

type GradingQuestion = {
  id: string;
  correctAnswer: string;
  explanation: string | null;
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

type QuizAnswerOption = (typeof answerOptions)[number];
export type QuizFormValues = Record<string, QuizAnswerOption>;

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

  const feedback: QuestionFeedback[] = questions.map((question) => {
    const selected = answers[question.id] ?? null;
    const isCorrect = selected === question.correctAnswer;
    return {
      questionId: question.id,
      selected,
      correctAnswer: question.correctAnswer,
      isCorrect,
      explanation: isCorrect ? null : question.explanation ?? "توضیحی ثبت نشده است",
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

export function calculateQuizXp(attempt: QuizAttemptInput): XpResult {
  const basePoints = attempt.correctCount * 10;
  const speedBonus =
    attempt.completionTimeSeconds !== null && attempt.completionTimeSeconds <= 300 ? 20 : 0;
  const streakBonus = attempt.currentStreak >= 3 ? 50 : 0;
  return {
    basePoints,
    speedBonus,
    streakBonus,
    total: basePoints + speedBonus + streakBonus,
  };
}

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDayDiff(later: Date, earlier: Date): number {
  const laterMs = Date.parse(`${utcDayKey(later)}T00:00:00.000Z`);
  const earlierMs = Date.parse(`${utcDayKey(earlier)}T00:00:00.000Z`);
  return Math.round((laterMs - earlierMs) / (24 * 60 * 60 * 1000));
}

export function calculateStreak(
  lastCompletedAt: Date | null,
  now: Date,
  currentStreak: number,
): StreakResult {
  if (!lastCompletedAt) {
    return { newStreak: 1, streakBroken: false, isNewMilestone: false };
  }

  const hoursSince = (now.getTime() - lastCompletedAt.getTime()) / (1000 * 60 * 60);
  if (hoursSince > 48) {
    return { newStreak: 1, streakBroken: true, isNewMilestone: false };
  }

  const dayDiff = utcDayDiff(now, lastCompletedAt);
  if (dayDiff === 0) {
    return { newStreak: currentStreak, streakBroken: false, isNewMilestone: false };
  }
  if (dayDiff === 1) {
    const newStreak = currentStreak + 1;
    return { newStreak, streakBroken: false, isNewMilestone: newStreak === 3 };
  }

  return { newStreak: 1, streakBroken: true, isNewMilestone: false };
}

function toPercent(score: number, total: number): number {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export async function getStudentPerformance(userId: string): Promise<PerformanceData> {
  const [user, results] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { totalXp: true, currentStreak: true },
    }),
    prisma.quizResult.findMany({
    where: { userId },
    select: {
      score: true,
      totalQuestions: true,
      completedAt: true,
      case: {
        select: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
    },
    orderBy: { completedAt: "desc" },
    }),
  ]);

  const totalCasesCompleted = results.length;
  const averageScore =
    totalCasesCompleted > 0
      ? Math.round(
          results.reduce((sum, r) => sum + toPercent(r.score, r.totalQuestions), 0) / totalCasesCompleted,
        )
      : 0;

  const categoryMap = new Map<string, { name: string; slug: string; scores: number[] }>();
  for (const result of results) {
    const { category } = result.case;
    const entry = categoryMap.get(category.id) ?? { name: category.name, slug: category.slug, scores: [] };
    entry.scores.push(toPercent(result.score, result.totalQuestions));
    categoryMap.set(category.id, entry);
  }

  const categoryScores: CategoryPerformance[] = [...categoryMap.entries()]
    .map(([categoryId, { name, slug, scores }]) => ({
      categoryId,
      categoryName: name,
      categorySlug: slug,
      averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      attempts: scores.length,
    }))
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName, "fa"));

  const weakAreas = categoryScores.filter((c) => c.averageScore < 60);

  return {
    totalCasesCompleted,
    averageScore,
    totalXp: user.totalXp,
    currentStreak: user.currentStreak,
    categoryScores,
    weakAreas,
  };
}
