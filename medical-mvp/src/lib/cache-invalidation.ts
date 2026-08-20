import { revalidatePath, revalidateTag } from "next/cache";

export function invalidateCaseContent(caseId?: string): void {
  revalidatePath("/home");
  revalidatePath("/library");
  revalidatePath("/search");
  revalidatePath("/category/[id]", "page");
  revalidatePath("/instructor");
  revalidatePath("/instructor/reviews");
  revalidatePath("/instructor/cases/new");

  if (caseId) {
    revalidatePath(`/case/${caseId}`);
    revalidatePath(`/case/${caseId}/quiz`);
    revalidatePath(`/instructor/cases/${caseId}/edit`);
  }

  revalidateTag("cohort-analytics");
}

export function invalidateStudentProgress(sessionId?: string): void {
  revalidatePath("/home");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath("/exams");
  revalidatePath("/leaderboard");
  revalidatePath("/practice/review");
  revalidateTag("cohort-analytics");

  if (sessionId) {
    revalidatePath(`/exams/${sessionId}`);
    revalidatePath(`/exams/${sessionId}/results`);
  }
}

export function invalidateBookmarkState(caseId: string): void {
  revalidatePath("/bookmarks");
  revalidatePath(`/case/${caseId}`);
}

export function invalidateNoteState(caseId: string): void {
  revalidatePath("/notes");
  revalidatePath(`/case/${caseId}`);
}

export function invalidateFeedbackState(): void {
  revalidatePath("/instructor/feedback");
}
