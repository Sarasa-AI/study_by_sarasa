import { redirect } from "next/navigation";

export default function LegacyExamRedirectPage() {
  redirect("/exams");
}
