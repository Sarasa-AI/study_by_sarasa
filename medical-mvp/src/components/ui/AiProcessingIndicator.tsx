"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AiProcessingIndicatorProps = {
  messages: string[];
  /** Interval in ms between message rotations. Default 3000. */
  intervalMs?: number;
  className?: string;
};

export function AiProcessingIndicator({
  messages,
  intervalMs = 3000,
  className,
}: AiProcessingIndicatorProps) {
  const [index, setIndex] = useState(0);
  const count = messages.length;

  useEffect(() => {
    setIndex(0);
    if (count <= 1) return;

    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % count);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [count, intervalMs, messages]);

  const currentMessage =
    messages.length > 0 ? messages[index % messages.length] : "در حال پردازش...";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "space-y-3 rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 text-sm font-medium text-teal-900">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-teal-700" />
        <span>{currentMessage}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-teal-100">
        <div className="h-full w-1/3 animate-[progress-slide_1.6s_ease-in-out_infinite] rounded-full bg-gradient-to-l from-teal-600 to-teal-400" />
      </div>
    </div>
  );
}
