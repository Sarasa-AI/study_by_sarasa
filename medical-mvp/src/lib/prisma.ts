import { PrismaClient } from "@prisma/client";
import { getLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-context";

const SLOW_QUERY_THRESHOLD_MS = 500;
const isProduction = process.env.NODE_ENV === "production";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      // Query events power slow-query warnings in all envs; full query debug only in development.
      { emit: "event", level: "query" },
      { emit: "event", level: "warn" },
      { emit: "event", level: "error" },
    ],
  });

  client.$on("query", (event) => {
    const requestId = getRequestId();

    if (!isProduction) {
      getLogger().debug(
        {
          event: "db.query",
          durationMs: event.duration,
          query: event.query,
          requestId,
        },
        "Prisma query",
      );
    }

    if (event.duration > SLOW_QUERY_THRESHOLD_MS) {
      getLogger().warn(
        {
          event: "db.slow_query",
          durationMs: event.duration,
          query: event.query,
          requestId,
        },
        "Slow Prisma query",
      );
    }
  });

  client.$on("warn", (event) => {
    getLogger().warn(
      {
        event: "db.warn",
        message: event.message,
        requestId: getRequestId(),
      },
      "Prisma warning",
    );
  });

  client.$on("error", (event) => {
    getLogger().error(
      {
        event: "db.error",
        message: event.message,
        requestId: getRequestId(),
      },
      "Prisma error",
    );
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
