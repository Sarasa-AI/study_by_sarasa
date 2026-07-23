import { notFound, redirect } from "next/navigation";
import { CaseForm } from "@/components/instructor/CaseForm";
import { requireInstructor } from "@/lib/auth";
import { getCaseById, serializeCase } from "@/lib/case-service";
import { parseDistractorRationales } from "@/lib/quiz";
import { prisma } from "@/lib/prisma";
import { answerOptions } from "@/lib/case-schema";

type EditCasePageProps = {
  params: { id: string };
};

export default async function EditCasePage({ params }: EditCasePageProps) {
  const instructor = await requireInstructor();

  const kase = await getCaseById(prisma, params.id);
  if (!kase) {
    notFound();
  }

  if (kase.instructorId !== instructor.id) {
    redirect("/instructor");
  }

  const categories = await prisma.category.findMany({
    orderBy: { orderIndex: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const serialized = serializeCase(kase);
  if (!serialized) {
    notFound();
  }

  const initialCase = {
    id: serialized.id,
    title: serialized.title,
    categoryId: serialized.categoryId,
    chiefComplaint: serialized.chiefComplaint,
    patientInfo: serialized.patientInfo,
    mediaUrl: serialized.mediaUrl,
    mediaType: serialized.mediaType,
    symptoms: serialized.symptoms,
    diagnosis: serialized.diagnosis,
    differentialDiagnosis: serialized.differentialDiagnosis,
    management: serialized.management,
    teachingPoints: serialized.teachingPoints,
    questions: serialized.questions.map((question: {
      id: string;
      questionText: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctAnswer: string;
      explanation: string;
      clinicalReasoning?: string | null;
      distractorRationales?: unknown;
    }) => ({
      id: question.id,
      questionText: question.questionText,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctAnswer: (answerOptions.includes(question.correctAnswer as (typeof answerOptions)[number])
        ? question.correctAnswer
        : "A") as "A" | "B" | "C" | "D",
      explanation: question.explanation,
      clinicalReasoning: question.clinicalReasoning ?? null,
      distractorRationales: parseDistractorRationales(question.distractorRationales),
    })),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ویرایش کیس</h1>
      <CaseForm
        categories={categories}
        instructorId={instructor.id}
        initialCase={initialCase}
        submitLabel="ذخیره تغییرات"
        redirectTo="/instructor/feedback"
        showAiPrefill={false}
      />
    </div>
  );
}
