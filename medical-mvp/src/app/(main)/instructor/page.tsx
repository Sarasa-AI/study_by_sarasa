import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AIGenerateCasePanel } from "@/components/instructor/AIGenerateCasePanel";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default async function InstructorPage() {
  const categories = await prisma.category.findMany({
    orderBy: { orderIndex: "asc" },
    include: { cases: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">پنل استاد</h1>
        <Link href="/instructor/cases/new">
          <Button>کیس جدید</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AIGenerateCasePanel
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
          }))}
        />

        {categories.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-slate-600">کیس‌ها: {c.cases.length}</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-600">
                برای ویرایش دقیق کیس‌ها از «کیس جدید» یا تولید سریع بالا استفاده کنید.
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
