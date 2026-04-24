import { NextRequest, NextResponse } from 'next/server';
import { buildAppUrl } from '@/lib/site-topology';

/**
 * /app redirect — sends visitors to the authenticated app subdomain.
 * CTAs and nav links can point to /app and this route handles the redirect,
 * allowing the target URL to be changed in one place.
 */
export function GET(request: NextRequest) {
  const appUrl = new URL(buildAppUrl('/'));

  // Preserve only attribution params to avoid forwarding arbitrary query keys.
  const allowedParams = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'gclid',
    'fbclid',
    'ref',
  ]);
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (allowedParams.has(key)) {
      appUrl.searchParams.set(key, value);
    }
  }

  return NextResponse.redirect(appUrl, { status: 302 });
}
