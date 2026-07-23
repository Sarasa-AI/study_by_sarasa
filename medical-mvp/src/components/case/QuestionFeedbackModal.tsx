"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { submitQuestionFeedbackAction } from "@/lib/feedback-actions";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";

const REASON_OPTIONS = [
  { value: "TYPO", label: "تایپو/غلط املایی" },
  { value: "WRONG_ANSWER", label: "پاسخ اشتباه" },
  { value: "UNCLEAR_REASONING", label: "استدلال مبهم" },
  { value: "OTHER", label: "سایر" },
] as const;

type FeedbackReasonValue = (typeof REASON_OPTIONS)[number]["value"];

type QuestionFeedbackModalProps = {
  questionId: string;
};

export function QuestionFeedbackModal({ questionId }: QuestionFeedbackModalProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FeedbackReasonValue>("TYPO");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function resetForm() {
    setReason("TYPO");
    setComment("");
    setError(null);
  }

  function closeModal() {
    setOpen(false);
    resetForm();
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await submitQuestionFeedbackAction({
        questionId,
        reason,
        comment: comment.trim() || null,
      });
      if (!result.success) {
        setError(result.message);
        return;
      }
      setSuccessMessage(result.message);
      closeModal();
      window.setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setError("خطا در ثبت گزارش");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className="gap-1.5 px-2 py-1 text-xs text-slate-600"
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
          aria-label="گزارش اشکال سوال"
        >
          <Flag className="h-3.5 w-3.5" />
          گزارش اشکال سوال
        </Button>
        {successMessage ? (
          <span className="text-xs text-teal-700">{successMessage}</span>
        ) : null}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="question-feedback-title"
          onClick={closeModal}
        >
          <Card
            className="w-full max-w-md"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader>
              <div id="question-feedback-title" className="font-semibold">
                گزارش اشکال سوال
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium text-slate-700">
                  نوع اشکال
                </legend>
                {REASON_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name={`feedback-reason-${questionId}`}
                      value={option.value}
                      checked={reason === option.value}
                      onChange={() => setReason(option.value)}
                      className="accent-teal-700"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">
                  توضیحات (اختیاری)
                </span>
                <Textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="جزئیات بیشتری بنویسید…"
                />
              </label>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  disabled={isSubmitting}
                  onClick={closeModal}
                >
                  انصراف
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={isSubmitting}
                  onClick={() => void handleSubmit()}
                >
                  {isSubmitting ? "در حال ارسال..." : "ارسال گزارش"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
