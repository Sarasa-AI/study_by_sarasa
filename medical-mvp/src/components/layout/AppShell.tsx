"use client";

import { useCallback, useState } from "react";
import { Menu, X } from "lucide-react";
import {
  SidebarNav,
  type SidebarGamificationStats,
} from "@/components/layout/SidebarNav";
import { UserMenu } from "@/components/layout/UserMenu";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import { useTranslation } from "@/components/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import { cn } from "@/lib/utils";

type AppShellProps = {
  isInstructor: boolean;
  gamification?: SidebarGamificationStats | null;
  children: React.ReactNode;
};

export function AppShell({ isInstructor, gamification, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useBodyScrollLock(mobileOpen);
  useEscapeKey(closeMobile, mobileOpen);

  return (
    <div className="min-h-screen bg-gradient-to-bl from-slate-50 via-white to-primary-50/30">
      {/* Desktop sidebar — inline-end (right in RTL, left in LTR) */}
      <aside className="print:hidden fixed inset-y-0 end-0 z-40 hidden w-64 border-s border-slate-200/70 bg-white/80 shadow-soft backdrop-blur-xl lg:flex lg:flex-col">
        <SidebarNav isInstructor={isInstructor} gamification={gamification} />
      </aside>

      {/* Mobile overlay — always mounted below lg for open/close animation */}
      <div
        className={cn(
          "print:hidden fixed inset-0 z-50 lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          aria-label={t.common.closeMenu}
          tabIndex={mobileOpen ? 0 : -1}
          onClick={closeMobile}
        />
        <aside
          className={cn(
            "absolute inset-y-0 end-0 flex w-[min(18rem,85vw)] flex-col border-s border-slate-200/70 bg-white shadow-soft-lg transition-transform duration-300 ease-out",
            mobileOpen ? "translate-x-0" : "translate-x-full ltr:-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-200/70 px-3 py-3">
            <p className="text-sm font-semibold text-slate-800">{t.common.menu}</p>
            <Button
              type="button"
              variant="ghost"
              className="h-9 w-9 p-0"
              onClick={closeMobile}
              aria-label={t.common.close}
              tabIndex={mobileOpen ? 0 : -1}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <SidebarNav
            isInstructor={isInstructor}
            gamification={gamification}
            onNavigate={closeMobile}
            className="flex-1 overflow-y-auto"
          />
        </aside>
      </div>

      {/* Main column */}
      <div className="lg:pe-64">
        <header className="print:hidden sticky top-0 z-30 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-9 p-0 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label={t.common.openMenu}
                aria-expanded={mobileOpen}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-slate-900">{t.shell.topbarTitle}</p>
                <p className="text-xs text-slate-500">{t.shell.topbarSubtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageToggle />
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
