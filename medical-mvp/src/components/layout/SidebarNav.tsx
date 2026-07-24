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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/i18n/LocaleProvider";
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

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  }
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

function buildNavGroups(t: Dictionary, isInstructor: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    {
      title: t.nav.learning,
      items: [
        { href: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
        { href: "/library", label: t.nav.library, icon: Library },
        { href: "/flashcards", label: t.nav.flashcards, icon: Layers },
        { href: "/exam", label: t.nav.exam, icon: ClipboardCheck },
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

  if (isInstructor) {
    groups.push({
      title: t.nav.instructors,
      items: [
        { href: "/instructor", label: t.nav.instructorPanel, icon: GraduationCap },
        { href: "/instructor/reviews", label: t.nav.peerReviews, icon: ShieldCheck },
      ],
    });
  }

  return groups;
}

type SidebarNavProps = {
  isInstructor: boolean;
  onNavigate?: () => void;
  className?: string;
};

export function SidebarNav({ isInstructor, onNavigate, className }: SidebarNavProps) {
  const { t } = useTranslation();
  const groups = buildNavGroups(t, isInstructor);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <Link
        href="/"
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

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {groups.map((group) => (
          <NavGroupSection key={group.title} group={group} onNavigate={onNavigate} />
        ))}
      </nav>
    </div>
  );
}
