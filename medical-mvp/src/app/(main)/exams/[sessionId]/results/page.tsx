import Link from "next/link";
import { redirect } from "next/navigation";
import { ExamSessionStatus } from "@prisma/client";
import { ArrowRight, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { answerOptions } from "@/lib/case-schema";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

type ResultsPageProps = {
  params: { sessionId: string };
};

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds.toLocaleString("fa-IR")} ثانیه`;
  }
  if (seconds === 0) {
    return `${minutes.toLocaleString("fa-IR")} دقیقه`;
  }
  return `${minutes.toLocaleString("fa-IR")} دقیقه و ${seconds.toLocaleString("fa-IR")} ثانیه`;
}

export default async function ExamResultsPage({ params }: ResultsPageProps) {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    redirect("/login");
  }

  const session = await prisma.examSession.findFirst({
    where: {
      id: params.sessionId,
      userId: sessionUser.id,
    },
    include: {
      exam: {
        select: {
          title: true,
          passingScore: true,
          questions: {
            orderBy: { orderIndex: "asc" },
            include: {
              question: {
                select: {
                  id: true,
                  questionText: true,
                  optionA: true,
                  optionB: true,
                  optionC: true,
                  optionD: true,
                  correctAnswer: true,
                  clinicalReasoning: true,
                  explanation: true,
                },
              },
            },
          },
        },
      },
      answers: {
        select: {
          questionId: true,
          selectedOption: true,
          isCorrect: true,
        },
      },
    },
  });

  if (!session) {
    redirect("/exams");
  }

  if (session.status === ExamSessionStatus.IN_PROGRESS) {
    redirect(`/exams/${session.id}`);
  }

  if (session.status !== ExamSessionStatus.COMPLETED) {
    redirect("/exams");
  }

  const answerMap = new Map(session.answers.map((a) => [a.questionId, a]));
  const score = session.score ?? 0;
  const passed = score >= session.exam.passingScore;
  const completedAt = session.completedAt ?? session.startedAt;
  const timeTakenSeconds = Math.max(
    0,
    Math.round((completedAt.getTime() - session.startedAt.getTime()) / 1000),
  );
  const correctCount = session.answers.filter((a) => a.isCorrect).length;
  const totalQuestions = session.exam.questions.length;

  const optionText = (
    question: {
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
    },
    letter: string,
  ) => {
    const map = {
      A: question.optionA,
      B: question.optionB,
      C: question.optionC,
      D: question.optionD,
    } as const;
    return map[letter as keyof typeof map] ?? letter;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">نتیجه آزمون</h1>
          <p className="mt-1 text-sm text-slate-600">{session.exam.title}</p>
        </div>
        <Link href="/exams">
          <Button type="button" variant="secondary" className="gap-2">
            <ArrowRight className="h-4 w-4" />
            بازگشت به فهرست آزمون‌ها
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-lg font-bold text-slate-900">
            {passed ? (
              <CheckCircle2 className="h-5 w-5 text-teal-600" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-600" />
            )}
            {passed ? "قبول شدید" : "نمره قبولی کسب نشد"}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p className="text-base font-medium text-slate-900">
            نمره: {score.toLocaleString("fa-IR")}٪ ({correctCount.toLocaleString("fa-IR")} از{" "}
            {totalQuestions.toLocaleString("fa-IR")})
          </p>
          <p>نمره قبولی: {session.exam.passingScore.toLocaleString("fa-IR")}٪</p>
          <p className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            زمان صرف‌شده: {formatDuration(timeTakenSeconds)}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">مرور سؤالات</h2>
        {session.exam.questions.map((eq, index) => {
          const question = eq.question;
          const answer = answerMap.get(question.id);
          const selected = answer?.selectedOption ?? null;
          const isCorrect = answer?.isCorrect ?? false;

          return (
            <Card
              key={question.id}
              className={cn(
                "border",
                isCorrect ? "border-teal-200" : selected ? "border-rose-200" : "border-slate-200",
              )}
            >
              <CardHeader>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-slate-500">
                    سؤال {(index + 1).toLocaleString("fa-IR")}
                  </div>
                  <div className="font-semibold leading-7 text-slate-900">
                    {question.questionText}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-2">
                  {answerOptions.map((key) => {
                    const isUserPick = selected === key;
                    const isCorrectOption = question.correctAnswer === key;

                    return (
                      <div
                        key={key}
                        className={cn(
                          "rounded-xl border px-3 py-2",
                          isCorrectOption
                            ? "border-teal-600 bg-teal-50 text-teal-900"
                            : isUserPick
                              ? "border-rose-400 bg-rose-50 text-rose-900"
                              : "border-slate-200 text-slate-700",
                        )}
                      >
                        <span className="font-medium">{key}.</span> {optionText(question, key)}
                        {isCorrectOption ? (
                          <span className="ms-2 text-xs font-semibold">پاسخ صحیح</span>
                        ) : null}
                        {isUserPick && !isCorrectOption ? (
                          <span className="ms-2 text-xs font-semibold">انتخاب شما</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {!selected ? (
                  <p className="text-amber-700">پاسخی برای این سؤال ثبت نشده است.</p>
                ) : null}

                {question.clinicalReasoning ? (
                  <div className="rounded-xl bg-slate-50 px-3 py-3 text-slate-700">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      استدلال بالینی
                    </p>
                    <p className="leading-6">{question.clinicalReasoning}</p>
                  </div>
                ) : null}

                {question.explanation ? (
                  <div className="text-slate-600">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      توضیح
                    </p>
                    <p className="leading-6">{question.explanation}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
