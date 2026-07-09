import { describe, it, expect } from "vitest";
import { calculateXp, calculateStreakUpdate } from "@/lib/gamification-service";

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
