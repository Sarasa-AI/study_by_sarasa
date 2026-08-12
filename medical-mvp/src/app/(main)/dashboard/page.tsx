import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, BarChart3, BookOpenCheck, Brain, Target, TrendingUp } from "lucide-react";
import { CategoryPerformanceChart } from "@/components/dashboard/CategoryPerformanceChart";
import { ScoreTrendChart } from "@/components/dashboard/ScoreTrendChart";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import {
  getCategoryPerformance,
  getScoreTrend,
  getUserStats,
} from "@/lib/analytics-actions";
import { getSessionUser } from "@/lib/auth";
import { getPendingMistakesCount } from "@/lib/practice-service";

export default async function DashboardPage() {
  const sessionUser = await getSessionUser();
  const userId = sessionUser?.id;

  if (!userId) {
    redirect("/login");
  }

  const [statsResult, trendResult, categoryResult, pendingMistakesCount] =
    await Promise.all([
      getUserStats(),
      getScoreTrend(),
      getCategoryPerformance(),
      getPendingMistakesCount(userId),
    ]);

  if (!statsResult.success || !trendResult.success || !categoryResult.success) {
    redirect("/login");
  }

  const stats = statsResult.data;
  const scoreTrend = trendResult.data;
  const categoryPerformance = categoryResult.data;
  const studentName = sessionUser?.name ?? "دانشجو";
  const averageScoreDisplay = Math.round(stats.averageScore);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">داشبورد عملکرد</h1>
        <p className="mt-1 text-sm text-muted-foreground">خوش آمدید، {studentName}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>تعداد آزمون‌ها</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.totalExams.toLocaleString("fa-IR")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">آزمون تکمیل‌شده</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              <span>میانگین نمره</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{averageScoreDisplay}%</div>
            <p className="mt-1 text-xs text-muted-foreground">میانگین نمرات آزمون</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4" />
              <span>تعداد سوالات</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.totalQuestionsAnswered.toLocaleString("fa-IR")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">سوال پاسخ‌داده‌شده</p>
          </CardContent>
        </Card>
      </div>

      {pendingMistakesCount > 0 && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <BookOpenCheck className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
              <div>
                <div className="font-semibold text-rose-900">مرور اشتباهات</div>
                <p className="mt-1 text-sm text-rose-800">
                  {pendingMistakesCount} سوال در صف مرور شماست. با پاسخ صحیح آن‌ها را برطرف کنید.
                </p>
              </div>
            </div>
            <Link href="/practice/review">
              <Button className="w-full sm:w-auto">شروع مرور</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {stats.totalExams === 0 && (
        <Card className="border-primary/20 bg-accent">
          <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground">
              اولین آزمون خود را بدهید تا آمار و تحلیل عملکردتان را ببینید!
            </p>
            <Link href="/exams">
              <Button>شروع آزمون</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 font-semibold">
              <TrendingUp className="h-4 w-4" />
              <span>روند نمرات</span>
            </div>
            <p className="text-sm text-muted-foreground">نمرات آزمون‌های اخیر شما</p>
          </CardHeader>
          <CardContent>
            <ScoreTrendChart data={scoreTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 font-semibold">
              <BarChart3 className="h-4 w-4" />
              <span>دقت بر اساس دسته‌بندی</span>
            </div>
            <p className="text-sm text-muted-foreground">نقاط قوت و ضعف موضوعی</p>
          </CardHeader>
          <CardContent>
            <CategoryPerformanceChart data={categoryPerformance} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
