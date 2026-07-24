"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/i18n/LocaleProvider";
import type { Locale } from "@/locales";

const OPTIONS: { value: Locale; labelKey: "en" | "fa" }[] = [
  { value: "en", labelKey: "en" },
  { value: "fa", labelKey: "fa" },
];

type LanguageToggleProps = {
  className?: string;
  size?: "sm" | "md";
};

export function LanguageToggle({ className, size = "sm" }: LanguageToggleProps) {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t.language.toggleLabel}
      dir="ltr"
      className={cn(
        "relative inline-grid grid-cols-2 items-center rounded-full border border-slate-200/80 bg-slate-100/80 p-0.5 shadow-sm backdrop-blur-sm",
        size === "sm" ? "h-8 text-[11px]" : "h-9 text-xs",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0.5 start-0.5 w-[calc(50%-2px)] rounded-full bg-white shadow-sm ring-1 ring-slate-200/70 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          locale === "fa" && "translate-x-full"
        )}
      />
      {OPTIONS.map((option) => {
        const active = locale === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setLocale(option.value)}
            aria-pressed={active}
            className={cn(
              "relative z-10 flex h-full min-w-[2.35rem] items-center justify-center rounded-full px-2.5 font-semibold tracking-wide transition-colors duration-300",
              active ? "text-primary-800" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {t.language[option.labelKey]}
          </button>
        );
      })}
    </div>
  );
}
