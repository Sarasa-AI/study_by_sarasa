import { z, type ZodError } from "zod";

export const answerOptions = ["A", "B", "C", "D"] as const;
export const mediaTypeValues = ["IMAGE", "VIDEO", "AUDIO"] as const;
export const caseStatusValues = ["DRAFT", "PUBLISHED"] as const;
export type MediaTypeValue = (typeof mediaTypeValues)[number];
export type CaseStatusValue = (typeof caseStatusValues)[number];

export type CaseActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
};

export function formatZodError(error: ZodError): string {
  return error.errors.map((issue) => issue.message).join("؛ ");
}

export function splitTextareaToArray(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinArrayToTextarea(items: string[] | null | undefined) {
  return (items ?? []).join("\n");
}

export const caseQuestionSchema = z.object({
  id: z.string().optional(),
  questionText: z.string().trim().min(1, "متن سوال الزامی است"),
  optionA: z.string().trim().min(1, "گزینه A الزامی است"),
  optionB: z.string().trim().min(1, "گزینه B الزامی است"),
  optionC: z.string().trim().min(1, "گزینه C الزامی است"),
  optionD: z.string().trim().min(1, "گزینه D الزامی است"),
  correctAnswer: z.enum(answerOptions, {
    errorMap: () => ({ message: "پاسخ صحیح نامعتبر است" }),
  }),
  explanation: z.string().trim().min(1, "توضیح پاسخ الزامی است"),
  clinicalReasoning: z.string().nullish(),
  distractorRationales: z.record(z.enum(answerOptions), z.string()).nullish(),
});

export const casePayloadSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters"),
  categoryId: z.string().trim().min(1, "دسته‌بندی الزامی است"),
  instructorId: z.string().trim().min(1, "شناسه استاد الزامی است"),
  chiefComplaint: z.string().trim().min(1, "شرح شکایت اصلی الزامی است"),
  patientInfo: z.string().trim().min(1, "اطلاعات بیمار الزامی است"),
  mediaUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((value) => !value || /^https?:\/\/.+/.test(value), "آدرس رسانه معتبر نیست")
    .transform((value) => value || null),
  mediaType: z.enum(mediaTypeValues).nullable().optional(),
  symptoms: z.array(z.string().trim().min(1)).min(1, "حداقل یک علامت وارد کنید"),
  diagnosis: z.string().trim().min(1, "تشخیص الزامی است"),
  differentialDiagnosis: z.array(z.string().trim().min(1)).min(1, "حداقل یک تشخیص افتراقی وارد کنید"),
  management: z.string().trim().min(1, "مدیریت الزامی است"),
  teachingPoints: z.array(z.string().trim().min(1)).min(1, "حداقل یک نکته آموزشی وارد کنید"),
  status: z.enum(caseStatusValues),
  questions: z.array(caseQuestionSchema).min(1, "حداقل یک سوال لازم است"),
});

export type CasePayload = z.infer<typeof casePayloadSchema>;
export const caseSchema = casePayloadSchema;

export const caseFormSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters"),
  categoryId: z.string().trim().min(1, "دسته‌بندی الزامی است"),
  chiefComplaint: z.string().trim().min(1, "شرح شکایت اصلی الزامی است"),
  patientInfo: z.string().trim().min(1, "اطلاعات بیمار الزامی است"),
  mediaUrl: z.string().trim(),
  mediaType: z.enum(mediaTypeValues).nullable().optional(),
  symptomsText: z.string().trim().min(1, "حداقل یک علامت وارد کنید"),
  diagnosis: z.string().trim().min(1, "تشخیص الزامی است"),
  differentialDiagnosisText: z.string().trim().min(1, "حداقل یک تشخیص افتراقی وارد کنید"),
  management: z.string().trim().min(1, "مدیریت الزامی است"),
  teachingPointsText: z.string().trim().min(1, "حداقل یک نکته آموزشی وارد کنید"),
  questions: z.array(caseQuestionSchema).min(1, "حداقل یک سوال لازم است"),
});

export type CaseFormValues = z.infer<typeof caseFormSchema>;

export function toCasePayload(formValues: CaseFormValues, instructorId: string, status: CaseStatusValue): CasePayload {
  return casePayloadSchema.parse({
    title: formValues.title,
    categoryId: formValues.categoryId,
    instructorId,
    chiefComplaint: formValues.chiefComplaint,
    patientInfo: formValues.patientInfo,
    mediaUrl: formValues.mediaUrl?.trim() || null,
    mediaType: formValues.mediaUrl?.trim() ? formValues.mediaType ?? "IMAGE" : null,
    symptoms: splitTextareaToArray(formValues.symptomsText),
    diagnosis: formValues.diagnosis,
    differentialDiagnosis: splitTextareaToArray(formValues.differentialDiagnosisText),
    management: formValues.management,
    teachingPoints: splitTextareaToArray(formValues.teachingPointsText),
    status,
    questions: formValues.questions,
  });
}

type CaseLike = {
  title: string;
  categoryId: string;
  chiefComplaint: string;
  patientInfo: string;
  mediaUrl: string | null;
  mediaType: MediaTypeValue | null;
  symptoms: string[];
  diagnosis: string;
  differentialDiagnosis: string[];
  management: string;
  teachingPoints: string[];
  questions: Array<{
    id: string;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: "A" | "B" | "C" | "D";
    explanation: string;
    clinicalReasoning?: string | null;
    distractorRationales?: Partial<Record<"A" | "B" | "C" | "D", string>> | null;
  }>;
};

export function toCaseFormValues(kase?: CaseLike | null): CaseFormValues {
  if (!kase) {
    return {
      title: "",
      categoryId: "",
      chiefComplaint: "",
      patientInfo: "",
      mediaUrl: "",
      mediaType: "IMAGE",
      symptomsText: "",
      diagnosis: "",
      differentialDiagnosisText: "",
      management: "",
      teachingPointsText: "",
      questions: [
        {
          questionText: "",
          optionA: "",
          optionB: "",
          optionC: "",
          optionD: "",
          correctAnswer: "A",
          explanation: "",
          clinicalReasoning: null,
          distractorRationales: null,
        },
      ],
    };
  }

  return {
    title: kase.title,
    categoryId: kase.categoryId,
    chiefComplaint: kase.chiefComplaint,
    patientInfo: kase.patientInfo,
    mediaUrl: kase.mediaUrl ?? "",
    mediaType: kase.mediaType ?? "IMAGE",
    symptomsText: joinArrayToTextarea(kase.symptoms),
    diagnosis: kase.diagnosis,
    differentialDiagnosisText: joinArrayToTextarea(kase.differentialDiagnosis),
    management: kase.management,
    teachingPointsText: joinArrayToTextarea(kase.teachingPoints),
    questions: kase.questions.map((question) => ({
      id: question.id,
      questionText: question.questionText,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      clinicalReasoning: question.clinicalReasoning ?? null,
      distractorRationales: question.distractorRationales ?? null,
    })),
  };
}
