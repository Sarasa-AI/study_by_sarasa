import type { PerformanceTrend } from "@/lib/analytics-service";
import type { getWeeklyPerformanceContext } from "@/lib/analytics-service";

type DigestStreak = {
  currentStreak: number;
  longestStreak: number;
  lastQuizCompletedAt: Date | null;
};

export type DigestPromptStats = {
  trend: PerformanceTrend;
  thisWeekAccuracyPercent: number;
  priorWeekAccuracyPercent: number;
  thisWeekAttempts: number;
  priorWeekAttempts: number;
  topImprovedCategory: { name: string; deltaPercent: number } | null;
  weakAreaNames: string[];
  streak: DigestStreak;
};

export function extractStudentFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return "دانشجو";
  }

  return trimmed.split(/\s+/)[0] ?? "دانشجو";
}

export function formatAccuracyPercent(accuracy: number): number {
  return Math.round(accuracy * 100);
}

export function buildDigestPromptStats(
  weeklyContext: Awaited<ReturnType<typeof getWeeklyPerformanceContext>>,
  streak: DigestStreak,
): DigestPromptStats {
  return {
    trend: weeklyContext.trend,
    thisWeekAccuracyPercent: formatAccuracyPercent(weeklyContext.thisWeek.overallAccuracy),
    priorWeekAccuracyPercent: formatAccuracyPercent(weeklyContext.priorWeek.overallAccuracy),
    thisWeekAttempts: weeklyContext.thisWeek.totalAttempts,
    priorWeekAttempts: weeklyContext.priorWeek.totalAttempts,
    topImprovedCategory: weeklyContext.topImprovedCategory
      ? {
          name: weeklyContext.topImprovedCategory.name,
          deltaPercent: formatAccuracyPercent(weeklyContext.topImprovedCategory.delta),
        }
      : null,
    weakAreaNames: weeklyContext.thisWeek.weakAreas.map((area) => area.name),
    streak,
  };
}

export function buildDigestPrompt(stats: DigestPromptStats): string {
  const weakAreasText =
    stats.weakAreaNames.length > 0 ? stats.weakAreaNames.join("، ") : "موردی شناسایی نشده";

  const improvedCategoryText = stats.topImprovedCategory
    ? `${stats.topImprovedCategory.name} (بهبود حدود ${stats.topImprovedCategory.deltaPercent} درصد)`
    : "دسته‌ای با بهبود مشخص در این هفته گزارش نشده";

  return [
    "Generate a weekly learning digest email in Persian.",
    "",
    "Metrics (aggregated only):",
    `- Overall trend: ${stats.trend}`,
    `- This week accuracy: ${stats.thisWeekAccuracyPercent}% (${stats.thisWeekAttempts} attempts)`,
    `- Prior week accuracy: ${stats.priorWeekAccuracyPercent}% (${stats.priorWeekAttempts} attempts)`,
    `- Most improved category: ${improvedCategoryText}`,
    `- Weak areas to focus on: ${weakAreasText}`,
    `- Current streak: ${stats.streak.currentStreak} days`,
    `- Longest streak: ${stats.streak.longestStreak} days`,
    "",
    "Return JSON with:",
    '- "subject": a concise Persian email subject line',
    '- "bodyParagraphs": 2-4 Persian paragraphs for the email body',
  ].join("\n");
}
