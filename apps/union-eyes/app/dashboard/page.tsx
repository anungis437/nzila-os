import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { defaultLocale, locales } from '../../lib/locales';

/**
 * Root-level /dashboard handler.
 *
 * Why this exists: a Next.js 16 + next-intl combination was producing a
 * framework-level Location redirect of the form
 * `https://demo.unioneyes.app:3000/en-CA/dashboard` when `/dashboard` was
 * requested without a locale prefix. Front Door rewrote the origin host but
 * not the `:3000` port suffix, so the public response leaked the internal
 * Container App port. The middleware-level guard in `proxy.ts` was not
 * intercepting in time (the framework redirect was happening earlier in the
 * pipeline).
 *
 * Owning the route at the app level lets us emit a clean relative redirect
 * which Next.js renders as a same-origin Location header — no host, no port —
 * which Front Door / browsers resolve against the public origin.
 */
export const dynamic = 'force-dynamic';

function pickLocale(acceptLanguage: string | null): string {
  if (!acceptLanguage) return defaultLocale;
  const preferred = acceptLanguage
    .split(',')
    .map((part) => part.split(';')[0]?.trim().toLowerCase())
    .find(Boolean);
  if (!preferred) return defaultLocale;
  if (preferred.startsWith('fr')) return 'fr-CA';
  if (preferred.startsWith('en')) return 'en-CA';
  const match = locales.find((l) => l.toLowerCase() === preferred);
  return match ?? defaultLocale;
}

export default async function DashboardLocaleRedirect() {
  const hdrs = await headers();
  const cookieLocale = hdrs.get('cookie')?.match(/NEXT_LOCALE=([^;]+)/)?.[1];
  const locale = cookieLocale && locales.includes(cookieLocale as (typeof locales)[number])
    ? cookieLocale
    : pickLocale(hdrs.get('accept-language'));
  redirect(`/${locale}/dashboard`);
}
