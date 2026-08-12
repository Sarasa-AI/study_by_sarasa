"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { startExam } from "@/lib/exam-session-actions";

type StartExamButtonProps = {
  examId: string;
};

export function StartExamButton({ examId }: StartExamButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleStart() {
    setError(null);
    startTransition(async () => {
      const result = await startExam(examId);
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.push(`/exams/${result.sessionId}`);
    });
  }

  return (
    <div className="space-y-2">
      <Button type="button" className="w-full gap-2" disabled={isPending} onClick={handleStart}>
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            در حال آماده‌سازی...
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            شروع آزمون
          </>
        )}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
