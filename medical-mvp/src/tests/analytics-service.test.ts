import { describe, it, expect } from "vitest";
import {
  bucketAccuracyByDay,
  classifyCategoryStrength,
  getLast30DaysRange,
  type CategoryBreakdownItem,
} from "@/lib/analytics-service";

function makeCategory(
  overrides: Partial<CategoryBreakdownItem> & Pick<CategoryBreakdownItem, "categoryId" | "name">,
): CategoryBreakdownItem {
  return {
    slug: overrides.name,
    totalAnswered: 10,
    correctAnswers: 5,
    accuracy: 0.5,
    attempts: 1,
    ...overrides,
  };
}

describe("getLast30DaysRange", () => {
  it("returns a 30-day inclusive window ending tomorrow UTC midnight", () => {
    const now = new Date("2026-07-23T15:30:00.000Z");
    const range = getLast30DaysRange(now);

    expect(range.since?.toISOString()).toBe("2026-06-24T00:00:00.000Z");
    expect(range.until?.toISOString()).toBe("2026-07-24T00:00:00.000Z");
  });
});

describe("bucketAccuracyByDay", () => {
  it("fills exactly 30 daily buckets ending on the given day", () => {
    const now = new Date("2026-07-23T12:00:00.000Z");
    const points = bucketAccuracyByDay([], [], now);

    expect(points).toHaveLength(30);
    expect(points[0]?.date).toBe("2026-06-24");
    expect(points[29]?.date).toBe("2026-07-23");
    expect(points.every((point) => point.questionsAnswered === 0)).toBe(true);
  });

  it("aggregates quiz accuracy and mistake counts per UTC day", () => {
    const now = new Date("2026-07-23T12:00:00.000Z");
    const points = bucketAccuracyByDay(
      [
        { score: 3, totalQuestions: 4, completedAt: new Date("2026-07-23T08:00:00.000Z") },
        { score: 1, totalQuestions: 2, completedAt: new Date("2026-07-23T18:00:00.000Z") },
        { score: 2, totalQuestions: 2, completedAt: new Date("2026-07-20T10:00:00.000Z") },
      ],
      [
        { createdAt: new Date("2026-07-23T09:00:00.000Z") },
        { createdAt: new Date("2026-07-23T11:00:00.000Z") },
        { createdAt: new Date("2026-07-21T11:00:00.000Z") },
      ],
      now,
    );

    const today = points.find((point) => point.date === "2026-07-23");
    const earlier = points.find((point) => point.date === "2026-07-20");
    const mistakeOnly = points.find((point) => point.date === "2026-07-21");

    expect(today?.questionsAnswered).toBe(6);
    expect(today?.correctAnswers).toBe(4);
    expect(today?.accuracy).toBeCloseTo(4 / 6);
    expect(today?.mistakesCreated).toBe(2);

    expect(earlier?.accuracy).toBe(1);
    expect(earlier?.mistakesCreated).toBe(0);

    expect(mistakeOnly?.questionsAnswered).toBe(0);
    expect(mistakeOnly?.accuracy).toBe(0);
    expect(mistakeOnly?.mistakesCreated).toBe(1);
  });

  it("ignores rows outside the 30-day window", () => {
    const now = new Date("2026-07-23T12:00:00.000Z");
    const points = bucketAccuracyByDay(
      [{ score: 5, totalQuestions: 5, completedAt: new Date("2026-06-01T12:00:00.000Z") }],
      [{ createdAt: new Date("2026-05-01T12:00:00.000Z") }],
      now,
    );

    expect(points.every((point) => point.questionsAnswered === 0)).toBe(true);
    expect(points.every((point) => point.mistakesCreated === 0)).toBe(true);
  });
});

describe("classifyCategoryStrength", () => {
  it("splits categories into needsFocus (<50%) and mastered (>75%)", () => {
    const categories = [
      makeCategory({ categoryId: "1", name: "ضعیف", accuracy: 0.4, attempts: 2 }),
      makeCategory({ categoryId: "2", name: "مرزی-ضعیف", accuracy: 0.49, attempts: 1 }),
      makeCategory({ categoryId: "3", name: "متوسط", accuracy: 0.6, attempts: 3 }),
      makeCategory({ categoryId: "4", name: "مرزی-قوی", accuracy: 0.75, attempts: 2 }),
      makeCategory({ categoryId: "5", name: "مسلط", accuracy: 0.9, attempts: 4 }),
      makeCategory({ categoryId: "6", name: "بدون تلاش", accuracy: 0.1, attempts: 0 }),
    ];

    const { needsFocus, mastered } = classifyCategoryStrength(categories);

    expect(needsFocus.map((c) => c.name)).toEqual(["ضعیف", "مرزی-ضعیف"]);
    expect(mastered.map((c) => c.name)).toEqual(["مسلط"]);
  });
});
