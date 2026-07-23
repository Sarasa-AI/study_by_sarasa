import { redirect } from "next/navigation";
import { LeaderboardClient } from "@/components/leaderboard/LeaderboardClient";
import { getSessionUser } from "@/lib/auth";
import {
  checkAndAwardAchievements,
  getLeaderboardData,
  getUserAchievements,
} from "@/lib/gamification-service";

export default async function LeaderboardPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    redirect("/login");
  }

  const userId = sessionUser.id;

  // Award any newly earned badges before loading gallery data
  await checkAndAwardAchievements(userId);

  const [leaderboard, achievements] = await Promise.all([
    getLeaderboardData(userId),
    getUserAchievements(userId),
  ]);

  return <LeaderboardClient leaderboard={leaderboard} achievements={achievements} />;
}
