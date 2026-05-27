import { headers } from 'next/headers';
import { defaultLocale, type Locale } from '@/lib/locales';

function normalizeLocaleToken(input: string): Locale | null {
  const token = input.trim().toLowerCase();
  if (!token) return null;

  if (token === 'fr-ca' || token.startsWith('fr')) return 'fr-CA';
  if (token === 'en-ca' || token.startsWith('en')) return 'en-CA';
  if (token === 'it' || token.startsWith('it-')) return 'it';
  if (token === 'pt' || token.startsWith('pt-')) return 'pt';

  return null;
}

function localeFromCookieHeader(cookieHeader: string): Locale | null {
  const match = cookieHeader.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/i);
  if (!match?.[1]) return null;

  try {
    return normalizeLocaleToken(decodeURIComponent(match[1]));
  } catch {
    return normalizeLocaleToken(match[1]);
  }
}

function localeFromAcceptLanguage(acceptLanguage: string): Locale | null {
  const tokens = acceptLanguage
    .split(',')
    .map((part) => part.split(';')[0]?.trim())
    .filter((part): part is string => Boolean(part));

  for (const token of tokens) {
    const normalized = normalizeLocaleToken(token);
    if (normalized) return normalized;
  }

  return null;
}

export async function getPreferredLocaleForRedirect(): Promise<Locale> {
  const requestHeaders = await headers();

  const localeFromCookie = localeFromCookieHeader(requestHeaders.get('cookie') ?? '');
  if (localeFromCookie) return localeFromCookie;

  const localeFromAcceptHeader = localeFromAcceptLanguage(
    requestHeaders.get('accept-language') ?? ''
  );
  if (localeFromAcceptHeader) return localeFromAcceptHeader;

  return defaultLocale;
}
