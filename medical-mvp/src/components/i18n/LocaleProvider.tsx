"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LOCALE,
  getDictionary,
  getDirection,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Dictionary,
  type Locale,
} from "@/locales";

type LocaleContextValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  dictionary: Dictionary;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function persistLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
  try {
    localStorage.setItem(LOCALE_COOKIE, locale);
  } catch {
    // Ignore private-mode / storage failures
  }
}

function applyDocumentLocale(locale: Locale) {
  const dir = getDirection(locale);
  const root = document.documentElement;
  root.lang = locale;
  root.dir = dir;
  root.dataset.locale = locale;
}

type LocaleProviderProps = {
  initialLocale?: Locale;
  children: ReactNode;
};

export function LocaleProvider({
  initialLocale = DEFAULT_LOCALE,
  children,
}: LocaleProviderProps) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(
    isLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE
  );

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  // Prefer cookie (SSR). If no cookie yet, restore from localStorage.
  useEffect(() => {
    try {
      const cookieMatch = document.cookie.match(
        new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`)
      );
      const cookieLocale = cookieMatch?.[1] ? decodeURIComponent(cookieMatch[1]) : null;
      const stored = localStorage.getItem(LOCALE_COOKIE);

      if (!isLocale(cookieLocale) && isLocale(stored) && stored !== locale) {
        setLocaleState(stored);
        persistLocale(stored);
        applyDocumentLocale(stored);
        return;
      }

      persistLocale(locale);
    } catch {
      // Ignore private-mode / storage failures
    }
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback(
    (next: Locale) => {
      if (!isLocale(next)) return;
      setLocaleState(next);
      persistLocale(next);
      applyDocumentLocale(next);
      router.refresh();
    },
    [router]
  );

  const value = useMemo<LocaleContextValue>(() => {
    const dictionary = getDictionary(locale);
    return {
      locale,
      dir: getDirection(locale),
      dictionary,
      setLocale,
      t: dictionary,
    };
  }, [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

export function useTranslation() {
  const { t, locale, dir, setLocale } = useLocale();
  return { t, locale, dir, setLocale };
}
