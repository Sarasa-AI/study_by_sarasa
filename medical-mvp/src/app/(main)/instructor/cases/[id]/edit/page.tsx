import { notFound } from "next/navigation";
import { CaseEditorForm } from "@/components/instructor/CaseEditorForm";
import { requireInstructor } from "@/lib/auth";
import { getCaseForEdit } from "@/lib/instructor-actions";
import { prisma } from "@/lib/prisma";

type EditCasePageProps = {
  params: { id: string };
};

export default async function EditCasePage({ params }: EditCasePageProps) {
  await requireInstructor();

  const initialCase = await getCaseForEdit(params.id);
  if (!initialCase) {
    notFound();
  }

  const categories = await prisma.category.findMany({
    orderBy: { orderIndex: "asc" },
    select: { id: true, name: true, slug: true },
  });

  return (
    <CaseEditorForm caseId={params.id} initialCase={initialCase} categories={categories} />
  );
}
