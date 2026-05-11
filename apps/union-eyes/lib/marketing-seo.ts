import { defaultLocale, locales } from '@/lib/locales';

function normalizeRoutePath(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '';
  }

  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function buildLocaleAlternates(locale: string, pathname = ''): {
  canonical: string;
  languages: Record<string, string>;
} {
  const normalizedPath = normalizeRoutePath(pathname);
  const canonical = `/${locale}${normalizedPath}`;
  const languages = locales.reduce<Record<string, string>>((acc, candidateLocale) => {
    acc[candidateLocale] = `/${candidateLocale}${normalizedPath}`;
    return acc;
  }, {});

  languages['x-default'] = `/${defaultLocale}${normalizedPath}`;

  return {
    canonical,
    languages,
  };
}

export function localeMarketingPaths(pathname: string): string[] {
  const normalizedPath = normalizeRoutePath(pathname);
  return locales.map((locale) => `/${locale}${normalizedPath}`);
}
