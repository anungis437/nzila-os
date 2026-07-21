/**
 * Union Eyes Demo — Next.js edge proxy (middleware).
 *
 * Wave 0 §3: the demo runs its own tiny middleware stack. It only
 * handles locale routing (next-intl) plus lightweight demo-scoped
 * headers. It intentionally does NOT import from
 * `@nzila/platform-auth/entra/*` — see the operational note about
 * edge-runtime `node:crypto` incompatibility in the parent user
 * memory. Auth in the demo is served through server-component
 * shims under `lib/auth/`, never in the edge layer.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './lib/locales';

const intlMiddleware = createIntlMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: 'always',
});

export default function proxy(req: NextRequest): NextResponse {
  // Static assets, next internals, and API routes bypass intl.
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    /\.[a-z0-9]+$/i.test(pathname)
  ) {
    const passthrough = NextResponse.next();
    passthrough.headers.set('x-nzila-environment', 'demo');
    return passthrough;
  }

  const response = intlMiddleware(req) ?? NextResponse.next();
  response.headers.set('x-nzila-environment', 'demo');
  response.headers.set(
    'x-request-id',
    req.headers.get('x-request-id') ?? crypto.randomUUID(),
  );
  return response;
}

export const config = {
  matcher: [
    // Skip Next internals and any file with an extension.
    '/((?!api|_next/static|_next/image|.*\\..*).*)',
  ],
};
