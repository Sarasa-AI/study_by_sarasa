import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BarChart3, Flame, Star, Target, Trophy } from "lucide-react";
import { getDashboardStatsAction } from "@/app/actions/dashboard-stats";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { TargetedPracticeButton } from "@/components/dashboard/TargetedPracticeButton";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default async function DashboardPage() {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    redirect("/login");
  }

  const result = await getDashboardStatsAction();
  if (!result.success || !result.data) {
    redirect("/login");
  }

  const stats = result.data;
  const studentName = session?.user?.name ?? "دانشجو";
  const averageScorePercent = Math.round(stats.overallAccuracy * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">داشبورد عملکرد</h1>
        <p className="mt-1 text-sm text-muted-foreground">خوش آمدید، {studentName}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4" />
              <span>Total Solved</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalCasesCompleted}</div>
            <p className="mt-1 text-xs text-muted-foreground">کیس تکمیل‌شده</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>Average Score</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{averageScorePercent}%</div>
            <p className="mt-1 text-xs text-muted-foreground">میانگین نمره کل</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="h-4 w-4" />
              <span>Total XP</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalXp}</div>
            <p className="mt-1 text-xs text-muted-foreground">امتیاز تجربه کل</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Flame className="h-4 w-4" />
              <span>Current Streak</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.streak.currentStreak}</div>
            <p className="mt-1 text-xs text-muted-foreground">روز متوالی فعال</p>
          </CardContent>
        </Card>
      </div>

      {stats.totalCasesCompleted === 0 && (
        <Card className="border-primary/20 bg-accent">
          <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground">اولین کیس خود را شروع کنید و عملکرد خود را پیگیری کنید.</p>
            <Link href="/">
              <Button>شروع یادگیری</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {stats.weakAreas.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <div className="font-semibold text-amber-900">نقاط ضعف</div>
            <p className="text-sm text-amber-800">
              در دسته‌بندی‌های زیر دقت شما کمتر از ۶۰٪ است. برای بهبود، کیس‌های این بخش‌ها را مرور کنید.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.weakAreas.map((area) => (
              <div
                key={area.categoryId}
                className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">{area.name}</div>
                  <div className="text-sm text-muted-foreground">
                    دقت: {Math.round(area.accuracy * 100)}% · {area.attempts} تلاش
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/category/${area.categoryId}`}>
                    <Button variant="secondary" className="w-full sm:w-auto">
                      مرور کیس‌ها
                    </Button>
                  </Link>
                  <TargetedPracticeButton
                    categoryId={area.categoryId}
                    categoryName={area.name}
                    className="w-full sm:w-auto"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold">
            <BarChart3 className="h-4 w-4" />
            <span>عملکرد بر اساس دسته‌بندی</span>
          </div>
        </CardHeader>
        <CardContent>
          <PerformanceChart data={stats.categoryAccuracy} weakAreas={stats.weakAreas} />
        </CardContent>
      </Card>
    </div>
  );
}
