import type { Prisma } from "@prisma/client";
import { requireInstructor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PeerReviewBoard,
  type PeerReviewCase,
} from "@/components/instructor/PeerReviewBoard";

const peerReviewInclude = {
  category: true,
  questions: {
    orderBy: {
      orderIndex: "asc" as const,
    },
  },
  instructor: {
    select: {
      id: true,
      name: true,
      role: true,
    },
  },
} satisfies Prisma.CaseInclude;

type PeerReviewCaseRow = Prisma.CaseGetPayload<{ include: typeof peerReviewInclude }>;

function serializePeerReviewCases(cases: PeerReviewCaseRow[]): PeerReviewCase[] {
  return cases.map((kase) => ({
    id: kase.id,
    title: kase.title,
    status: kase.status as PeerReviewCase["status"],
    chiefComplaint: kase.chiefComplaint,
    patientInfo: kase.patientInfo,
    symptoms: kase.symptoms,
    diagnosis: kase.diagnosis,
    differentialDiagnosis: kase.differentialDiagnosis,
    management: kase.management,
    teachingPoints: kase.teachingPoints,
    reviewNotes: kase.reviewNotes,
    updatedAt: kase.updatedAt.toISOString(),
    category: {
      id: kase.category.id,
      name: kase.category.name,
    },
    instructor: {
      id: kase.instructor.id,
      name: kase.instructor.name,
    },
    questions: kase.questions.map((question) => ({
      id: question.id,
      questionText: question.questionText,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      orderIndex: question.orderIndex,
    })),
  }));
}

export default async function InstructorPeerReviewsPage() {
  await requireInstructor();

  const cases = await prisma.case.findMany({
    where: {
      status: { in: ["DRAFT", "IN_REVIEW", "REJECTED"] },
    },
    include: peerReviewInclude,
    orderBy: { updatedAt: "desc" },
  });

  return <PeerReviewBoard cases={serializePeerReviewCases(cases)} />;
}
