import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CaseForm } from "@/components/instructor/CaseForm";
import { prisma } from "@/lib/prisma";

export default async function NewCasePage() {
  const session = await getServerSession();
  const instructorId = (session?.user as { id?: string } | undefined)?.id;

  if (!instructorId) {
    redirect("/login");
  }

  const categories = await prisma.category.findMany({
    orderBy: { orderIndex: "asc" },
    select: { id: true, name: true, slug: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ایجاد کیس جدید</h1>
      <CaseForm categories={categories} instructorId={instructorId} />
    </div>
  );
}
