import { SHOPMOICA_SETTINGS } from '@nzila/platform-commerce-org/defaults'

import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: [SHOPMOICA_SETTINGS.locale, "fr-CA"],
  defaultLocale: SHOPMOICA_SETTINGS.locale as 'en-CA',
  localePrefix: "always",
});
