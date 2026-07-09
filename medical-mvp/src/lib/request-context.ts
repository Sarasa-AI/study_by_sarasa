import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
  requestId: string;
  correlationId?: string;
  userId?: string;
  operation?: string;
  jobId?: string;
};

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function withRequestContext<T>(context: RequestContext, fn: () => T): T {
  return requestContextStorage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}

async function resolveIncomingRequestId(): Promise<string> {
  const { headers } = await import("next/headers");
  const headerStore = headers();
  return (
    headerStore.get("x-request-id") ??
    headerStore.get("x-correlation-id") ??
    crypto.randomUUID()
  );
}

async function resolveCorrelationId(): Promise<string | undefined> {
  const { headers } = await import("next/headers");
  return headers().get("x-correlation-id") ?? undefined;
}

export async function runWithRequestId<T>(
  fn: () => Promise<T>,
  bindings?: Pick<RequestContext, "userId" | "operation" | "jobId">,
): Promise<T> {
  const requestId = await resolveIncomingRequestId();
  const correlationId = await resolveCorrelationId();

  return withRequestContext(
    {
      requestId,
      correlationId,
      ...bindings,
    },
    fn,
  );
}
