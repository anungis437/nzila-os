import { createNavigation } from 'next-intl/navigation';
import { locales, defaultLocale } from '../lib/locales';

export const { Link, redirect, usePathname, useRouter } = createNavigation({
  locales,
  defaultLocale,
  localePrefix: 'always',
});
