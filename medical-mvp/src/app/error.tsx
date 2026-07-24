"use client";

import { useEffect } from "react";
import { useTranslation } from "@/components/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { reportClientError } from "@/lib/report-client-error";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const { t } = useTranslation();

  useEffect(() => {
    void reportClientError({
      source: "error-boundary",
      message: error.message || "Unhandled client error",
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  const reference =
    error.digest != null
      ? t.errors.reference.replace("{digest}", error.digest)
      : null;

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-16">
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
  );
}
