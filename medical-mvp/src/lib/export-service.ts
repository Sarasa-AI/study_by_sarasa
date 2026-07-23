import { prisma } from "@/lib/prisma";
import { answerOptions } from "@/lib/case-schema";

export type StudyNotesType = "all" | "mistakes_only" | "high_yield";

export type StudyNotesFilters = {
  categoryId?: string;
  type?: StudyNotesType;
};

export type StudyNotesQuestion = {
  id: string;
  questionText: string;
  options: Record<(typeof answerOptions)[number], string>;
  correctAnswer: string;
  explanation: string;
  clinicalReasoning: string | null;
  orderIndex: number;
};

export type StudyNotesCaseItem = {
  id: string;
  title: string;
  diagnosis: string;
  teachingPoints: string[];
  categoryName: string;
  questions: StudyNotesQuestion[];
};

export type StudyNotesMistakeItem = {
  mistakeId: string;
  questionText: string;
  options: Record<(typeof answerOptions)[number], string>;
  correctAnswer: string;
  explanation: string;
  clinicalReasoning: string | null;
  caseTitle: string;
  categoryName: string;
};

export type StudyNotesData = {
  cases: StudyNotesCaseItem[];
  mistakes: StudyNotesMistakeItem[];
  type: StudyNotesType;
  categoryId?: string;
};

type QuestionRow = {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation: string;
  clinicalReasoning: string | null;
  orderIndex: number;
};

function mapQuestionOptions(question: QuestionRow): StudyNotesQuestion {
  return {
    id: question.id,
    questionText: question.questionText,
    options: {
      A: question.optionA,
      B: question.optionB,
      C: question.optionC,
      D: question.optionD,
    },
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    clinicalReasoning: question.clinicalReasoning,
    orderIndex: question.orderIndex,
  };
}

const questionSelect = {
  id: true,
  questionText: true,
  optionA: true,
  optionB: true,
  optionC: true,
  optionD: true,
  correctAnswer: true,
  explanation: true,
  clinicalReasoning: true,
  orderIndex: true,
} as const;

async function fetchHighYieldCases(categoryId?: string): Promise<StudyNotesCaseItem[]> {
  const cases = await prisma.case.findMany({
    where: {
      status: "PUBLISHED",
      ...(categoryId ? { categoryId } : {}),
      NOT: { teachingPoints: { equals: [] } },
    },
    orderBy: [{ category: { orderIndex: "asc" } }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      diagnosis: true,
      teachingPoints: true,
      category: { select: { name: true } },
      questions: {
        orderBy: { orderIndex: "asc" },
        select: questionSelect,
      },
    },
  });

  return cases
    .filter((kase) => kase.teachingPoints.length > 0)
    .map((kase) => ({
      id: kase.id,
      title: kase.title,
      diagnosis: kase.diagnosis,
      teachingPoints: kase.teachingPoints,
      categoryName: kase.category.name,
      questions: kase.questions.map(mapQuestionOptions),
    }));
}

async function fetchUnresolvedMistakes(
  userId: string,
  categoryId?: string,
): Promise<StudyNotesMistakeItem[]> {
  const mistakes = await prisma.questionMistake.findMany({
    where: {
      userId,
      isResolved: false,
      ...(categoryId
        ? {
            question: {
              case: { categoryId },
            },
          }
        : {}),
    },
    orderBy: { updatedAt: "asc" },
    include: {
      question: {
        select: {
          ...questionSelect,
          case: {
            select: {
              title: true,
              category: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return mistakes.map((mistake) => {
    const mapped = mapQuestionOptions(mistake.question);
    return {
      mistakeId: mistake.id,
      questionText: mapped.questionText,
      options: mapped.options,
      correctAnswer: mapped.correctAnswer,
      explanation: mapped.explanation,
      clinicalReasoning: mapped.clinicalReasoning,
      caseTitle: mistake.question.case.title,
      categoryName: mistake.question.case.category.name,
    };
  });
}

export async function getStudyNotesData(
  userId: string,
  filters?: StudyNotesFilters,
): Promise<StudyNotesData> {
  const type: StudyNotesType = filters?.type ?? "high_yield";
  const categoryId = filters?.categoryId || undefined;

  const includeCases = type === "high_yield" || type === "all";
  const includeMistakes = type === "mistakes_only" || type === "all";

  const [cases, mistakes] = await Promise.all([
    includeCases ? fetchHighYieldCases(categoryId) : Promise.resolve([]),
    includeMistakes ? fetchUnresolvedMistakes(userId, categoryId) : Promise.resolve([]),
  ]);

  return {
    cases,
    mistakes,
    type,
    categoryId,
  };
}
