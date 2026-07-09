"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { generateClinicalCaseAction } from "@/app/actions/case-generator";
import { Button } from "@/components/ui/Button";

type TargetedPracticeButtonProps = {
  categoryId: string;
  categoryName: string;
  className?: string;
};

export function TargetedPracticeButton({
  categoryId,
  categoryName,
  className,
}: TargetedPracticeButtonProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateClinicalCaseAction(categoryId, categoryName, true);

      if (!result.success || !result.data?.caseId) {
        setError(result.message);
        return;
      }

      router.push(`/case/${result.data.caseId}/quiz`);
    } catch {
      setError("خطا در تولید کیس. لطفاً دوباره تلاش کنید.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="primary"
        className={className}
        disabled={isGenerating}
        onClick={handleGenerate}
      >
        {isGenerating ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            در حال تولید...
          </span>
        ) : (
          "تمرین هدفمند"
        )}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
