import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { ZodError } from "zod";
import {
  type CaseActionResult,
  type CaseFormValues,
  type CasePayload,
  type CaseStatusValue,
  formatZodError,
  toCasePayload,
} from "@/lib/case-schema";
import { prisma } from "@/lib/prisma";

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
  return questions.map((question: CasePayload["questions"][number], index: number) => ({
    questionText: question.questionText,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    orderIndex: index,
  }));
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

async function resolveInstructorId(): Promise<string | null> {
  const session = await getServerSession();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

function handleActionError(error: unknown): CaseActionResult {
  if (error instanceof ZodError) {
    return { success: false, message: formatZodError(error) };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      return { success: false, message: "دسته‌بندی انتخاب‌شده معتبر نیست" };
    }
    return { success: false, message: "خطا در ذخیره‌سازی داده" };
  }

  return { success: false, message: "خطای سرور" };
}

export async function createCaseAction(values: CaseFormValues, status: CaseStatusValue): Promise<CaseActionResult> {
  "use server";

  const instructorId = await resolveInstructorId();
  if (!instructorId) {
    return { success: false, message: "برای ایجاد کیس باید وارد شوید" };
  }

  try {
    const payload = toCasePayload(values, instructorId, status);
    const created = await prisma.$transaction((tx) => createCase(tx, payload));
    return {
      success: true,
      message: status === "PUBLISHED" ? "کیس با موفقیت منتشر شد" : "پیش‌نویس ذخیره شد",
      data: serializeCase(created),
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateCaseAction(
  id: string,
  values: CaseFormValues,
  status: CaseStatusValue,
): Promise<CaseActionResult> {
  "use server";

  const instructorId = await resolveInstructorId();
  if (!instructorId) {
    return { success: false, message: "برای ویرایش کیس باید وارد شوید" };
  }

  try {
    const existing = await getCaseById(prisma, id);
    if (!existing) {
      return { success: false, message: "کیس یافت نشد" };
    }
    if (existing.instructorId !== instructorId) {
      return { success: false, message: "شما اجازه ویرایش این کیس را ندارید" };
    }

    const payload = toCasePayload(values, instructorId, status);
    const updated = await prisma.$transaction((tx) => updateCase(tx, id, payload));
    return {
      success: true,
      message: status === "PUBLISHED" ? "کیس با موفقیت به‌روزرسانی شد" : "پیش‌نویس به‌روزرسانی شد",
      data: serializeCase(updated),
    };
  } catch (error) {
    return handleActionError(error);
  }
}
