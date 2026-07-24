type ClientErrorLogPayload = {
  source: string;
  message: string;
  digest?: string;
  stack?: string;
  componentStack?: string;
  url?: string;
};

/**
 * Best-effort client → server error reporting. Never throws; failures are silent
 * so the error UI remains usable offline / if logging is unavailable.
 */
export async function reportClientError(payload: ClientErrorLogPayload): Promise<void> {
  try {
    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: payload.source,
        message: payload.message,
        digest: payload.digest,
        stack: payload.stack,
        componentStack: payload.componentStack,
        url: payload.url ?? (typeof window !== "undefined" ? window.location.href : undefined),
      }),
      keepalive: true,
    });
  } catch {
    // Intentionally ignore — logging must not break the error UI.
  }
}
