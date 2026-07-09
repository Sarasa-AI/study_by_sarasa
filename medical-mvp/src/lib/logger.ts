import pino from "pino";
import { sanitizeLogContext } from "@/lib/log-sanitize";
import { getRequestContext } from "@/lib/request-context";

const isProduction = process.env.NODE_ENV === "production";

export type AppLogger = {
  debug: (obj: Record<string, unknown>, msg?: string) => void;
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
  child: (bindings: Record<string, unknown>) => AppLogger;
};

const rootPino = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  base: {
    service: "medical-mvp",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        },
      }),
});

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

export { rootLogger };
