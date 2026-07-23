"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { saveUserNoteAction } from "@/lib/bookmark-actions";
import { cn } from "@/lib/utils";

type PersonalNoteEditorProps = {
  caseId: string;
  initialContent?: string | null;
  defaultOpen?: boolean;
  className?: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function PersonalNoteEditor({
  caseId,
  initialContent = "",
  defaultOpen = false,
  className,
}: PersonalNoteEditorProps) {
  const [open, setOpen] = useState(defaultOpen || Boolean(initialContent?.trim()));
  const [content, setContent] = useState(initialContent ?? "");
  const [lastSaved, setLastSaved] = useState(initialContent ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function persist(nextContent: string) {
    if (nextContent === lastSaved) {
      return;
    }

    setStatus("saving");
    setMessage(null);

    startTransition(async () => {
      const result = await saveUserNoteAction(caseId, nextContent);
      if (!result.success) {
        setStatus("error");
        setMessage(result.message);
        return;
      }
      setLastSaved(nextContent.trim() === "" ? "" : nextContent.trim());
      setContent(nextContent.trim() === "" ? "" : nextContent);
      setStatus("saved");
      setMessage(result.message);
    });
  }

  function handleBlur() {
    persist(content);
  }

  function handleSaveClick() {
    persist(content);
  }

  const statusLabel =
    status === "saving" || isPending
      ? "در حال ذخیره…"
      : status === "saved"
        ? message ?? "ذخیره شد"
        : status === "error"
          ? message ?? "خطا در ذخیره"
          : null;

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-slate-50/80",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-right text-sm font-medium text-slate-800"
        aria-expanded={open}
      >
        <span>یادداشت شخصی</span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        )}
      </button>

      {open ? (
        <div className="space-y-3 border-t border-slate-200 px-4 py-3">
          <Textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (status === "saved" || status === "error") {
                setStatus("idle");
                setMessage(null);
              }
            }}
            onBlur={handleBlur}
            placeholder="نکات مطالعه، یادآوری‌ها یا سوالات خود را اینجا بنویسید…"
            disabled={isPending}
            rows={4}
          />
          <div className="flex items-center justify-between gap-3">
            <span
              className={cn(
                "text-xs",
                status === "error"
                  ? "text-red-600"
                  : status === "saved"
                    ? "text-teal-700"
                    : "text-slate-500",
              )}
              aria-live="polite"
            >
              {statusLabel}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={isPending || content === lastSaved}
              onClick={handleSaveClick}
              className="shrink-0"
            >
              ذخیره
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
