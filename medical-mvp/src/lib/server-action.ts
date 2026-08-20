import { getLogger } from "@/lib/logger";
import { runWithRequestId } from "@/lib/request-context";
import { serializeError } from "@/lib/serialize-error";

export type ServerActionOptions = {
  operation: string;
  userId?: string;
  input?: Record<string, unknown>;
};

export type ActionSuccess<T> = {
  success: true;
  message: string;
  data: T;
};

export type ActionFailure = {
  success: false;
  message: string;
  data: null;
};

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export function actionSuccess<T>(message: string, data: T): ActionSuccess<T> {
  return { success: true, message, data };
}

export function actionFailure(message: string): ActionFailure {
  return { success: false, message, data: null };
}

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
