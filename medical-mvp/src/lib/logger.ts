import pino from "pino";
import { sanitizeLogContext } from "@/lib/log-sanitize";
import { getRequestContext } from "@/lib/request-context";
import { serializeError } from "@/lib/serialize-error";

const isProduction = process.env.NODE_ENV === "production";
const logLevel = process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug");

export type AppLogger = {
  debug: (obj: Record<string, unknown>, msg?: string) => void;
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
  child: (bindings: Record<string, unknown>) => AppLogger;
};

const baseOptions = {
  level: logLevel,
  base: {
    service: "medical-mvp",
  },
} as const;

function createRootPino(): pino.Logger {
  if (isProduction) {
    return pino(baseOptions);
  }

  try {
    // pino/pino-pretty/thread-stream are server-externalized in next.config.mjs,
    // so the worker can resolve this package name at runtime.
    return pino({
      ...baseOptions,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
        },
      },
    });
  } catch {
    // Webpack / bundlers often break pino worker transports; fall back to plain JSON.
    return pino(baseOptions);
  }
}

const rootPino = createRootPino();

function mergeContext(bindings?: Record<string, unknown>): Record<string, unknown> {
  const store = getRequestContext();
  const merged = {
    ...(store?.requestId ? { requestId: store.requestId } : {}),
    ...(store?.correlationId ? { correlationId: store.correlationId } : {}),
    ...(store?.userId ? { userId: store.userId } : {}),
    ...(store?.operation ? { operation: store.operation } : {}),
    ...(store?.jobId ? { jobId: store.jobId } : {}),
    ...bindings,
  };

  return sanitizeLogContext(merged);
}

function wrapPinoLogger(logger: pino.Logger): AppLogger {
  const log =
    (level: "debug" | "info" | "warn" | "error") =>
    (obj: Record<string, unknown>, msg?: string) => {
      logger[level](mergeContext(obj), msg);
    };

  return {
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
    child: (bindings: Record<string, unknown>) =>
      wrapPinoLogger(logger.child(sanitizeLogContext(bindings))),
  };
}

const rootLogger = wrapPinoLogger(rootPino);

export function createLogger(bindings?: Record<string, unknown>): AppLogger {
  if (!bindings || Object.keys(bindings).length === 0) {
    return rootLogger;
  }

  return rootLogger.child(bindings);
}

export function getLogger(): AppLogger {
  return createLogger();
}

export type LogErrorParams = {
  event: string;
  operation?: string;
  error: unknown;
  msg?: string;
  [key: string]: unknown;
};

/**
 * Log an error with a consistent `err` shape (name, message, stack).
 */
export function logError(logger: AppLogger, params: LogErrorParams): void {
  const { event, operation, error, msg, ...extra } = params;

  logger.error(
    {
      event,
      ...(typeof operation === "string" ? { operation } : {}),
      ...extra,
      err: serializeError(error),
    },
    typeof msg === "string" ? msg : typeof operation === "string" ? `${operation} failed` : event,
  );
}

export { rootLogger };
