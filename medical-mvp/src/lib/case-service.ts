import { type CasePayload } from "@/lib/case-schema";

type DbClient = {
  case: {
    findMany: (...args: any[]) => Promise<any>;
    findUnique: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
    delete: (...args: any[]) => Promise<any>;
  };
};

export const caseDetailsInclude = {
  category: true,
  questions: {
    orderBy: {
      orderIndex: "asc",
    },
  },
  instructor: {
    select: {
      id: true,
      name: true,
      role: true,
    },
  },
};

export function buildQuestionCreateData(questions: CasePayload["questions"]) {
  return questions.map((question: CasePayload["questions"][number], index: number) => {
    const clinicalReasoning = question.clinicalReasoning?.trim() || null;
    const distractorRationales = question.distractorRationales
      ? Object.fromEntries(
          Object.entries(question.distractorRationales).filter(
            ([, text]) => typeof text === "string" && text.trim().length > 0,
          ),
        )
      : null;

    return {
      questionText: question.questionText,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      clinicalReasoning,
      distractorRationales:
        distractorRationales && Object.keys(distractorRationales).length > 0
          ? distractorRationales
          : null,
      orderIndex: index,
    };
  });
}

export function buildCaseCreateData(payload: CasePayload) {
  return {
    title: payload.title,
    categoryId: payload.categoryId,
    instructorId: payload.instructorId,
    chiefComplaint: payload.chiefComplaint,
    patientInfo: payload.patientInfo,
    mediaUrl: payload.mediaUrl,
    mediaType: payload.mediaType,
    symptoms: payload.symptoms,
    diagnosis: payload.diagnosis,
    differentialDiagnosis: payload.differentialDiagnosis,
    management: payload.management,
    teachingPoints: payload.teachingPoints,
    status: payload.status,
    questions: {
      create: buildQuestionCreateData(payload.questions),
    },
  };
}

export async function listCases(db: DbClient, instructorId?: string | null) {
  return db.case.findMany({
    where: instructorId ? { instructorId } : undefined,
    include: caseDetailsInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getCaseById(db: DbClient, id: string) {
  return db.case.findUnique({
    where: { id },
    include: caseDetailsInclude,
  });
}

export async function createCase(db: DbClient, payload: CasePayload) {
  return db.case.create({
    data: buildCaseCreateData(payload),
    include: caseDetailsInclude,
  });
}

export async function updateCase(db: DbClient, id: string, payload: CasePayload) {
  return db.case.update({
    where: { id },
    data: {
      ...buildCaseCreateData(payload),
      questions: {
        deleteMany: {},
        create: buildQuestionCreateData(payload.questions),
      },
    },
    include: caseDetailsInclude,
  });
}

export async function deleteCaseById(db: DbClient, id: string) {
  return db.case.delete({
    where: { id },
  });
}

export function serializeCase(kase: Awaited<ReturnType<typeof getCaseById>>) {
  if (!kase) return null;

  return {
    ...kase,
    questions: kase.questions.map((question: any) => ({
      ...question,
      options: {
        A: question.optionA,
        B: question.optionB,
        C: question.optionC,
        D: question.optionD,
      },
    })),
  };
}
