import { cookies } from "next/headers";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type Locale,
  LOCALES,
} from "./locale";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  if (value && (LOCALES as readonly string[]).includes(value)) {
    return value as Locale;
  }
  return DEFAULT_LOCALE;
}
