import { defineRouting } from "next-intl/routing";

export const locales = ["en-CA", "fr-CA"] as const;

export const routing = defineRouting({
  locales,
  defaultLocale: "en-CA",
  localePrefix: "always",
});
