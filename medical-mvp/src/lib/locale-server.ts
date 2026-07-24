import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@/locales";

export function getRequestLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
