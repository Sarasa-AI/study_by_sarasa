/**
 * Normalize an unknown thrown value into a plain object safe for structured logs.
 * Includes one level of `cause` when present.
 */
export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const serialized: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause !== undefined) {
      serialized.cause = serializeErrorCause(cause);
    }

    return serialized;
  }

  if (typeof error === "string") {
    return { message: error };
  }

  return { message: "Unknown error" };
}

function serializeErrorCause(cause: unknown): Record<string, unknown> {
  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message,
      stack: cause.stack,
    };
  }

  if (typeof cause === "string") {
    return { message: cause };
  }

  return { message: "Unknown cause" };
}
