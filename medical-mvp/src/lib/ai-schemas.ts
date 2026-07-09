import { z } from "zod";
import { answerOptions, type CaseFormValues } from "@/lib/case-schema";

export const aiCaseQuestionSchema = z.object({
  questionText: z.string().trim().min(1, "متن سوال الزامی است"),
  optionA: z.string().trim().min(1, "گزینه A الزامی است"),
  optionB: z.string().trim().min(1, "گزینه B الزامی است"),
  optionC: z.string().trim().min(1, "گزینه C الزامی است"),
  optionD: z.string().trim().min(1, "گزینه D الزامی است"),
  correctOption: z.enum(answerOptions, {
    errorMap: () => ({ message: "پاسخ صحیح باید A، B، C یا D باشد" }),
  }),
  explanation: z.string().trim().min(1, "توضیح پاسخ الزامی است"),
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
  question: aiCaseQuestionSchema,
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
  question: z.infer<typeof aiCaseQuestionSchema>;
};

export function normalizeAiCaseGeneration(data: z.infer<typeof aiCaseGenerationSchema>): AiCaseGeneration {
  return {
    ...data,
    labResults: data.labResults ?? "",
    imaging: data.imaging ?? "",
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
    questions: [
      {
        questionText: data.question.questionText,
        optionA: data.question.optionA,
        optionB: data.question.optionB,
        optionC: data.question.optionC,
        optionD: data.question.optionD,
        correctAnswer: data.question.correctOption,
        explanation: data.question.explanation,
      },
    ],
  };
}
