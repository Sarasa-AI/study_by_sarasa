import { AppShell } from "@/components/layout/AppShell";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getGamificationStats } from "@/lib/gamification-actions";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const isInstructor = session.user.role === "INSTRUCTOR";
  const statsResult = await getGamificationStats();
  const gamification = statsResult.success
    ? {
        totalXP: statsResult.data.totalXP,
        currentStreak: statsResult.data.currentStreak,
        freezeTokens: statsResult.data.freezeTokens,
      }
    : null;

  return (
    <AppShell isInstructor={isInstructor} gamification={gamification}>
      {children}
    </AppShell>
  );
}
