import { describe, it, expect } from "vitest";
import {
  calculateQuizXp,
  calculateStreak,
  gradeQuiz,
  scoreAnswers,
  validateQuizAnswers,
} from "@/lib/quiz";

describe("scoreAnswers", () => {
  it("calculates score correctly", () => {
    const correct = {
      q1: { answer: "A", points: 2 },
      q2: { answer: "B", points: 1 },
      q3: { answer: "D", points: 3 },
    };
    const user = { q1: "A", q2: "C", q3: "D" };
    const { score, total } = scoreAnswers(correct, user);
    expect(total).toBe(6);
    expect(score).toBe(5);
  });
});

describe("gradeQuiz", () => {
  const questions = [
    {
      id: "q1",
      correctAnswer: "A",
      explanation: "Explanation for q1",
      points: 2,
    },
    {
      id: "q2",
      correctAnswer: "B",
      explanation: "Explanation for q2",
      points: 1,
    },
  ];

  it("returns feedback with explanations for wrong answers", () => {
    const answers = { q1: "A", q2: "C" };
    const result = gradeQuiz(questions, answers);

    expect(result.score).toBe(2);
    expect(result.total).toBe(3);
    expect(result.percent).toBe(67);
    expect(result.feedback).toHaveLength(2);
    expect(result.feedback[0]).toMatchObject({
      questionId: "q1",
      isCorrect: true,
      explanation: null,
    });
    expect(result.feedback[1]).toMatchObject({
      questionId: "q2",
      isCorrect: false,
      selected: "C",
      correctAnswer: "B",
      explanation: "Explanation for q2",
    });
  });
});

describe("validateQuizAnswers", () => {
  it("accepts valid answers for all questions", () => {
    const parsed = validateQuizAnswers(["q1", "q2"], { q1: "A", q2: "D" });
    expect(parsed).toEqual({ q1: "A", q2: "D" });
  });

  it("rejects missing or invalid answers", () => {
    expect(() => validateQuizAnswers(["q1", "q2"], { q1: "A" })).toThrow();
    expect(() => validateQuizAnswers(["q1"], { q1: "E" })).toThrow();
  });
});

describe("calculateQuizXp", () => {
  it("awards 10 XP per correct answer", () => {
    const result = calculateQuizXp({ correctCount: 4, completionTimeSeconds: null, currentStreak: 1 });
    expect(result.basePoints).toBe(40);
    expect(result.speedBonus).toBe(0);
    expect(result.streakBonus).toBe(0);
    expect(result.total).toBe(40);
  });

  it("awards speed bonus at 300 seconds or less", () => {
    const fast = calculateQuizXp({ correctCount: 2, completionTimeSeconds: 300, currentStreak: 1 });
    expect(fast.speedBonus).toBe(20);
    expect(fast.total).toBe(40);

    const slow = calculateQuizXp({ correctCount: 2, completionTimeSeconds: 301, currentStreak: 1 });
    expect(slow.speedBonus).toBe(0);
    expect(slow.total).toBe(20);
  });

  it("awards streak bonus when streak is 3 or more", () => {
    const noBonus = calculateQuizXp({ correctCount: 1, completionTimeSeconds: null, currentStreak: 2 });
    expect(noBonus.streakBonus).toBe(0);

    const withBonus = calculateQuizXp({ correctCount: 1, completionTimeSeconds: null, currentStreak: 3 });
    expect(withBonus.streakBonus).toBe(50);
    expect(withBonus.total).toBe(60);
  });
});

describe("calculateStreak", () => {
  const now = new Date("2026-06-30T12:00:00.000Z");

  it("starts at 1 with no prior completion", () => {
    expect(calculateStreak(null, now, 0)).toEqual({
      newStreak: 1,
      streakBroken: false,
      isNewMilestone: false,
    });
  });

  it("keeps streak on same UTC day", () => {
    const last = new Date("2026-06-30T08:00:00.000Z");
    expect(calculateStreak(last, now, 3)).toEqual({
      newStreak: 3,
      streakBroken: false,
      isNewMilestone: false,
    });
  });

  it("increments on consecutive UTC day", () => {
    const last = new Date("2026-06-29T20:00:00.000Z");
    expect(calculateStreak(last, now, 2)).toEqual({
      newStreak: 3,
      streakBroken: false,
      isNewMilestone: true,
    });
  });

  it("resets when gap exceeds 48 hours", () => {
    const last = new Date("2026-06-27T10:00:00.000Z");
    expect(calculateStreak(last, now, 5)).toEqual({
      newStreak: 1,
      streakBroken: true,
      isNewMilestone: false,
    });
  });
});
