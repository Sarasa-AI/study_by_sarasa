"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toggleBookmarkAction } from "@/lib/bookmark-actions";
import { cn } from "@/lib/utils";

type CaseBookmarkButtonProps = {
  caseId: string;
  initialBookmarked: boolean;
  className?: string;
  /** When true, refreshes the route after toggle (useful on /bookmarks list). */
  refreshOnToggle?: boolean;
};

export function CaseBookmarkButton({
  caseId,
  initialBookmarked,
  className,
  refreshOnToggle = false,
}: CaseBookmarkButtonProps) {
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const previous = bookmarked;
    setBookmarked(!previous);
    setError(null);

    startTransition(async () => {
      const result = await toggleBookmarkAction(caseId);
      if (!result.success) {
        setBookmarked(previous);
        setError(result.message);
        return;
      }
      if (typeof result.bookmarked === "boolean") {
        setBookmarked(result.bookmarked);
      }
      if (refreshOnToggle) {
        router.refresh();
      }
    });
  }

  return (
    <div className={cn("inline-flex flex-col items-start gap-1", className)}>
      <Button
        type="button"
        variant="ghost"
        disabled={isPending}
        onClick={handleToggle}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? "حذف نشانه" : "نشانه‌گذاری کیس"}
        className={cn(
          "gap-2 px-3",
          bookmarked
            ? "bg-teal-50 text-teal-800 hover:bg-teal-100"
            : "text-slate-700",
        )}
      >
        {bookmarked ? (
          <BookmarkCheck className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <Bookmark className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span className="text-sm">{bookmarked ? "نشان‌شده" : "نشانه‌گذاری"}</span>
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
