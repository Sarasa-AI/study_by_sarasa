import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import type { RecommendedCase } from "@/lib/recommendation-actions";

type RecommendationCardsProps = {
  cases: RecommendedCase[];
};

export function RecommendationCards({ cases }: RecommendationCardsProps) {
  if (cases.length === 0) {
    return (
      <p className="text-sm text-slate-600">هنوز کیسی برای پیشنهاد وجود ندارد</p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {cases.map((kase) => (
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
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600 line-clamp-2">{kase.chiefComplaint}</p>
              <div className="inline-flex items-start gap-1.5 rounded-lg bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-200">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{kase.reason}</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
