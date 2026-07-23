import { describe, it, expect } from "vitest";
import {
  gradeQuiz,
  parseDistractorRationales,
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
      clinicalReasoning: "Step-by-step for q1",
      distractorRationales: {
        B: "B is wrong because...",
        C: "C is wrong because...",
        D: "D is wrong because...",
      },
      points: 2,
    },
    {
      id: "q2",
      correctAnswer: "B",
      explanation: "Explanation for q2",
      clinicalReasoning: "Step-by-step for q2",
      distractorRationales: {
        A: "A is wrong because...",
        C: "C is wrong because...",
        D: "D is wrong because...",
      },
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
      clinicalReasoning: "Step-by-step for q1",
      distractorRationales: {
        B: "B is wrong because...",
        C: "C is wrong because...",
        D: "D is wrong because...",
      },
    });
    expect(result.feedback[1]).toMatchObject({
      questionId: "q2",
      isCorrect: false,
      selected: "C",
      correctAnswer: "B",
      explanation: "Explanation for q2",
      clinicalReasoning: "Step-by-step for q2",
      distractorRationales: {
        A: "A is wrong because...",
        C: "C is wrong because...",
        D: "D is wrong because...",
      },
    });
  });

  it("treats missing answers as incorrect (exam auto-submit)", () => {
    const result = gradeQuiz(questions, { q1: "A" });

    expect(result.score).toBe(2);
    expect(result.total).toBe(3);
    expect(result.feedback[0]).toMatchObject({
      questionId: "q1",
      selected: "A",
      isCorrect: true,
    });
    expect(result.feedback[1]).toMatchObject({
      questionId: "q2",
      selected: null,
      isCorrect: false,
      correctAnswer: "B",
      explanation: "Explanation for q2",
    });
  });
});

describe("parseDistractorRationales", () => {
  it("keeps only valid option keys with non-empty text", () => {
    expect(
      parseDistractorRationales({
        A: " bad A ",
        B: "",
        E: "ignore",
        C: "ok C",
      }),
    ).toEqual({ A: "bad A", C: "ok C" });
  });

  it("returns null for empty or invalid input", () => {
    expect(parseDistractorRationales(null)).toBeNull();
    expect(parseDistractorRationales([])).toBeNull();
    expect(parseDistractorRationales({ A: "   " })).toBeNull();
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
