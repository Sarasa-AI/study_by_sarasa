"use client";

import { getSession, signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import { useTranslation } from "@/components/i18n/LocaleProvider";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  BookOpen,
  ClipboardCheck,
  Hash,
  LineChart,
  Loader2,
  User,
} from "lucide-react";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setHasError(false);
    const res = await signIn("credentials", {
      name,
      studentCode,
      redirect: false,
    });
    if (res?.ok) {
      const session = await getSession();
      const role = session?.user?.role;
      router.push(role === "INSTRUCTOR" ? "/instructor" : "/home");
    } else {
      setLoading(false);
      setHasError(true);
    }
  }

  const features = [
    { icon: BookOpen, text: t.login.featureLibrary },
    { icon: ClipboardCheck, text: t.login.featureExam },
    { icon: LineChart, text: t.login.featureAnalytics },
  ];

  return (
    <div className="relative flex min-h-screen">
      <div className="absolute end-4 top-4 z-20 sm:end-6 sm:top-6">
        <LanguageToggle size="md" />
      </div>

      {/* Visual panel */}
      <aside className="relative hidden w-[48%] overflow-hidden bg-login-hero lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 bg-grid-pattern bg-grid opacity-60"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -end-20 top-24 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -start-16 bottom-32 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute start-1/3 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-emerald-300/10 blur-2xl"
          aria-hidden
        />

        <svg
          className="pointer-events-none absolute bottom-0 start-0 end-0 h-32 w-full opacity-20"
          viewBox="0 0 800 120"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0 60 H120 L140 60 L160 20 L180 100 L200 60 H320 L340 60 L360 35 L380 85 L400 60 H520 L540 60 L560 10 L580 110 L600 60 H800"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="relative z-10 px-10 pt-12 xl:px-14">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 backdrop-blur-md">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white">
              <Activity className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <span className="text-sm font-semibold text-white">{t.login.brand}</span>
          </div>
        </div>

        <div className="relative z-10 space-y-8 px-10 pb-14 xl:px-14">
          <div className="space-y-4">
            <h2 className="max-w-md text-3xl font-bold leading-relaxed text-white xl:text-4xl">
              {t.login.heroTitle}
            </h2>
            <p className="max-w-sm text-sm leading-7 text-teal-50/80">{t.login.heroSubtitle}</p>
          </div>

          <ul className="space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-teal-50/90 backdrop-blur-sm"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form panel */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-gradient-to-bl from-slate-50 via-white to-primary-50/40 px-4 py-12 sm:px-8">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-soft">
            <Activity className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-base font-bold text-slate-900">{t.login.brand}</p>
            <p className="text-xs text-slate-500">{t.login.mobileSubtitle}</p>
          </div>
        </div>

        <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/70 p-8 shadow-soft-lg ring-1 ring-slate-200/50 backdrop-blur-xl sm:p-10">
          <div className="mb-8 space-y-2 text-center sm:text-start">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.login.welcome}</h1>
            <p className="text-sm text-slate-500">{t.login.welcomeHint}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {hasError && (
              <div
                role="alert"
                className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{t.login.invalidCredentials}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                {t.login.nameLabel}
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.login.namePlaceholder}
                  required
                  className="pe-10"
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="studentCode" className="block text-sm font-medium text-slate-700">
                {t.login.studentCodeLabel}{" "}
                <span className="font-normal text-slate-400">{t.login.optional}</span>
              </label>
              <div className="relative">
                <Hash className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="studentCode"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  placeholder={t.login.studentCodePlaceholder}
                  className="pe-10"
                  autoComplete="off"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="mt-2 w-full py-3 text-base">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.login.submitting}
                </>
              ) : (
                t.login.submit
              )}
            </Button>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">{t.login.footer}</p>
      </div>
    </div>
  );
}
