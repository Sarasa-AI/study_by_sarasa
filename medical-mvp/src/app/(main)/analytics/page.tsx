import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Flame, Layers, Target, TrendingUp } from "lucide-react";
import { AccuracyTrendChart } from "@/components/analytics/AccuracyTrendChart";
import { CategoryBreakdown } from "@/components/analytics/CategoryBreakdown";
import { StrengthsWeaknessesPanel } from "@/components/analytics/StrengthsWeaknessesPanel";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { getUserAnalyticsData } from "@/lib/analytics-service";
import { getSessionUser } from "@/lib/auth";

export default async function AnalyticsPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    redirect("/login");
  }

  const data = await getUserAnalyticsData(sessionUser.id);
  const { overview, categoryBreakdown, accuracyTrend, needsFocus, mastered } = data;
  const accuracyPercent = Math.round(overview.overallAccuracy * 100);
  const needsFocusIds = new Set(needsFocus.map((area) => area.categoryId));
  const hasAnyActivity =
    overview.totalQuestionsAnswered > 0 || overview.totalFlashcardsReviewed > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">تحلیل عملکرد</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          روند دقت، تفکیک موضوعی، و نقاط قوت و ضعف شما در ۳۰ روز اخیر
        </p>
        {overview.totalCasesCompleted > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {overview.totalCasesCompleted.toLocaleString("fa-IR")} کیس تکمیل‌شده
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Layers className="h-4 w-4" />
              <span>تعداد سوالات</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {overview.totalQuestionsAnswered.toLocaleString("fa-IR")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">سوال پاسخ‌داده‌شده</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>درصد دقت کل</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{accuracyPercent}%</div>
            <p className="mt-1 text-xs text-muted-foreground">میانگین دقت کلی</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Flame className="h-4 w-4" />
              <span>استریک مطالعه</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {overview.currentStreak.toLocaleString("fa-IR")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">روز متوالی فعال</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>فلش‌کارت‌های مرورشده</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {overview.totalFlashcardsReviewed.toLocaleString("fa-IR")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">کارت با حداقل یک مرور</p>
          </CardContent>
        </Card>
      </div>

      {!hasAnyActivity && (
        <Card className="border-primary/20 bg-accent">
          <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground">
              هنوز داده‌ای برای تحلیل ثبت نشده است. اولین کیس یا فلش‌کارت را شروع کنید.
            </p>
            <Link href="/home">
              <Button>شروع یادگیری</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold">
            <BarChart3 className="h-4 w-4" />
            <span>روند دقت ۳۰ روز اخیر</span>
          </div>
        </CardHeader>
        <CardContent>
          <AccuracyTrendChart data={accuracyTrend} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold">
            <BarChart3 className="h-4 w-4" />
            <span>تفکیک موضوعی</span>
          </div>
          <p className="text-sm text-muted-foreground">دقت بر اساس دسته‌بندی بالینی</p>
        </CardHeader>
        <CardContent>
          <CategoryBreakdown
            categories={categoryBreakdown}
            needsFocusIds={needsFocusIds}
          />
        </CardContent>
      </Card>

      <StrengthsWeaknessesPanel needsFocus={needsFocus} mastered={mastered} />
    </div>
  );
}
