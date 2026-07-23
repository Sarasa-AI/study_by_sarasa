import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { LibrarySearchBar } from "@/components/library/LibrarySearchBar";
import {
  getLibraryBrowse,
  searchKnowledgeBase,
} from "@/lib/library-service";

const SOURCE_LABELS: Record<string, string> = {
  explanation: "توضیح",
  clinicalReasoning: "استدلال بالینی",
  questionText: "متن سؤال",
  teachingPoint: "نکته آموزشی",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: { q?: string; categoryId?: string };
}) {
  const query = searchParams.q?.trim() ?? "";
  const categoryId = searchParams.categoryId;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">کتابخانه و دانش</h1>
        <p className="text-sm text-slate-600">
          جستجوی سراسری در کیس‌های بالینی، نکات آموزشی و استدلال‌های بالینی
        </p>
      </div>

      <LibrarySearchBar initialQuery={query} categoryId={categoryId} />

      {query ? (
        <SearchResults query={query} categoryId={categoryId} />
      ) : (
        <BrowseView />
      )}
    </div>
  );
}

async function SearchResults({
  query,
  categoryId,
}: {
  query: string;
  categoryId?: string;
}) {
  const results = await searchKnowledgeBase(query, { categoryId });
  const hasResults = results.cases.length > 0 || results.teachingPoints.length > 0;

  if (!hasResults) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-slate-600">
          نتیجه‌ای یافت نشد
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-xl font-bold">
          کیس‌های بالینی
          <span className="mr-2 text-sm font-normal text-slate-600">
            ({results.cases.length.toLocaleString("fa-IR")})
          </span>
        </h2>
        {results.cases.length === 0 ? (
          <p className="text-sm text-slate-600">کیس مرتبطی یافت نشد.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {results.cases.map((kase) => (
              <Link key={kase.id} href={`/case/${kase.id}`}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{kase.title}</div>
                      <div className="shrink-0 text-xs text-slate-600">{kase.category.name}</div>
                    </div>
                    <div className="text-xs text-slate-500">{kase.chiefComplaint}</div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-slate-600">{kase.snippet}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">
          نکات آموزشی و استدلال‌ها
          <span className="mr-2 text-sm font-normal text-slate-600">
            ({results.teachingPoints.length.toLocaleString("fa-IR")})
          </span>
        </h2>
        {results.teachingPoints.length === 0 ? (
          <p className="text-sm text-slate-600">نکته یا استدلال مرتبطی یافت نشد.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {results.teachingPoints.map((item) => (
              <Link key={item.id} href={`/case/${item.caseId}`}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{item.caseTitle}</div>
                      <div className="shrink-0 text-xs text-slate-600">
                        {SOURCE_LABELS[item.source] ?? item.source}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">{item.categoryName}</div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-slate-600">{item.snippet}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

async function BrowseView() {
  const { categories, highYield } = await getLibraryBrowse();

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-xl font-bold">دسته‌بندی‌ها</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-slate-600">هنوز دسته‌بندی‌ای ثبت نشده است.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {categories.map((category) => (
              <Link key={category.id} href={`/category/${category.id}`}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="text-xl font-bold">{category.name}</div>
                      <div className="text-2xl">{category.icon}</div>
                    </div>
                    {category.description ? (
                      <div className="text-sm text-slate-600">{category.description}</div>
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 text-sm text-slate-600">
                      <span>
                        {category.caseCount.toLocaleString("fa-IR")} کیس
                      </span>
                      <span>
                        {category.questionCount.toLocaleString("fa-IR")} سؤال
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {highYield.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">موضوعات پربازده</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {highYield.map((kase) => (
              <Link key={kase.id} href={`/case/${kase.id}`}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{kase.title}</div>
                      <div className="shrink-0 text-xs text-slate-600">{kase.category.name}</div>
                    </div>
                    <div className="text-xs text-slate-500">{kase.chiefComplaint}</div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-slate-600">
                      {kase.teachingPointCount.toLocaleString("fa-IR")} نکته آموزشی
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
