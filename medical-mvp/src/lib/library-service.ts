import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const DEFAULT_LIMIT = 20;
const SNIPPET_MAX_LEN = 140;

export type CaseSearchResult = {
  id: string;
  title: string;
  category: { id: string; name: string };
  chiefComplaint: string;
  snippet: string;
  matchedField: string;
};

export type TeachingPointSearchResult = {
  id: string;
  caseId: string;
  caseTitle: string;
  categoryName: string;
  snippet: string;
  source: "explanation" | "clinicalReasoning" | "questionText" | "teachingPoint";
};

export type KnowledgeSearchResult = {
  cases: CaseSearchResult[];
  teachingPoints: TeachingPointSearchResult[];
};

export type LibraryBrowseCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  caseCount: number;
  questionCount: number;
};

export type LibraryHighYieldCase = {
  id: string;
  title: string;
  chiefComplaint: string;
  teachingPointCount: number;
  category: { id: string; name: string };
};

export type LibraryBrowseData = {
  categories: LibraryBrowseCategory[];
  highYield: LibraryHighYieldCase[];
};

type SearchOptions = {
  categoryId?: string;
  limit?: number;
};

function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function buildSnippet(text: string, query: string, maxLen = SNIPPET_MAX_LEN): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const lowerText = normalized.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex < 0) {
    return normalized.length <= maxLen ? normalized : `${normalized.slice(0, maxLen)}…`;
  }

  const half = Math.floor((maxLen - query.length) / 2);
  let start = Math.max(0, matchIndex - half);
  let end = Math.min(normalized.length, matchIndex + query.length + half);

  if (end - start < maxLen) {
    end = Math.min(normalized.length, start + maxLen);
    start = Math.max(0, end - maxLen);
  }

  const prefix = start > 0 ? "…" : "";
  const suffix = end < normalized.length ? "…" : "";
  return `${prefix}${normalized.slice(start, end)}${suffix}`;
}

function pickCaseMatch(
  kase: {
    title: string;
    chiefComplaint: string;
    patientInfo: string;
    diagnosis: string;
    management: string;
    teachingPoints: string[];
  },
  query: string,
): { snippet: string; matchedField: string } {
  const fields: Array<{ field: string; value: string }> = [
    { field: "title", value: kase.title },
    { field: "chiefComplaint", value: kase.chiefComplaint },
    { field: "diagnosis", value: kase.diagnosis },
    { field: "patientInfo", value: kase.patientInfo },
    { field: "management", value: kase.management },
    { field: "teachingPoints", value: kase.teachingPoints.join(" ") },
  ];

  const lowerQuery = query.toLowerCase();
  for (const { field, value } of fields) {
    if (value.toLowerCase().includes(lowerQuery)) {
      return { snippet: buildSnippet(value, query), matchedField: field };
    }
  }

  return {
    snippet: buildSnippet(kase.chiefComplaint || kase.title, query),
    matchedField: "title",
  };
}

function pickQuestionMatch(
  question: {
    questionText: string;
    explanation: string;
    clinicalReasoning: string | null;
  },
  query: string,
): { snippet: string; source: TeachingPointSearchResult["source"] } {
  const lowerQuery = query.toLowerCase();
  const candidates: Array<{ source: TeachingPointSearchResult["source"]; value: string }> = [
    { source: "explanation", value: question.explanation },
    { source: "clinicalReasoning", value: question.clinicalReasoning ?? "" },
    { source: "questionText", value: question.questionText },
  ];

  for (const { source, value } of candidates) {
    if (value && value.toLowerCase().includes(lowerQuery)) {
      return { snippet: buildSnippet(value, query), source };
    }
  }

  return {
    snippet: buildSnippet(question.explanation || question.questionText, query),
    source: "explanation",
  };
}

