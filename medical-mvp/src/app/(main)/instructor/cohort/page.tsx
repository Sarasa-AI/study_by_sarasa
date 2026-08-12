import { Activity, BarChart3, Inbox, Target, Users } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { requireInstructor } from "@/lib/auth";
import {
  getClassAnalytics,
  WEAK_ACCURACY_THRESHOLD,
  type CategoryPerformanceItem,
  type StudentRosterItem,
} from "@/lib/cohort-actions";
import { cn } from "@/lib/utils";

function accuracyBarClass(accuracy: number): string {
  if (accuracy < 40) return "bg-rose-500";
  if (accuracy < WEAK_ACCURACY_THRESHOLD) return "bg-amber-500";
  return "bg-primary";
}

function accuracyBadgeClass(accuracy: number): string {
  if (accuracy < 40) {
    return "bg-rose-50 text-rose-800 ring-rose-200";
  }
  if (accuracy < WEAK_ACCURACY_THRESHOLD) {
    return "bg-amber-50 text-amber-800 ring-amber-200";
  }
  return "bg-teal-50 text-teal-800 ring-teal-200";
}

function CategoryPerformanceList({
  categories,
}: {
  categories: CategoryPerformanceItem[];
}) {
  if (categories.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        هنوز عملکردی بر اساس دسته‌بندی ثبت نشده است
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const percent = Math.round(category.accuracy);
        const isWeak = category.accuracy < WEAK_ACCURACY_THRESHOLD;
        const total = category.correct + category.incorrect;

        return (
          <div key={category.categoryId} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span
                className={cn(
                  "font-medium",
                  isWeak ? "text-amber-900" : "text-slate-800",
                )}
              >
                {category.name}
              </span>
              <span className="shrink-0 text-slate-500">
                {category.correct.toLocaleString("fa-IR")} از{" "}
                {total.toLocaleString("fa-IR")} ·{" "}
                {percent.toLocaleString("fa-IR")}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  accuracyBarClass(category.accuracy),
                )}
                style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`دقت کلاس در ${category.name}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StudentRosterTable({ students }: { students: StudentRosterItem[] }) {
  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Inbox className="h-6 w-6" />
        </div>
        <p className="font-medium text-slate-800">دانشجویی یافت نشد</p>
        <p className="text-sm text-slate-500">
          هنوز دانشجویی در سیستم ثبت‌نام نکرده است.
        </p>
      </div>
    );
  }

  const anyExamsTaken = students.some((s) => s.completedExams > 0);

  return (
    <div className="space-y-3">
      {!anyExamsTaken ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
          هنوز دانشجویی آزمون نداده است
        </p>
      ) : null}

      {/* Mobile stacked cards */}
      <ul className="space-y-3 sm:hidden">
        {students.map((student) => {
          const accuracy = Math.round(student.averageAccuracy);
          const isWeak =
            student.completedExams > 0 &&
            student.averageAccuracy < WEAK_ACCURACY_THRESHOLD;

          return (
            <li
              key={student.studentId}
              className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4"
            >
              <p className="font-medium text-slate-900">{student.name}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-slate-600">
                  آزمون‌ها:{" "}
                  <span className="tabular-nums font-medium text-slate-800">
                    {student.completedExams.toLocaleString("fa-IR")}
                  </span>
                </span>
                {student.completedExams === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                      accuracyBadgeClass(student.averageAccuracy),
                      isWeak && "font-semibold",
                    )}
                  >
                    {accuracy.toLocaleString("fa-IR")}%
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[28rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-3 py-3 font-semibold">نام دانشجو</th>
              <th className="px-3 py-3 font-semibold">تعداد آزمون تکمیل‌شده</th>
              <th className="px-3 py-3 font-semibold">میانگین دقت</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {students.map((student) => {
              const accuracy = Math.round(student.averageAccuracy);
              const isWeak =
                student.completedExams > 0 &&
                student.averageAccuracy < WEAK_ACCURACY_THRESHOLD;

              return (
                <tr key={student.studentId} className="hover:bg-slate-50/80">
                  <td className="px-3 py-3 font-medium text-slate-900">
                    {student.name}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-slate-700">
                    {student.completedExams.toLocaleString("fa-IR")}
                  </td>
                  <td className="px-3 py-3">
                    {student.completedExams === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                          accuracyBadgeClass(student.averageAccuracy),
                          isWeak && "font-semibold",
                        )}
                      >
                        {accuracy.toLocaleString("fa-IR")}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function InstructorCohortPage() {
  await requireInstructor();
  const result = await getClassAnalytics();

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">تحلیل کلاس</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-sm text-rose-700">
            {result.message}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { totalStudents, classAverageAccuracy, categoryPerformance, studentRoster } =
    result.data;
  const averageDisplay = Math.round(classAverageAccuracy);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">تحلیل کلاس</h1>
        <p className="mt-1 text-sm text-slate-600">
          نمای کلی عملکرد دانشجویان و شناسایی موضوعات ضعیف کلاس
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Users className="h-4 w-4" />
              <span>تعداد دانشجویان فعال</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums text-slate-900">
              {totalStudents.toLocaleString("fa-IR")}
            </div>
            <p className="mt-1 text-xs text-slate-500">دانشجوی ثبت‌شده در سیستم</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Target className="h-4 w-4" />
              <span>میانگین دقت کلاس</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold tabular-nums text-slate-900">
                {averageDisplay.toLocaleString("fa-IR")}%
              </div>
              <Activity className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-1 text-xs text-slate-500">میانگین نمرات آزمون‌های تکمیل‌شده</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <BarChart3 className="h-4 w-4" />
            <span>عملکرد بر اساس دسته‌بندی</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            میانگین دقت کلاس در هر موضوع بالینی — دسته‌های زیر ۶۰٪ برجسته شده‌اند
          </p>
        </CardHeader>
        <CardContent>
          <CategoryPerformanceList categories={categoryPerformance} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Users className="h-4 w-4" />
            <span>وضعیت دانشجویان</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            فهرست دانشجویان به همراه تعداد آزمون و میانگین دقت
          </p>
        </CardHeader>
        <CardContent>
          <StudentRosterTable students={studentRoster} />
        </CardContent>
      </Card>
    </div>
  );
}
