import { AppShell } from "@/components/layout/AppShell";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const isInstructor = session.user.role === "INSTRUCTOR";

  return <AppShell isInstructor={isInstructor}>{children}</AppShell>;
}
