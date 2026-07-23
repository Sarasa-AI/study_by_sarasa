"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import type {
  LeaderboardData,
  LeaderboardEntry,
  UserAchievementView,
} from "@/lib/gamification-service";

type MainTab = "leaderboard" | "achievements";
type BoardMode = "overall" | "weekly";

type LeaderboardClientProps = {
  leaderboard: LeaderboardData;
  achievements: UserAchievementView[];
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`;
}

function rankAccentClass(rank: number): string {
  if (rank === 1) return "border-amber-300 bg-amber-50";
  if (rank === 2) return "border-slate-300 bg-slate-50";
  if (rank === 3) return "border-orange-300 bg-orange-50";
  return "border-border bg-white";
}

function rankBadgeClass(rank: number): string {
  if (rank === 1) return "bg-amber-400 text-amber-950";
  if (rank === 2) return "bg-slate-400 text-white";
  if (rank === 3) return "bg-orange-400 text-orange-950";
  return "bg-muted text-foreground";
}

function LeaderboardRow({
  entry,
  mode,
  sticky,
}: {
  entry: LeaderboardEntry;
  mode: BoardMode;
  sticky?: boolean;
}) {
  const xp = mode === "overall" ? entry.totalXp : entry.weeklyXp;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${rankAccentClass(entry.rank)} ${
        sticky ? "sticky bottom-0 z-10 shadow-md ring-1 ring-teal-200" : ""
      } ${entry.isCurrentUser && !sticky ? "ring-1 ring-teal-300" : ""}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rankBadgeClass(entry.rank)}`}
      >
        {entry.rank.toLocaleString("fa-IR")}
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800">
        {getInitials(entry.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {entry.name}
          {entry.isCurrentUser ? (
            <span className="mr-2 text-xs text-teal-700">(شما)</span>
          ) : null}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          🔥 استریک {entry.currentStreak.toLocaleString("fa-IR")} روز
        </div>
      </div>
      <div className="shrink-0 text-left">
        <div className="text-base font-bold tabular-nums">{xp.toLocaleString("fa-IR")}</div>
        <div className="text-[11px] text-muted-foreground">XP</div>
      </div>
    </div>
  );
}

function AchievementCard({ achievement }: { achievement: UserAchievementView }) {
  const progressPercent = Math.round(achievement.progress * 100);
  const unlockedLabel = achievement.unlockedAt
    ? new Date(achievement.unlockedAt).toLocaleDateString("fa-IR")
    : null;

  if (achievement.isUnlocked) {
    return (
      <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-amber-50">
        <CardContent className="space-y-2 pt-4">
          <div className="text-3xl">{achievement.icon}</div>
          <div className="font-bold text-teal-900">{achievement.title}</div>
          <p className="text-sm text-slate-700">{achievement.description}</p>
          {unlockedLabel ? (
            <p className="text-xs text-teal-700">باز شده در {unlockedLabel}</p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="opacity-70 grayscale">
      <CardContent className="space-y-2 pt-4">
        <div className="text-3xl">{achievement.icon}</div>
        <div className="font-bold text-slate-600">{achievement.title}</div>
        <p className="text-sm text-slate-500">{achievement.description}</p>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {achievement.currentValue.toLocaleString("fa-IR")} /{" "}
              {achievement.threshold.toLocaleString("fa-IR")}
            </span>
            <span>{progressPercent.toLocaleString("fa-IR")}٪</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-slate-400 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LeaderboardClient({ leaderboard, achievements }: LeaderboardClientProps) {
  const [mainTab, setMainTab] = useState<MainTab>("leaderboard");
  const [boardMode, setBoardMode] = useState<BoardMode>("overall");

  const board = boardMode === "overall" ? leaderboard.overall : leaderboard.weekly;
  const currentInTop = board.entries.some((entry) => entry.isCurrentUser);
  const showStickyCurrent =
    board.currentUser !== null && (!currentInTop || board.currentUser.rank > 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">جدول رقابتی و دستاوردها</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          رتبه خود را ببینید و مدال‌های مطالعه را جمع کنید
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={mainTab === "leaderboard" ? "secondary" : "ghost"}
          onClick={() => setMainTab("leaderboard")}
        >
          جدول برترین‌ها
        </Button>
        <Button
          variant={mainTab === "achievements" ? "secondary" : "ghost"}
          onClick={() => setMainTab("achievements")}
        >
          مدال‌ها و دستاوردها
        </Button>
      </div>

      {mainTab === "leaderboard" ? (
        <Card>
          <CardHeader className="space-y-3">
            <div className="font-semibold">رتبه‌بندی دانشجویان</div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="px-3 py-1.5 text-xs"
                variant={boardMode === "overall" ? "secondary" : "ghost"}
                onClick={() => setBoardMode("overall")}
              >
                کلی
              </Button>
              <Button
                className="px-3 py-1.5 text-xs"
                variant={boardMode === "weekly" ? "secondary" : "ghost"}
                onClick={() => setBoardMode("weekly")}
              >
                هفتگی
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {board.currentUser && !currentInTop ? (
              <div className="mb-3">
                <div className="mb-1 text-xs text-muted-foreground">رتبه شما</div>
                <LeaderboardRow entry={board.currentUser} mode={boardMode} />
              </div>
            ) : null}

            {board.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">هنوز رتبه‌ای ثبت نشده است.</p>
            ) : (
              board.entries.map((entry) => (
                <LeaderboardRow key={entry.userId} entry={entry} mode={boardMode} />
              ))
            )}

            {showStickyCurrent && board.currentUser && currentInTop ? (
              <div className="pt-2">
                <LeaderboardRow entry={board.currentUser} mode={boardMode} sticky />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </div>
      )}
    </div>
  );
}
