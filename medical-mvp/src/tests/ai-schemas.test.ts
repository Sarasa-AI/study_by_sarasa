import { describe, expect, it } from "vitest";
import {
  aiCaseGenerationSchema,
  mapAiCaseToFormValues,
  normalizeAiCaseGeneration,
} from "@/lib/ai-schemas";

function buildQuestion(correctAnswer: "A" | "B" | "C" | "D" = "A") {
  const distractors = (["A", "B", "C", "D"] as const).filter((option) => option !== correctAnswer);
  return {
    questionText: "کدام اقدام مناسب‌تر است؟",
    optionA: "گزینه A",
    optionB: "گزینه B",
    optionC: "گزینه C",
    optionD: "گزینه D",
    correctAnswer,
    explanation: "توضیح پاسخ",
    clinicalReasoning: "استدلال بالینی گام‌به‌گام",
    distractorRationales: Object.fromEntries(
      distractors.map((option) => [option, `دلیل رد گزینه ${option}`]),
    ),
  };
}

describe("aiCaseGenerationSchema", () => {
  it("accepts multiple questions with correctAnswer", () => {
    const parsed = aiCaseGenerationSchema.parse({
      title: "کیس تست آپاندیسیت",
      chiefComplaint: "درد شکم",
      patientDemographics: { age: 12, gender: "پسر" },
      history: "شروع درد از ۱۲ ساعت قبل",
      physicalExam: "تندرنس RLQ",
      labResults: "",
      imaging: "",
      symptoms: ["درد شکم", "تهوع"],
      diagnosis: "آپاندیسیت حاد",
      differentialDiagnosis: ["گاستروانتریت"],
      management: "جراحی اورژانس",
      teachingPoints: ["تشخیص زودهنگام مهم است"],
      questions: [buildQuestion("A"), buildQuestion("B")],
    });

    expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions[0]?.correctAnswer).toBe("A");
    expect(parsed.questions[1]?.correctAnswer).toBe("B");
  });

  it("maps all questions into CaseFormValues", () => {
    const data = normalizeAiCaseGeneration(
      aiCaseGenerationSchema.parse({
        title: "کیس تست آپاندیسیت",
        chiefComplaint: "درد شکم",
        patientDemographics: { age: 12, gender: "پسر" },
        history: "شروع درد از ۱۲ ساعت قبل",
        physicalExam: "تندرنس RLQ",
        symptoms: ["درد شکم"],
        diagnosis: "آپاندیسیت حاد",
        differentialDiagnosis: ["گاستروانتریت"],
        management: "جراحی اورژانس",
        teachingPoints: ["نکته آموزشی"],
        questions: [buildQuestion("C")],
      }),
    );

    const formValues = mapAiCaseToFormValues(data, "cat-1");
    expect(formValues.categoryId).toBe("cat-1");
    expect(formValues.questions).toHaveLength(1);
    expect(formValues.questions[0]?.correctAnswer).toBe("C");
    expect(formValues.patientInfo).toContain("تندرنس RLQ");
    expect(formValues.referencesText).toBe("");
  });
});
