import type { ClinicalMentorCaseContext } from "@/lib/mentor-types";
import { serializeQuizQuestions } from "@/lib/quiz";

type CaseWithQuestions = {
  id: string;
  title: string;
  chiefComplaint: string;
  patientInfo: string;
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
    orderIndex: number;
  }>;
};

export function buildMentorCaseContext(kase: CaseWithQuestions): ClinicalMentorCaseContext {
  const patient = JSON.parse(kase.patientInfo || "{}") as ClinicalMentorCaseContext["patientInfo"];

  return {
    id: kase.id,
    title: kase.title,
    chiefComplaint: kase.chiefComplaint,
    patientInfo: patient,
    symptoms: kase.symptoms,
    diagnosis: kase.diagnosis,
    differentialDiagnosis: kase.differentialDiagnosis,
    management: kase.management,
    teachingPoints: kase.teachingPoints,
    questions: serializeQuizQuestions(kase.questions).map(({ id, questionText, options }) => ({
      id,
      questionText,
      options,
    })),
  };
}
