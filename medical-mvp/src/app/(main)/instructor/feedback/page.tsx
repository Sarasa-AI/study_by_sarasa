import Link from "next/link";
import type { FeedbackReason, FeedbackStatus } from "@prisma/client";
import { requireInstructor } from "@/lib/auth";
import {
  getInstructorFeedbacks,
  type InstructorFeedbackFilter,
} from "@/lib/feedback-service";
import { FeedbackStatusButtons } from "@/components/instructor/FeedbackStatusButtons";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

const REASON_LABELS: Record<FeedbackReason, string> = {
  TYPO: "تایپو/غلط املایی",
  WRONG_ANSWER: "پاسخ اشتباه",
  UNCLEAR_REASONING: "استدلال مبهم",
  OTHER: "سایر",
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  PENDING: "در انتظار بررسی",
  RESOLVED: "رفع شد",
  DISMISSED: "رد شده",
};

function parseFilter(value?: string): InstructorFeedbackFilter {
  return value === "reviewed" ? "REVIEWED" : "PENDING";
}

function truncate(text: string, max = 160) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export default async function InstructorFeedbackPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  await requireInstructor();

  const filter = parseFilter(searchParams.status);
  const feedbacks = await getInstructorFeedbacks(filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">گزارش‌های خطا</h1>
        <Link href="/instructor">
          <Button variant="ghost">بازگشت به پنل استاد</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/instructor/feedback?status=pending">
          <Button variant={filter === "PENDING" ? "primary" : "secondary"}>
            در انتظار بررسی
          </Button>
        </Link>
        <Link href="/instructor/feedback?status=reviewed">
          <Button variant={filter === "REVIEWED" ? "primary" : "secondary"}>
            بررسی‌شده
          </Button>
        </Link>
      </div>

      {feedbacks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-600">
            {filter === "PENDING"
              ? "گزارش در انتظاری وجود ندارد."
              : "گزارش بررسی‌شده‌ای وجود ندارد."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="font-semibold leading-7">
                      {truncate(item.questionText)}
                    </div>
                    <div className="text-sm text-slate-600">
                      کیس: {item.caseTitle}
                    </div>
                  </div>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {REASON_LABELS[item.reason]}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span>گزارش‌دهنده: {item.reporterName}</span>
                  <span>
                    تاریخ:{" "}
                    {item.createdAt.toLocaleDateString("fa-IR", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {filter === "REVIEWED" ? (
                    <span>وضعیت: {STATUS_LABELS[item.status]}</span>
                  ) : null}
                </div>

                {item.comment ? (
                  <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
                    {item.comment}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">بدون توضیح اضافی</p>
                )}

                <div className="flex flex-wrap items-start gap-2 pt-1">
                  <Link href={`/instructor/cases/${item.caseId}/edit`}>
                    <Button variant="secondary">ویرایش سوال</Button>
                  </Link>
                  {item.status === "PENDING" ? (
                    <FeedbackStatusButtons feedbackId={item.id} />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
