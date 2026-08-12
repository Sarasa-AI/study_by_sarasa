"use client";

import { useEffect, useState } from "react";
import { Snowflake, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import type { WeeklyLeagueResult } from "@/lib/gamification-actions";
import type { UserAchievementView } from "@/lib/gamification-service";

type MainTab = "league" | "achievements";

type LeaderboardClientProps = {
  league: WeeklyLeagueResult;
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
  return "border-slate-200 bg-white";
}

function rankBadgeClass(rank: number): string {
  if (rank === 1) return "bg-amber-400 text-amber-950";
  if (rank === 2) return "bg-slate-400 text-white";
  if (rank === 3) return "bg-orange-400 text-orange-950";
  return "bg-slate-100 text-slate-700";
}

function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "۰۰:۰۰:۰۰";
  const totalSeconds = Math.floor(msRemaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toLocaleString("fa-IR", { minimumIntegerDigits: 2 });

  if (days > 0) {
    return `${days.toLocaleString("fa-IR")} روز و ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function LeagueRow({
  entry,
  sticky,
}: {
  entry: WeeklyLeagueResult["members"][number];
  sticky?: boolean;
}) {
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
        <div className="truncate font-medium text-slate-900">
          {entry.name}
          {entry.isCurrentUser ? (
            <span className="mr-2 text-xs text-teal-700">(شما)</span>
          ) : null}
        </div>
        <div className="mt-0.5 text-xs text-slate-500">
          دقت پاسخ‌ها: {entry.accuracyPercent.toLocaleString("fa-IR")}٪
        </div>
      </div>
      <div className="shrink-0 text-left">
        <div className="text-base font-bold tabular-nums text-slate-900">
          {entry.weeklyXP.toLocaleString("fa-IR")}
        </div>
        <div className="text-[11px] text-slate-500">امتیاز این هفته</div>
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
      <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-amber-50 transition-shadow hover:shadow-soft-lg">
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
          <div className="flex justify-between text-xs text-slate-500">
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

export function LeaderboardClient({ league, achievements }: LeaderboardClientProps) {
  const [mainTab, setMainTab] = useState<MainTab>("league");
  const [msRemaining, setMsRemaining] = useState(() => {
    const endsAt = new Date(league.weekEndsAt).getTime();
    return Math.max(0, endsAt - Date.now());
  });

  useEffect(() => {
    const endsAt = new Date(league.weekEndsAt).getTime();
    const tick = () => setMsRemaining(Math.max(0, endsAt - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [league.weekEndsAt]);

  const currentInTop = league.members.some((entry) => entry.isCurrentUser);
  const currentEntry = league.members.find((entry) => entry.isCurrentUser);
  const showStickyCurrent =
    currentEntry != null && (!currentInTop || currentEntry.rank > 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">لیگ هفتگی</h1>
        <p className="mt-1 text-sm text-slate-500">
          با پاسخ‌های درست در آزمون‌ها امتیاز بگیرید و در لیگ خود رقابت کنید
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={mainTab === "league" ? "secondary" : "ghost"}
          onClick={() => setMainTab("league")}
        >
          لیگ هفتگی
        </Button>
        <Button
          variant={mainTab === "achievements" ? "secondary" : "ghost"}
          onClick={() => setMainTab("achievements")}
        >
          مدال‌ها و دستاوردها
        </Button>
      </div>

      {mainTab === "league" ? (
        <div className="space-y-4">
          <Card className="border-teal-200 bg-gradient-to-bl from-teal-50/80 to-white">
            <CardContent className="space-y-4 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-white shadow-soft">
                    <Trophy className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-teal-700">لیگ فعلی شما</p>
                    <h2 className="text-xl font-bold text-slate-900">{league.tierName}</h2>
                  </div>
                </div>
                <div className="rounded-xl bg-white/80 px-4 py-2 text-left ring-1 ring-teal-100">
                  <p className="text-[11px] text-slate-500">زمان تا ریست هفتگی</p>
                  <p className="font-mono text-lg font-bold tabular-nums text-teal-800">
                    {formatCountdown(msRemaining)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-sm">
                <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                  <span className="text-slate-500">امتیاز این هفته: </span>
                  <span className="font-bold tabular-nums text-slate-900">
                    {league.weeklyXP.toLocaleString("fa-IR")}
                  </span>
                </div>
                {league.currentUserRank != null ? (
                  <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                    <span className="text-slate-500">رتبه شما: </span>
                    <span className="font-bold tabular-nums text-slate-900">
                      {league.currentUserRank.toLocaleString("fa-IR")}
                    </span>
                  </div>
                ) : null}
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-sky-800 ring-1 ring-sky-200">
                  <Snowflake className="h-3.5 w-3.5" strokeWidth={2.25} />
                  <span>
                    توکن یخ‌زدگی باقی‌مانده:{" "}
                    <span className="font-bold tabular-nums">
                      {league.freezeTokens.toLocaleString("fa-IR")}
                    </span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="font-semibold text-slate-900">رتبه‌بندی لیگ</div>
              <p className="text-xs text-slate-500">۲۵ نفر برتر بر اساس امتیاز این هفته</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {currentEntry == null && league.currentUserRank != null ? (
                <div className="mb-3 rounded-xl border border-teal-200 bg-teal-50/50 px-3 py-3">
                  <div className="mb-1 text-xs text-teal-700">رتبه شما خارج از ۲۵ نفر برتر</div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">
                      رتبه {league.currentUserRank.toLocaleString("fa-IR")}
                    </span>
                    <span className="font-bold tabular-nums text-slate-900">
                      {league.weeklyXP.toLocaleString("fa-IR")} امتیاز
                    </span>
                  </div>
                </div>
              ) : null}

              {league.members.length === 0 ? (
                <p className="text-sm text-slate-500">
                  هنوز کسی در این لیگ امتیاز نگرفته است. با شرکت در آزمون شروع کنید.
                </p>
              ) : (
                league.members.map((entry) => (
                  <LeagueRow key={entry.userId} entry={entry} />
                ))
              )}

              {showStickyCurrent && currentEntry ? (
                <div className="pt-2">
                  <LeagueRow entry={currentEntry} sticky />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
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
