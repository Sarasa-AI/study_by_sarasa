import { PrismaClient } from "@prisma/client";
import { getLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-context";

const SLOW_QUERY_THRESHOLD_MS = 500;

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      "warn",
      "error",
    ],
  });

  client.$on("query", (event) => {
    if (event.duration <= SLOW_QUERY_THRESHOLD_MS) {
      return;
    }

    getLogger().warn(
      {
        event: "db.slow_query",
        durationMs: event.duration,
        query: event.query,
        requestId: getRequestId(),
      },
      "Slow Prisma query",
    );
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
