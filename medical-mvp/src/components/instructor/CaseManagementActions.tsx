"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Edit, Loader2, RotateCcw, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { CaseStatusValue } from "@/lib/case-schema";
import { deleteCaseAction, setCaseStatusAction } from "@/lib/instructor-actions";

type CaseManagementActionsProps = {
  caseId: string;
  status: CaseStatusValue;
};

export function CaseManagementActions({ caseId, status }: CaseManagementActionsProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSetStatus(nextStatus: CaseStatusValue) {
    setIsPending(true);
    setError(null);
    try {
      const result = await setCaseStatusAction(caseId, nextStatus);
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.refresh();
    } catch {
      setError("خطا در به‌روزرسانی وضعیت");
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("آیا از حذف این کیس مطمئن هستید؟ این عمل قابل بازگشت نیست.")) {
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const result = await deleteCaseAction(caseId);
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.refresh();
    } catch {
      setError("خطا در حذف کیس");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link href={`/instructor/cases/${caseId}/edit`} className="w-full sm:w-auto">
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            className="w-full text-xs sm:w-auto"
          >
            <Edit className="h-3.5 w-3.5" />
            ویرایش
          </Button>
        </Link>

        {status === "DRAFT" || status === "REJECTED" ? (
          <Button
            type="button"
            disabled={isPending}
            className="w-full text-xs sm:w-auto"
            onClick={() => void handleSetStatus("PUBLISHED")}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle className="h-3.5 w-3.5" />
            )}
            انتشار
          </Button>
        ) : null}

        {status === "PUBLISHED" ? (
          <Button
            type="button"
            variant="danger"
            disabled={isPending}
            className="w-full text-xs sm:w-auto"
            onClick={() => void handleSetStatus("REJECTED")}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            رد کردن
          </Button>
        ) : null}

        {status === "REJECTED" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            className="w-full text-xs sm:w-auto"
            onClick={() => void handleSetStatus("DRAFT")}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            بازگردانی به پیش‌نویس
          </Button>
        ) : null}

        <Button
          type="button"
          variant="danger"
          disabled={isPending}
          className="w-full text-xs sm:w-auto"
          onClick={() => void handleDelete()}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          حذف
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
