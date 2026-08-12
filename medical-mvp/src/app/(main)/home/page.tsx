import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { RecommendationCards } from "@/components/home/RecommendationCards";
import { getAdaptiveRecommendations } from "@/lib/recommendation-actions";

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
};

async function getCategories(): Promise<Category[]> {
  const res = await fetch(`${process.env.APP_BASE_URL || ""}/api/categories`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export default async function HomePage() {
  const [categories, recommendationsResult] = await Promise.all([
    getCategories(),
    getAdaptiveRecommendations(),
  ]);

  const recommendedCases =
    recommendationsResult.success ? recommendationsResult.data : [];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            پیشنهادهای هوشمند برای بهبود شما
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            کیس‌هایی که بر اساس نقاط ضعف آزمون‌های اخیر شما انتخاب شده‌اند
          </p>
        </div>
        <RecommendationCards cases={recommendedCases} />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">دسته‌بندی‌ها</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {categories.map((c) => (
            <Link key={c.id} href={`/category/${c.id}`}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="text-xl font-bold">{c.name}</div>
                    <div className="text-2xl">{c.icon}</div>
                  </div>
                  <div className="text-sm text-slate-600">{c.description}</div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
