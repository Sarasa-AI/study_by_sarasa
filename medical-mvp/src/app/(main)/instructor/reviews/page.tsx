import Link from "next/link";
import { Inbox } from "lucide-react";
import { CaseManagementActions } from "@/components/instructor/CaseManagementActions";
import { CaseStatusBadge } from "@/components/instructor/CaseStatusBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { requireInstructor } from "@/lib/auth";
import { caseStatusValues, type CaseStatusValue } from "@/lib/case-schema";
import {
  getCaseStatusCounts,
  getManagedCases,
  type CaseStatusFilter,
} from "@/lib/instructor-actions";

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function parseStatusFilter(value?: string): CaseStatusFilter {
  if (!value || value === "all") return "ALL";
  const upper = value.toUpperCase();
  if ((caseStatusValues as readonly string[]).includes(upper)) {
    return upper as CaseStatusValue;
  }
  return "ALL";
}

const TABS: Array<{ filter: CaseStatusFilter; label: string; query: string }> = [
  { filter: "ALL", label: "همه", query: "all" },
  { filter: "DRAFT", label: "پیش‌نویس", query: "draft" },
  { filter: "PUBLISHED", label: "منتشر شده", query: "published" },
  { filter: "REJECTED", label: "رد شده", query: "rejected" },
];

function emptyMessage(filter: CaseStatusFilter): string {
  switch (filter) {
    case "DRAFT":
      return "پیش‌نویسی برای نمایش وجود ندارد";
    case "PUBLISHED":
      return "کیس منتشرشده‌ای وجود ندارد";
    case "REJECTED":
      return "کیس ردشده‌ای وجود ندارد";
    default:
      return "کیسی برای مدیریت وجود ندارد";
  }
}

export default async function InstructorReviewsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  await requireInstructor();

  const filter = parseStatusFilter(searchParams.status);
  const [cases, counts] = await Promise.all([
    getManagedCases(filter),
    getCaseStatusCounts(),
  ]);

  const countFor = (tabFilter: CaseStatusFilter) =>
    tabFilter === "ALL" ? counts.all : counts[tabFilter];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">مدیریت و بررسی کیس‌ها</h1>
        <p className="mt-1 text-sm text-slate-600">
          کیس‌ها را بر اساس وضعیت فیلتر کنید، ویرایش کنید، منتشر کنید یا رد نمایید.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const count = countFor(tab.filter);
          const active = filter === tab.filter;
          return (
            <Link key={tab.query} href={`/instructor/reviews?status=${tab.query}`}>
              <Button variant={active ? "primary" : "secondary"} className="text-xs">
                {tab.label}
                <span
                  className={
                    active
                      ? "rounded-md bg-white/20 px-1.5 py-0.5 text-[11px]"
                      : "rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[11px] text-slate-700"
                  }
                >
                  {count.toLocaleString("fa-IR")}
                </span>
              </Button>
            </Link>
          );
        })}
      </div>

      {cases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Inbox className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium text-slate-800">{emptyMessage(filter)}</p>
              <p className="mt-1 text-sm text-slate-500">
                از پنل استاد می‌توانید کیس جدید بسازید یا با AI تولید کنید.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cases.map((item) => (
            <Card key={item.id} className="transition-shadow hover:shadow-soft-lg">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-slate-900">
                        {item.title}
                      </h2>
                      <CaseStatusBadge status={item.status} />
                    </div>
                    <p className="text-sm text-slate-500">
                      دسته‌بندی: {item.categoryName}
                      <span className="mx-2 text-slate-300">·</span>
                      {item.questionCount.toLocaleString("fa-IR")} سوال
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <p className="text-xs text-slate-500">
                  آخرین به‌روزرسانی: {formatDate(item.updatedAt)}
                </p>
                <CaseManagementActions caseId={item.id} status={item.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
