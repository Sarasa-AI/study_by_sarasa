import path from "node:path";
import { createRequire } from "node:module";
import pino from "pino";
import { sanitizeLogContext } from "@/lib/log-sanitize";
import { getRequestContext } from "@/lib/request-context";

const isProduction = process.env.NODE_ENV === "production";
const logLevel = process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug");
const nodeRequire = createRequire(path.join(process.cwd(), "package.json"));

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
    // Absolute path so the worker thread can load pino-pretty outside Webpack.
    const prettyTarget = nodeRequire.resolve("pino-pretty");

    return pino({
      ...baseOptions,
      transport: {
        target: prettyTarget,
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

export { rootLogger };
