"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateFeedbackStatusAction } from "@/lib/feedback-actions";
import { Button } from "@/components/ui/Button";

type FeedbackStatusButtonsProps = {
  feedbackId: string;
};

export function FeedbackStatusButtons({ feedbackId }: FeedbackStatusButtonsProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdate(status: "RESOLVED" | "DISMISSED") {
    setIsUpdating(true);
    setError(null);
    try {
      const result = await updateFeedbackStatusAction({ feedbackId, status });
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.refresh();
    } catch {
      setError("خطا در به‌روزرسانی وضعیت");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={isUpdating}
          onClick={() => void handleUpdate("RESOLVED")}
        >
          تایید و رفع شد
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isUpdating}
          onClick={() => void handleUpdate("DISMISSED")}
        >
          رد گزارش
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
