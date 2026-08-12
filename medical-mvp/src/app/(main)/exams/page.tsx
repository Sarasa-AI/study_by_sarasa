import { redirect } from "next/navigation";
import { Clock, HelpCircle, Target } from "lucide-react";
import { StartExamButton } from "@/components/exam/StartExamButton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/Card";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ExamsPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    redirect("/login");
  }

  const exams = await prisma.exam.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { questions: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">شبیه‌ساز آزمون</h1>
        <p className="text-sm text-slate-600">
          یک آزمون زمان‌دار انتخاب کنید. پس از شروع، تایمر کاهش می‌یابد و با پایان زمان، آزمون
          به‌صورت خودکار ثبت می‌شود.
        </p>
      </header>

      {exams.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-600">
            هنوز آزمونی تعریف نشده است. پس از seed یا افزودن آزمون از طریق دیتابیس، اینجا نمایش داده
            می‌شود.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {exams.map((exam) => (
            <Card key={exam.id} className="flex flex-col transition-shadow hover:shadow-soft-lg">
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-900">{exam.title}</h2>
                {exam.description ? (
                  <p className="mt-1 text-sm leading-6 text-slate-600">{exam.description}</p>
                ) : null}
              </CardHeader>
              <CardContent className="flex-1 space-y-3 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span>{exam.durationMinutes.toLocaleString("fa-IR")} دقیقه</span>
                </div>
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-slate-400" />
                  <span>{exam._count.questions.toLocaleString("fa-IR")} سؤال</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-slate-400" />
                  <span>نمره قبولی: {exam.passingScore.toLocaleString("fa-IR")}٪</span>
                </div>
              </CardContent>
              <CardFooter>
                <StartExamButton examId={exam.id} />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
