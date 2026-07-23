import { CaseForm } from "@/components/instructor/CaseForm";
import { requireInstructor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewCasePage() {
  const instructor = await requireInstructor();

  const categories = await prisma.category.findMany({
    orderBy: { orderIndex: "asc" },
    select: { id: true, name: true, slug: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ایجاد کیس جدید</h1>
      <CaseForm categories={categories} instructorId={instructor.id} />
    </div>
  );
}
