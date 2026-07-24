"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/components/i18n/LocaleProvider";

export function UserMenu() {
  const { data: session } = useSession();
  const { t } = useTranslation();
  const name = session?.user?.name ?? t.userMenu.user;
  const role = session?.user?.role;
  const initial = name.trim().charAt(0) || t.userMenu.user.charAt(0);
  const roleLabel = role === "INSTRUCTOR" ? t.userMenu.instructor : t.userMenu.student;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white/80 px-2.5 py-1.5 shadow-sm backdrop-blur-sm">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-600 to-primary-800 text-sm font-bold text-white shadow-sm">
          {initial}
        </div>
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-medium text-slate-900">{name}</p>
          <p className="text-[11px] text-slate-500">{roleLabel}</p>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="h-9 gap-1.5 px-2.5 text-slate-600 hover:text-red-600"
        onClick={() => signOut({ callbackUrl: "/login" })}
        aria-label={t.userMenu.signOut}
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">{t.userMenu.signOut}</span>
      </Button>
    </div>
  );
}
