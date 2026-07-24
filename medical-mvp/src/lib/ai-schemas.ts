import { z } from "zod";
import { answerOptions, type CaseFormValues } from "@/lib/case-schema";

export const aiCaseQuestionSchema = z
  .object({
    questionText: z.string().trim().min(1, "متن سوال الزامی است"),
    optionA: z.string().trim().min(1, "گزینه A الزامی است"),
    optionB: z.string().trim().min(1, "گزینه B الزامی است"),
    optionC: z.string().trim().min(1, "گزینه C الزامی است"),
    optionD: z.string().trim().min(1, "گزینه D الزامی است"),
    correctAnswer: z.enum(answerOptions, {
      errorMap: () => ({ message: "پاسخ صحیح باید A، B، C یا D باشد" }),
    }),
    explanation: z.string().trim().min(1, "توضیح پاسخ الزامی است"),
    clinicalReasoning: z.string().trim().min(1, "استدلال بالینی الزامی است"),
    distractorRationales: z
      .record(z.enum(answerOptions), z.string().trim().min(1))
      .refine((r) => Object.keys(r).length === 3, {
        message: "باید برای هر سه گزینه نادرست rationale وجود داشته باشد",
      }),
  })
  .superRefine((question, ctx) => {
    const keys = Object.keys(question.distractorRationales);
    if (keys.includes(question.correctAnswer)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["distractorRationales"],
        message: "rationale نباید برای گزینه صحیح باشد",
      });
    }
  });

export const aiCaseGenerationSchema = z.object({
  title: z.string().trim().min(5, "عنوان باید حداقل ۵ کاراکتر باشد"),
  chiefComplaint: z.string().trim().min(1, "شکایت اصلی الزامی است"),
  patientDemographics: z.object({
    age: z.union([z.number().int().positive(), z.string().trim().min(1)]),
    gender: z.string().trim().min(1, "جنسیت الزامی است"),
  }),
  history: z.string().trim().min(1, "شرح حال الزامی است"),
  physicalExam: z.string().trim().min(1, "معاینه فیزیکی الزامی است"),
  labResults: z.string().default(""),
  imaging: z.string().default(""),
  symptoms: z.array(z.string().trim().min(1)).min(1, "حداقل یک علامت لازم است"),
  diagnosis: z.string().trim().min(1, "تشخیص الزامی است"),
  differentialDiagnosis: z
    .array(z.string().trim().min(1))
    .min(1, "حداقل یک تشخیص افتراقی لازم است"),
  management: z.string().trim().min(1, "مدیریت الزامی است"),
  teachingPoints: z.array(z.string().trim().min(1)).min(1, "حداقل یک نکته آموزشی لازم است"),
  questions: z.array(aiCaseQuestionSchema).min(1).max(3),
});

export type AiCaseGeneration = {
  title: string;
  chiefComplaint: string;
  patientDemographics: {
    age: number | string;
    gender: string;
  };
  history: string;
  physicalExam: string;
  labResults: string;
  imaging: string;
  symptoms: string[];
  diagnosis: string;
  differentialDiagnosis: string[];
  management: string;
  teachingPoints: string[];
  questions: z.infer<typeof aiCaseQuestionSchema>[];
};

/** RAG-grounded case schema — requires an exact source citation string. */
export const aiRagCaseGenerationSchema = aiCaseGenerationSchema.extend({
  referenceText: z.string().trim().min(1, "منبع استناد (referenceText) الزامی است"),
});

export type AiRagCaseGeneration = AiCaseGeneration & {
  referenceText: string;
};

export function normalizeAiCaseGeneration(data: z.infer<typeof aiCaseGenerationSchema>): AiCaseGeneration {
  return {
    ...data,
    labResults: data.labResults ?? "",
    imaging: data.imaging ?? "",
  };
}

export function normalizeAiRagCaseGeneration(
  data: z.infer<typeof aiRagCaseGenerationSchema>,
): AiRagCaseGeneration {
  const base = normalizeAiCaseGeneration(data);
  return {
    ...base,
    referenceText: data.referenceText.trim(),
  };
}

export function buildPatientInfoFromAi(data: AiCaseGeneration): string {
  return JSON.stringify({
    age: data.patientDemographics.age,
    gender: data.patientDemographics.gender,
    chiefComplaint: data.chiefComplaint,
    history: data.history,
    physicalExam: data.physicalExam,
    labResults: data.labResults ?? "",
    imaging: data.imaging ?? "",
  });
}

export const mentorReplySchema = z.object({
  reply: z.string().trim().min(1),
  clinicalReasoning: z.array(z.string().trim().min(1)).optional(),
});

export type MentorReply = z.infer<typeof mentorReplySchema>;

export const weeklyDigestSchema = z.object({
  subject: z.string().trim().min(5).max(120),
  bodyParagraphs: z.array(z.string().trim().min(10)).min(2).max(5),
});

export type WeeklyDigestContent = z.infer<typeof weeklyDigestSchema>;

export function mapAiCaseToFormValues(data: AiCaseGeneration, categoryId: string): CaseFormValues {
  return {
    title: data.title,
    categoryId,
    chiefComplaint: data.chiefComplaint,
    patientInfo: buildPatientInfoFromAi(data),
    mediaUrl: "",
    mediaType: "IMAGE",
    symptomsText: data.symptoms.join("\n"),
    diagnosis: data.diagnosis,
    differentialDiagnosisText: data.differentialDiagnosis.join("\n"),
    management: data.management,
    teachingPointsText: data.teachingPoints.join("\n"),
    questions: data.questions.map((question) => ({
      questionText: question.questionText,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      clinicalReasoning: question.clinicalReasoning,
      distractorRationales: question.distractorRationales,
    })),
  };
}
