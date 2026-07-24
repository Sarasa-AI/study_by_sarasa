"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import type { Locale } from "@/locales";

type ProvidersProps = {
  children: React.ReactNode;
  locale: Locale;
};

export function Providers({ children, locale }: ProvidersProps) {
  return (
    <SessionProvider>
      <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
    </SessionProvider>
  );
}
