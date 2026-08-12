"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LineChart,
  Trophy,
  Library,
  Layers,
  ClipboardCheck,
  StickyNote,
  Bookmark,
  GraduationCap,
  Activity,
  ShieldCheck,
  BookOpen,
  Users,
  Zap,
  Flame,
  Snowflake,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/i18n/LocaleProvider";
import { SearchBar } from "@/components/search/SearchBar";
import type { Dictionary } from "@/locales";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

export type SidebarGamificationStats = {
  totalXP: number;
  currentStreak: number;
  freezeTokens: number;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
        active
          ? "bg-primary-50 text-primary-800 shadow-sm ring-1 ring-primary-100"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300",
          active
            ? "bg-primary-600 text-white shadow-soft"
            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700"
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function NavGroupSection({
  group,
  onNavigate,
}: {
  group: NavGroup;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {group.title}
      </p>
      <ul className="space-y-0.5">
        {group.items.map((item) => (
          <li key={item.href}>
            <NavLink item={item} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const instructorGroup = (t: Dictionary): NavGroup => ({
  title: t.nav.instructors,
  items: [
    { href: "/instructor", label: t.nav.instructorPanel, icon: GraduationCap },
    { href: "/instructor/reviews", label: t.nav.peerReviews, icon: ShieldCheck },
    { href: "/instructor/knowledge", label: t.nav.knowledgeBase, icon: BookOpen },
    { href: "/instructor/cohort", label: t.nav.cohortAnalytics, icon: Users },
  ],
});

/**
 * Instructors are content managers, not learners: hide the student-facing
 * study tools (dashboard, flashcards, exam simulator, analytics, leaderboard,
 * notes) and keep only Library, Bookmarks, and the Instructor section.
 */
function buildNavGroups(t: Dictionary, isInstructor: boolean): NavGroup[] {
  if (isInstructor) {
    return [
      {
        title: t.nav.learning,
        items: [{ href: "/library", label: t.nav.library, icon: Library }],
      },
      {
        title: t.nav.personal,
        items: [{ href: "/bookmarks", label: t.nav.bookmarks, icon: Bookmark }],
      },
      instructorGroup(t),
    ];
  }

  return [
    {
      title: t.nav.learning,
      items: [
        { href: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
        { href: "/library", label: t.nav.library, icon: Library },
        { href: "/flashcards", label: t.nav.flashcards, icon: Layers },
        { href: "/exams", label: t.nav.exam, icon: ClipboardCheck },
      ],
    },
    {
      title: t.nav.insights,
      items: [
        { href: "/analytics", label: t.nav.analytics, icon: LineChart },
        { href: "/leaderboard", label: t.nav.leaderboard, icon: Trophy },
      ],
    },
    {
      title: t.nav.personal,
      items: [
        { href: "/notes", label: t.nav.notes, icon: StickyNote },
        { href: "/bookmarks", label: t.nav.bookmarks, icon: Bookmark },
      ],
    },
  ];
}

type SidebarNavProps = {
  isInstructor: boolean;
  gamification?: SidebarGamificationStats | null;
  onNavigate?: () => void;
  className?: string;
};

export function SidebarNav({
  isInstructor,
  gamification,
  onNavigate,
  className,
}: SidebarNavProps) {
  const { t } = useTranslation();
  const groups = buildNavGroups(t, isInstructor);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <Link
        href="/home"
        onClick={onNavigate}
        className="flex items-center gap-3 border-b border-slate-200/70 px-4 py-5 transition-opacity duration-300 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-soft">
          <Activity className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{t.common.brand}</p>
          <p className="truncate text-xs text-slate-500">{t.common.brandSubtitle}</p>
        </div>
      </Link>

      <div className="border-b border-slate-200/70 px-3 py-3">
        <SearchBar compact />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {groups.map((group) => (
          <NavGroupSection key={group.title} group={group} onNavigate={onNavigate} />
        ))}
      </nav>

      {gamification ? (
        <div className="mt-auto border-t border-slate-200/70 px-3 py-3">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
            <div
              className="flex min-w-0 items-center gap-1.5 text-teal-700"
              title={t.nav.totalXp}
            >
              <Zap className="h-4 w-4 shrink-0 text-teal-600" strokeWidth={2.25} aria-hidden />
              <span className="truncate text-sm font-semibold tabular-nums">
                {gamification.totalXP.toLocaleString("fa-IR")}
              </span>
              <span className="sr-only">{t.nav.totalXp}</span>
            </div>

            <div
              className="relative flex min-w-0 items-center gap-1.5 text-orange-700"
              title={t.nav.streakDays}
            >
              <Flame className="h-4 w-4 shrink-0 text-orange-500" strokeWidth={2.25} aria-hidden />
              <span className="truncate text-sm font-semibold tabular-nums">
                {gamification.currentStreak.toLocaleString("fa-IR")}
              </span>
              <span className="sr-only">{t.nav.streakDays}</span>
              <span
                className="absolute -top-1.5 -end-1.5 flex h-4 min-w-4 items-center justify-center gap-0.5 rounded-full bg-sky-100 px-1 text-[10px] font-bold text-sky-700 ring-1 ring-sky-200"
                title={t.nav.freezeTokens}
              >
                <Snowflake className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
                {gamification.freezeTokens.toLocaleString("fa-IR")}
                <span className="sr-only">{t.nav.freezeTokens}</span>
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
