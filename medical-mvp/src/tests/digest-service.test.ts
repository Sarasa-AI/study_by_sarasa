import { describe, it, expect } from "vitest";
import {
  computePerformanceTrend,
  findTopImprovedCategory,
  type StudentPerformanceStats,
} from "@/lib/analytics-service";
import {
  buildDigestPromptStats,
  extractStudentFirstName,
  formatAccuracyPercent,
} from "@/lib/digest-helpers";
import { verifyCronSecret } from "@/lib/cron-auth";

function makeStats(
  overallAccuracy: number,
  categories: Array<{
    categoryId: string;
    name: string;
    accuracy: number;
    attempts: number;
  }>,
  totalAttempts: number,
): StudentPerformanceStats {
  const categoryAccuracy = categories.map((category) => ({
    ...category,
    slug: category.name,
  }));

  return {
    overallAccuracy,
    categoryAccuracy,
    weakAreas: categoryAccuracy.filter((category) => category.accuracy < 0.6),
    totalAttempts,
  };
}

describe("computePerformanceTrend", () => {
  it("returns insufficient_data when both weeks have no attempts", () => {
    expect(computePerformanceTrend(0.8, 0.7, 0, 0)).toBe("insufficient_data");
  });

  it("returns improving when accuracy rises above threshold", () => {
    expect(computePerformanceTrend(0.85, 0.7, 3, 2)).toBe("improving");
  });

  it("returns declining when accuracy drops below threshold", () => {
    expect(computePerformanceTrend(0.6, 0.8, 3, 2)).toBe("declining");
  });

  it("returns stable when change is within threshold", () => {
    expect(computePerformanceTrend(0.72, 0.7, 3, 2)).toBe("stable");
  });
});

describe("findTopImprovedCategory", () => {
  it("returns the category with the largest positive delta", () => {
    const thisWeek = makeStats(
      0.8,
      [
        { categoryId: "a", name: "قلب", accuracy: 0.9, attempts: 2 },
        { categoryId: "b", name: "عفونی", accuracy: 0.7, attempts: 2 },
      ],
      4,
    );

    const priorWeek = makeStats(
      0.65,
      [
        { categoryId: "a", name: "قلب", accuracy: 0.7, attempts: 2 },
        { categoryId: "b", name: "عفونی", accuracy: 0.6, attempts: 2 },
      ],
      4,
    );

    const result = findTopImprovedCategory(thisWeek, priorWeek);
    expect(result?.name).toBe("قلب");
    expect(result?.delta).toBeCloseTo(0.2);
  });

  it("ignores categories without attempts in both weeks", () => {
    const thisWeek = makeStats(0.8, [{ categoryId: "a", name: "قلب", accuracy: 0.9, attempts: 1 }], 1);
    const priorWeek = makeStats(0.7, [{ categoryId: "a", name: "قلب", accuracy: 0.7, attempts: 0 }], 0);

    expect(findTopImprovedCategory(thisWeek, priorWeek)).toBeNull();
  });
});

describe("extractStudentFirstName", () => {
  it("returns the first token from a full name", () => {
    expect(extractStudentFirstName("سارا احمدی")).toBe("سارا");
  });

  it("falls back when name is empty", () => {
    expect(extractStudentFirstName("   ")).toBe("دانشجو");
  });
});

describe("formatAccuracyPercent", () => {
  it("rounds fractional accuracy to whole percent", () => {
    expect(formatAccuracyPercent(0.756)).toBe(76);
  });
});

describe("buildDigestPromptStats", () => {
  it("sanitizes weekly metrics for AI prompt usage", () => {
    const stats = buildDigestPromptStats(
      {
        thisWeek: makeStats(0.8, [{ categoryId: "a", name: "قلب", accuracy: 0.5, attempts: 2 }], 2),
        priorWeek: makeStats(0.7, [{ categoryId: "a", name: "قلب", accuracy: 0.7, attempts: 2 }], 2),
        trend: "improving",
        topImprovedCategory: null,
      },
      {
        currentStreak: 3,
        longestStreak: 5,
        lastQuizCompletedAt: new Date("2026-07-08T10:00:00.000Z"),
      },
    );

    expect(stats.thisWeekAccuracyPercent).toBe(80);
    expect(stats.weakAreaNames).toEqual(["قلب"]);
    expect(stats.streak.currentStreak).toBe(3);
    expect(stats).not.toHaveProperty("studentCode");
  });
});

describe("verifyCronSecret", () => {
  it("accepts a valid bearer token", () => {
    expect(verifyCronSecret("Bearer test-secret", "test-secret")).toBe(true);
  });

  it("rejects missing or invalid bearer token", () => {
    expect(verifyCronSecret(null, "test-secret")).toBe(false);
    expect(verifyCronSecret("Bearer wrong", "test-secret")).toBe(false);
    expect(verifyCronSecret("Bearer test-secret", undefined)).toBe(false);
  });
});
