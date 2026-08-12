import { redirect } from "next/navigation";
import { LeaderboardClient } from "@/components/leaderboard/LeaderboardClient";
import { getSessionUser } from "@/lib/auth";
import { getWeeklyLeague } from "@/lib/gamification-actions";
import {
  checkAndAwardAchievements,
  getUserAchievements,
} from "@/lib/gamification-service";

export default async function LeaderboardPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    redirect("/login");
  }

  const userId = sessionUser.id;

  await checkAndAwardAchievements(userId);

  const [leagueResult, achievements] = await Promise.all([
    getWeeklyLeague(),
    getUserAchievements(userId),
  ]);

  if (!leagueResult.success) {
    redirect("/login");
  }

  return (
    <LeaderboardClient league={leagueResult.data} achievements={achievements} />
  );
}
