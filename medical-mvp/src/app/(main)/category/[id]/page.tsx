import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default async function CategoryPage({ params }: { params: { id: string } }) {
  const category = await prisma.category.findUnique({
    where: { id: params.id },
  });
  const cases = await prisma.case.findMany({
    where: { categoryId: params.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, chiefComplaint: true, teachingPoints: true },
  });
  if (!category) {
    return <div>دسته‌بندی یافت نشد</div>;
  }
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{category.name}</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cases.map((k) => (
          <Link key={k.id} href={`/case/${k.id}`}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{k.title}</div>
                  <div className="text-xs text-slate-600">{k.chiefComplaint}</div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-600">
                  {k.teachingPoints[0] ?? "بدون نکته آموزشی"}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
