import { cn } from "@/lib/utils";
import type { CaseStatusValue } from "@/lib/case-schema";

const STATUS_LABEL: Record<CaseStatusValue, string> = {
  DRAFT: "پیش‌نویس",
  PUBLISHED: "منتشر شده",
  REJECTED: "رد شده",
};

const STATUS_CLASS: Record<CaseStatusValue, string> = {
  DRAFT: "bg-amber-50 text-amber-800 ring-amber-200",
  PUBLISHED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-red-50 text-red-700 ring-red-200",
};

type CaseStatusBadgeProps = {
  status: CaseStatusValue;
  className?: string;
};

export function CaseStatusBadge({ status, className }: CaseStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        STATUS_CLASS[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
