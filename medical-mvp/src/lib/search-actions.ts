"use server";

import { getLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { buildCaseScenarioSnippet } from "@/lib/case-embedding";
import { embedText, vectorSql } from "@/lib/rag/vector-store";
import { withServerAction } from "@/lib/server-action";

export type CaseSearchResult = {
  id: string;
  title: string;
  clinicalScenario: string;
  category: string;
  distance: number;
};

type CaseSearchRow = {
  id: string;
  title: string;
  chiefComplaint: string;
  patientInfo: string;
  category: string;
  distance: number;
};

export async function searchCases(
  query: string,
  limit = 10,
): Promise<CaseSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const take = Math.max(1, Math.min(50, Math.floor(limit)));

  return withServerAction(
    {
      operation: "search.cases",
      input: { queryLength: trimmed.length, limit: take },
    },
    async () => {
      const startedAt = Date.now();

      const embedding = await embedText(trimmed);
      const vec = vectorSql(embedding);

      const rows = await prisma.$queryRaw<CaseSearchRow[]>`
        SELECT
          c.id,
          c.title,
          c."chiefComplaint" AS "chiefComplaint",
          c."patientInfo" AS "patientInfo",
          cat.name AS category,
          (c.embedding <=> ${vec})::float8 AS distance
        FROM "Case" c
        JOIN "Category" cat ON cat.id = c."categoryId"
        WHERE c.embedding IS NOT NULL
          AND c.status = 'PUBLISHED'
        ORDER BY c.embedding <=> ${vec}
        LIMIT ${take}
      `;

      const results: CaseSearchResult[] = rows.map((row) => ({
        id: row.id,
        title: row.title,
        clinicalScenario: buildCaseScenarioSnippet(row.chiefComplaint, row.patientInfo),
        category: row.category,
        distance: row.distance,
      }));

      getLogger().debug(
        {
          event: "search.cases",
          durationMs: Date.now() - startedAt,
          matchCount: results.length,
          queryLength: trimmed.length,
          limit: take,
        },
        "Semantic case search completed",
      );

      return results;
    },
  );
}
