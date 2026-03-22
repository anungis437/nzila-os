import { getRequestConfig } from "next-intl/server";
import { locales, type Locale, defaultLocale } from "./config";

export default getRequestConfig(async ({ locale }) => {
  const validLocale: Locale = (locales as readonly string[]).includes(locale ?? "")
    ? (locale as Locale)
    : defaultLocale;
  return {
    locale: validLocale,
    messages: (await import(`../messages/${validLocale}.json`)).default,
    timeZone: "America/Toronto",
  };
});
