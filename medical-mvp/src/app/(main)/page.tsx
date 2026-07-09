import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

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
  const categories = await getCategories();
  return (
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
  );
}
