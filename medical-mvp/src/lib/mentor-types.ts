import type { QuizResultData } from "@/lib/quiz";

export type MentorChatMessage = { role: "user" | "assistant"; content: string };

export type ClinicalMentorCaseContext = {
  id: string;
  title: string;
  chiefComplaint: string;
  patientInfo: {
    age?: number | string;
    gender?: string;
    history?: string;
    physicalExam?: string;
    labResults?: string;
    imaging?: string;
  };
  symptoms: string[];
  diagnosis: string;
  differentialDiagnosis: string[];
  management: string;
  teachingPoints: string[];
  questions: Array<{
    id: string;
    questionText: string;
    options: Record<"A" | "B" | "C" | "D", string>;
  }>;
};

export type MentorQuizContext = {
  answers: Record<string, "A" | "B" | "C" | "D" | undefined>;
  result: QuizResultData | null;
};

export type MentorChatResult = {
  success: boolean;
  message: string;
  data?: { reply: string; clinicalReasoning?: string[] };
};
