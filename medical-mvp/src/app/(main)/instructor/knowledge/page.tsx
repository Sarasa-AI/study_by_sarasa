import { requireInstructor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getKnowledgeDocuments } from "@/lib/knowledge-actions";
import { KnowledgeBaseManager } from "@/components/instructor/KnowledgeBaseManager";

export default async function InstructorKnowledgePage() {
  await requireInstructor();

  const [categories, documents] = await Promise.all([
    prisma.category.findMany({
      orderBy: { orderIndex: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    getKnowledgeDocuments(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">پایگاه دانش (Knowledge Base)</h1>
        <p className="mt-1 text-sm text-slate-600">
          راهنماهای بالینی را وارد کنید تا تولید کیس مبتنی بر RAG به اسناد واقعی متکی باشد.
        </p>
      </div>
      <KnowledgeBaseManager categories={categories} documents={documents} />
    </div>
  );
}
