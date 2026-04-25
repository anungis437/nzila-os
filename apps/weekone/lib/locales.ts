import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en-CA"],
  defaultLocale: "en-CA",
});

export const locales = routing.locales;
