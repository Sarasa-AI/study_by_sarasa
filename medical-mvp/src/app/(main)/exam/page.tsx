import { redirect } from "next/navigation";
import { ExamPageClient } from "@/components/exam/ExamPageClient";
import { getSessionUser } from "@/lib/auth";
import { listExamCategories } from "@/lib/exam-service";

export default async function ExamPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    redirect("/login");
  }

  const categories = await listExamCategories();

  return <ExamPageClient categories={categories} />;
}
