"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

/**
 * Registers global window error / unhandledrejection handlers once so
 * client failures outside React error boundaries still reach /api/log.
 */
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      void reportClientError({
        source: "window.error",
        message: event.message || "Unhandled window error",
        stack: event.error instanceof Error ? event.error.stack : undefined,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection";
      const stack = reason instanceof Error ? reason.stack : undefined;

      void reportClientError({
        source: "unhandledrejection",
        message,
        stack,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
