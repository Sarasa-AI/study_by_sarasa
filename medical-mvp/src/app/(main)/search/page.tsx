import Link from "next/link";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { SearchBar } from "@/components/search/SearchBar";
import { searchCases } from "@/lib/search-actions";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const query = searchParams.q?.trim() ?? "";

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">جستجوی مفهومی</h1>
        <p className="text-sm text-slate-600">
          کیس‌ها را بر اساس علائم، تشخیص، درمان یا نکات آموزشی پیدا کنید
        </p>
      </div>

      <SearchBar initialQuery={query} />

      {query ? (
        <SearchResults query={query} />
      ) : (
        <PlaceholderState />
      )}
    </div>
  );
}

function PlaceholderState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
          <Search className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
        <p className="text-sm font-medium text-slate-800">
          علائم، تشخیص‌ها یا یافته‌های بالینی را جستجو کنید…
        </p>
        <p className="max-w-md text-xs text-slate-500">
          مثلاً «نوزاد با تب طول‌کشیده و راش» یا «IVIG» یا «فتوتراپی»
        </p>
      </CardContent>
    </Card>
  );
}

async function SearchResults({ query }: { query: string }) {
  const results = await searchCases(query);

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm font-medium text-slate-800">نتیجه‌ای یافت نشد</p>
          <p className="mt-1 text-xs text-slate-500">
            عبارت دیگری امتحان کنید؛ جستجو بر اساس شباهت معنایی است نه تطابق دقیق کلمات.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">
        نتایج
        <span className="mr-2 text-sm font-normal text-slate-600">
          ({results.length.toLocaleString("fa-IR")})
        </span>
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {results.map((kase) => (
          <Link key={kase.id} href={`/case/${kase.id}`} className="block">
            <Card className="h-full transition-shadow duration-300 hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-900">{kase.title}</div>
                  <div className="shrink-0 rounded-lg border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs text-teal-800">
                    {kase.category}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 line-clamp-3">
                  {kase.clinicalScenario}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
