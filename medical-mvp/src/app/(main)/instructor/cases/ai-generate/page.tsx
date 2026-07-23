import { AICaseGenerateClient } from "@/components/instructor/AICaseGenerateClient";
import { requireInstructor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AIGenerateCasePage() {
  const instructor = await requireInstructor();

  const categories = await prisma.category.findMany({
    orderBy: { orderIndex: "asc" },
    select: { id: true, name: true, slug: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">تولید کیس با هوش مصنوعی</h1>
      <AICaseGenerateClient categories={categories} instructorId={instructor.id} />
    </div>
  );
}
