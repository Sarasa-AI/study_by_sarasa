import Link from "next/link";
import { BookOpen, Target } from "lucide-react";
import type { CategoryBreakdownItem } from "@/lib/analytics-service";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

type StrengthsWeaknessesPanelProps = {
  needsFocus: CategoryBreakdownItem[];
  mastered: CategoryBreakdownItem[];
};

export function StrengthsWeaknessesPanel({
  needsFocus,
  mastered,
}: StrengthsWeaknessesPanelProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold text-amber-900">
            <Target className="h-4 w-4" />
            <span>نیاز به تمرکز</span>
          </div>
          <p className="text-sm text-amber-800">دسته‌بندی‌هایی با دقت کمتر از ۵۰٪</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {needsFocus.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-amber-800">
                نقطه ضعفی با این معیار ثبت نشده است. برای مرور محتوا به کتابخانه بروید.
              </p>
              <Link href="/library">
                <Button variant="secondary" className="w-full sm:w-auto">
                  رفتن به کتابخانه
                </Button>
              </Link>
            </div>
          ) : (
            needsFocus.map((area) => (
              <div
                key={area.categoryId}
                className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">{area.name}</div>
                  <div className="text-sm text-muted-foreground">
                    دقت: {Math.round(area.accuracy * 100)}% ·{" "}
                    {area.attempts.toLocaleString("fa-IR")} تلاش
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/category/${area.categoryId}`}>
                    <Button variant="secondary" className="w-full sm:w-auto">
                      مرور کیس‌ها
                    </Button>
                  </Link>
                  <Link href="/practice/review">
                    <Button className="w-full sm:w-auto">مرور اشتباهات</Button>
                  </Link>
                </div>
              </div>
            ))
          )}
          {needsFocus.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/practice/review">
                <Button variant="secondary">صف مرور اشتباهات</Button>
              </Link>
              <Link href="/library">
                <Button variant="ghost">کتابخانه</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-teal-200 bg-teal-50">
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold text-teal-900">
            <BookOpen className="h-4 w-4" />
            <span>تسلط یافته</span>
          </div>
          <p className="text-sm text-teal-800">دسته‌بندی‌هایی با دقت بیشتر از ۷۵٪</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {mastered.length === 0 ? (
            <p className="text-sm text-teal-800">
              هنوز دسته‌بندی مسلطی ثبت نشده است. با تمرین بیشتر به این بخش برسید.
            </p>
          ) : (
            mastered.map((area) => (
              <div
                key={area.categoryId}
                className="rounded-xl border border-teal-200 bg-white p-3"
              >
                <div className="font-medium">{area.name}</div>
                <div className="text-sm text-muted-foreground">
                  دقت: {Math.round(area.accuracy * 100)}% ·{" "}
                  {area.attempts.toLocaleString("fa-IR")} تلاش
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
