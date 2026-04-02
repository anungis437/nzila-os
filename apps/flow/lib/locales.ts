import { SHOPMOICA_SETTINGS } from '@nzila/platform-commerce-org/defaults'

import { defineRouting } from "next-intl/routing";

export const locales = [SHOPMOICA_SETTINGS.locale, "fr-CA"] as const;

export const routing = defineRouting({
  locales,
  defaultLocale: SHOPMOICA_SETTINGS.locale as 'en-CA',
  localePrefix: "always",
});
