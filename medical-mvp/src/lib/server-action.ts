import { getLogger } from "@/lib/logger";
import { runWithRequestId } from "@/lib/request-context";
import { serializeError } from "@/lib/serialize-error";

export type ServerActionOptions = {
  operation: string;
  userId?: string;
  input?: Record<string, unknown>;
};

export { serializeError };

/**
 * Standard wrapper for server actions: binds request context, logs sanitized
 * inputs, measures duration, and records stack traces on thrown errors.
 */
export async function withServerAction<T>(
  options: ServerActionOptions,
  fn: () => Promise<T>,
): Promise<T> {
  return runWithRequestId(
    async () => {
      const logger = getLogger();
      const startedAt = Date.now();

      logger.info(
        {
          event: "action.start",
          operation: options.operation,
          ...(options.userId ? { userId: options.userId } : {}),
          ...(options.input ? { input: options.input } : {}),
        },
        `${options.operation} started`,
      );

      try {
        const result = await fn();
        logger.info(
          {
            event: "action.success",
            operation: options.operation,
            durationMs: Date.now() - startedAt,
            ...(options.userId ? { userId: options.userId } : {}),
          },
          `${options.operation} completed`,
        );
        return result;
      } catch (error) {
        logger.error(
          {
            event: "action.error",
            operation: options.operation,
            durationMs: Date.now() - startedAt,
            ...(options.userId ? { userId: options.userId } : {}),
            err: serializeError(error),
          },
          `${options.operation} failed`,
        );
        throw error;
      }
    },
    {
      operation: options.operation,
      ...(options.userId ? { userId: options.userId } : {}),
    },
  );
}
