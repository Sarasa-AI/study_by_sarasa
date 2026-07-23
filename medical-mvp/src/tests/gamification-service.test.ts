import { describe, it, expect } from "vitest";
import {
  calculateXp,
  calculateStreakUpdate,
  evaluateAchievementUnlocks,
  getAchievementCurrentValue,
  isAchievementEarned,
  type AchievementDef,
  type UserAchievementStats,
} from "@/lib/gamification-service";

describe("calculateXp", () => {
  it("awards base completion XP only", () => {
    expect(calculateXp(0.5, false)).toBe(10);
  });

  it("awards high accuracy bonus at 0.8 or above", () => {
    expect(calculateXp(0.8, false)).toBe(15);
    expect(calculateXp(1, false)).toBe(15);
  });

  it("awards remedial bonus for weak-area practice", () => {
    expect(calculateXp(0.5, true)).toBe(25);
  });

  it("awards all bonuses when accuracy is high and remedial", () => {
    expect(calculateXp(0.9, true)).toBe(30);
  });
});

describe("calculateStreakUpdate", () => {
  const now = new Date("2026-06-30T12:00:00.000Z");

  it("starts at 1 with no prior completion", () => {
    expect(calculateStreakUpdate(null, now, 0)).toEqual({
      newStreak: 1,
      streakMaintained: false,
    });
  });

  it("keeps streak on same UTC day", () => {
    const last = new Date("2026-06-30T08:00:00.000Z");
    expect(calculateStreakUpdate(last, now, 3)).toEqual({
      newStreak: 3,
      streakMaintained: true,
    });
  });

  it("increments on consecutive UTC day", () => {
    const last = new Date("2026-06-29T20:00:00.000Z");
    expect(calculateStreakUpdate(last, now, 2)).toEqual({
      newStreak: 3,
      streakMaintained: true,
    });
  });

  it("resets when gap is more than one UTC day", () => {
    const last = new Date("2026-06-27T10:00:00.000Z");
    expect(calculateStreakUpdate(last, now, 5)).toEqual({
      newStreak: 1,
      streakMaintained: false,
    });
  });
});

describe("atomic streak SQL parity scenarios", () => {
  const now = new Date("2026-06-30T12:00:00.000Z");

  const scenarios = [
    {
      label: "first completion",
      priorLastCompletedAt: null,
      currentStreak: 0,
      expected: { newStreak: 1, streakMaintained: false },
    },
    {
      label: "same UTC day",
      priorLastCompletedAt: new Date("2026-06-30T08:00:00.000Z"),
      currentStreak: 3,
      expected: { newStreak: 3, streakMaintained: true },
    },
    {
      label: "consecutive UTC day",
      priorLastCompletedAt: new Date("2026-06-29T20:00:00.000Z"),
      currentStreak: 2,
      expected: { newStreak: 3, streakMaintained: true },
    },
    {
      label: "streak reset after gap",
      priorLastCompletedAt: new Date("2026-06-27T10:00:00.000Z"),
      currentStreak: 5,
      expected: { newStreak: 1, streakMaintained: false },
    },
  ] as const;

  it.each(scenarios)(
    "matches calculateStreakUpdate for $label (SQL uses equivalent UTC day logic)",
    ({ priorLastCompletedAt, currentStreak, expected }) => {
      expect(calculateStreakUpdate(priorLastCompletedAt, now, currentStreak)).toEqual(expected);
    },
  );
});

const sampleAchievements: AchievementDef[] = [
  {
    id: "a1",
    code: "STREAK_7",
    title: "استریک ۷ روزه",
    description: "هفت روز",
    icon: "⚡",
    category: "STREAK",
    threshold: 7,
  },
  {
    id: "a2",
    code: "CASES_10",
    title: "۱۰ کیس",
    description: "ده کیس",
    icon: "📚",
    category: "CASES",
    threshold: 10,
  },
  {
    id: "a3",
    code: "FLASHCARDS_50",
    title: "۵۰ فلش‌کارت",
    description: "پنجاه کارت",
    icon: "🧠",
    category: "FLASHCARDS",
    threshold: 50,
  },
  {
    id: "a4",
    code: "ACCURACY_80",
    title: "دقت ۸۰٪",
    description: "دقت بالا",
    icon: "🎯",
    category: "ACCURACY",
    threshold: 80,
  },
  {
    id: "a5",
    code: "QUESTIONS_50",
    title: "۵۰ سوال",
    description: "پنجاه سوال",
    icon: "✅",
    category: "ACCURACY",
    threshold: 50,
  },
];

describe("achievement eligibility helpers", () => {
  const baseStats: UserAchievementStats = {
    currentStreak: 7,
    completedCases: 10,
    flashcardsReviewed: 12,
    questionsAnswered: 25,
    accuracyPercent: 85,
  };

  it("maps current values by category and special codes", () => {
    expect(getAchievementCurrentValue(sampleAchievements[0]!, baseStats)).toBe(7);
    expect(getAchievementCurrentValue(sampleAchievements[1]!, baseStats)).toBe(10);
    expect(getAchievementCurrentValue(sampleAchievements[2]!, baseStats)).toBe(12);
    expect(getAchievementCurrentValue(sampleAchievements[3]!, baseStats)).toBe(85);
    expect(getAchievementCurrentValue(sampleAchievements[4]!, baseStats)).toBe(25);
  });

  it("requires min questions for ACCURACY_80", () => {
    expect(
      isAchievementEarned(sampleAchievements[3]!, {
        ...baseStats,
        questionsAnswered: 10,
        accuracyPercent: 90,
      }),
    ).toBe(false);

    expect(isAchievementEarned(sampleAchievements[3]!, baseStats)).toBe(true);
  });

  it("returns only newly earned achievements", () => {
    const unlocked = evaluateAchievementUnlocks(
      baseStats,
      sampleAchievements,
      new Set(["a1"]),
    );

    expect(unlocked.map((a) => a.code).sort()).toEqual(["ACCURACY_80", "CASES_10"]);
  });

  it("does not unlock flashcard badge below threshold", () => {
    expect(isAchievementEarned(sampleAchievements[2]!, baseStats)).toBe(false);
  });
});
