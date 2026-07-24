import en from "./en";
import fa from "./fa";

export const dictionaries = {
  fa,
  en,
} as const;

export type Locale = keyof typeof dictionaries;
export type Dictionary = (typeof dictionaries)[Locale];

export const DEFAULT_LOCALE: Locale = "fa";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function isLocale(value: unknown): value is Locale {
  return value === "fa" || value === "en";
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export function getDirection(locale: Locale): "rtl" | "ltr" {
  return locale === "fa" ? "rtl" : "ltr";
}