export async function searchKnowledgeBase(
  query: string,
  options?: SearchOptions,
): Promise<KnowledgeSearchResult> {
  const q = query.trim();
  if (!q) {
    return { cases: [], teachingPoints: [] };
  }

  const limit = options?.limit ?? DEFAULT_LIMIT;
  const categoryId = options?.categoryId;
  const caseFilter = {
    status: "PUBLISHED" as const,
    ...(categoryId ? { categoryId } : {}),
  };

  const textContains = { contains: q, mode: "insensitive" as const };

  const [textMatchedCases, teachingPointCaseIds, questions] = await Promise.all([
    prisma.case.findMany({
      where: {
        ...caseFilter,
        OR: [
          { title: textContains },
          { chiefComplaint: textContains },
          { patientInfo: textContains },
          { diagnosis: textContains },
          { management: textContains },
        ],
      },
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM "Case"
      WHERE status = 'PUBLISHED'
        AND array_to_string("teachingPoints", ' ') ILIKE ${"%" + escapeIlike(q) + "%"} ESCAPE '\\'
        ${categoryId ? Prisma.sql`AND "categoryId" = ${categoryId}` : Prisma.empty}
      ORDER BY "updatedAt" DESC
      LIMIT ${limit}
    `,
    prisma.question.findMany({
      where: {
        OR: [
          { questionText: textContains },
          { explanation: textContains },
          { clinicalReasoning: textContains },
        ],
        case: caseFilter,
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            teachingPoints: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { orderIndex: "asc" },
      take: limit,
    }),
  ]);

  const teachingPointIds = teachingPointCaseIds.map((row) => row.id);
  const missingTeachingPointIds = teachingPointIds.filter(
    (id) => !textMatchedCases.some((kase) => kase.id === id),
  );

  const teachingPointCases =
    missingTeachingPointIds.length > 0
      ? await prisma.case.findMany({
          where: { id: { in: missingTeachingPointIds }, ...caseFilter },
          include: {
            category: { select: { id: true, name: true } },
          },
          orderBy: { updatedAt: "desc" },
        })
      : [];

  const caseById = new Map<string, (typeof textMatchedCases)[number]>();
  for (const kase of [...textMatchedCases, ...teachingPointCases]) {
    caseById.set(kase.id, kase);
  }

  const cases: CaseSearchResult[] = Array.from(caseById.values())
    .slice(0, limit)
    .map((kase) => {
      const match = pickCaseMatch(kase, q);
      return {
        id: kase.id,
        title: kase.title,
        category: kase.category,
        chiefComplaint: kase.chiefComplaint,
        snippet: match.snippet,
        matchedField: match.matchedField,
      };
    });

  const teachingPoints: TeachingPointSearchResult[] = [];

  for (const kase of caseById.values()) {
    const lowerQuery = q.toLowerCase();
    kase.teachingPoints.forEach((point, index) => {
      if (point.toLowerCase().includes(lowerQuery)) {
        teachingPoints.push({
          id: `${kase.id}:${index}`,
          caseId: kase.id,
          caseTitle: kase.title,
          categoryName: kase.category.name,
          snippet: buildSnippet(point, q),
          source: "teachingPoint",
        });
      }
    });
  }

  for (const question of questions) {
    const match = pickQuestionMatch(question, q);
    teachingPoints.push({
      id: question.id,
      caseId: question.case.id,
      caseTitle: question.case.title,
      categoryName: question.case.category.name,
      snippet: match.snippet,
      source: match.source,
    });
  }

  return {
    cases,
    teachingPoints: teachingPoints.slice(0, limit),
  };
}

export async function getLibraryBrowse(): Promise<LibraryBrowseData> {
  const categories = await prisma.category.findMany({
    orderBy: { orderIndex: "asc" },
    include: {
      cases: {
        where: { status: "PUBLISHED" },
        select: {
          id: true,
          _count: { select: { questions: true } },
        },
      },
    },
  });

  const browseCategories: LibraryBrowseCategory[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    icon: category.icon,
    caseCount: category.cases.length,
    questionCount: category.cases.reduce((sum, kase) => sum + kase._count.questions, 0),
  }));

  const publishedCases = await prisma.case.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      chiefComplaint: true,
      teachingPoints: true,
      category: { select: { id: true, name: true } },
    },
  });

  const highYield: LibraryHighYieldCase[] = publishedCases
    .map((kase) => ({
      id: kase.id,
      title: kase.title,
      chiefComplaint: kase.chiefComplaint,
      teachingPointCount: kase.teachingPoints.length,
      category: kase.category,
    }))
    .filter((kase) => kase.teachingPointCount > 0)
    .sort((a, b) => b.teachingPointCount - a.teachingPointCount)
    .slice(0, 8);

  return {
    categories: browseCategories,
    highYield,
  };
}
