/**
 * Backfill Case.embedding for all cases (or only those missing embeddings).
 *
 * Prerequisites: `npx prisma db push` so Case.embedding exists.
 * Usage: `npm run cases:embed`
 *
 * Requires DATABASE_URL and OPENROUTER_API_KEY.
 */

import { prisma } from "@/lib/prisma";
import {
  buildCaseEmbeddingText,
  saveCaseEmbedding,
  type CaseEmbeddingFields,
} from "@/lib/case-embedding";

type CaseRow = CaseEmbeddingFields & { id: string };

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is required for embeddings");
  }

  const missingOnly = process.argv.includes("--missing-only");

  const cases = missingOnly
    ? await prisma.$queryRaw<CaseRow[]>`
        SELECT
          id,
          title,
          "chiefComplaint" AS "chiefComplaint",
          "patientInfo" AS "patientInfo",
          symptoms,
          diagnosis,
          "differentialDiagnosis" AS "differentialDiagnosis",
          management,
          "teachingPoints" AS "teachingPoints"
        FROM "Case"
        WHERE embedding IS NULL
        ORDER BY "createdAt" ASC
      `
    : await prisma.$queryRaw<CaseRow[]>`
        SELECT
          id,
          title,
          "chiefComplaint" AS "chiefComplaint",
          "patientInfo" AS "patientInfo",
          symptoms,
          diagnosis,
          "differentialDiagnosis" AS "differentialDiagnosis",
          management,
          "teachingPoints" AS "teachingPoints"
        FROM "Case"
        ORDER BY "createdAt" ASC
      `;

  console.log(
    `Embedding ${cases.length} case(s)${missingOnly ? " (missing only)" : ""}…`,
  );

  let success = 0;
  let failed = 0;

  for (const [index, kase] of cases.entries()) {
    const label = `[${index + 1}/${cases.length}] ${kase.id} — ${kase.title}`;
    try {
      const text = buildCaseEmbeddingText(kase);
      if (!text.trim()) {
        console.warn(`${label}: skipped (empty narrative)`);
        failed += 1;
        continue;
      }
      await saveCaseEmbedding(prisma, kase.id, text);
      success += 1;
      console.log(`${label}: ok`);
    } catch (error) {
      failed += 1;
      console.error(`${label}: failed`, error);
    }
  }

  console.log(`Done. success=${success} failed=${failed}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
