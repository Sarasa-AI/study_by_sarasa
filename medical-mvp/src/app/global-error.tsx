"use client";

import "./globals.css";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { reportClientError } from "@/lib/report-client-error";
import {
  DEFAULT_LOCALE,
  getDictionary,
  getDirection,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@/locales";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

function readLocaleFromCookie(): Locale {
  if (typeof document === "undefined") {
    return DEFAULT_LOCALE;
  }

  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`));

  const value = match?.slice(LOCALE_COOKIE.length + 1);
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocale(readLocaleFromCookie());
  }, []);

  useEffect(() => {
    void reportClientError({
      source: "global-error-boundary",
      message: error.message || "Unhandled global client error",
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  const t = getDictionary(locale);
  const dir = getDirection(locale);
  const reference =
    error.digest != null
      ? t.errors.reference.replace("{digest}", error.digest)
      : null;

  return (
    <html lang={locale} dir={dir} data-locale={locale}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <main className="flex min-h-screen items-center justify-center px-4 py-16">
          <div className="w-full max-w-md text-center">
            <p className="text-sm font-medium text-primary-700">{t.common.brand}</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              {t.errors.title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t.errors.description}
            </p>
            {reference ? (
              <p className="mt-4 font-mono text-xs text-slate-500">{reference}</p>
            ) : null}
            <div className="mt-8 flex justify-center">
              <Button type="button" onClick={reset}>
                {t.errors.retry}
              </Button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
