import { NextRequest, NextResponse } from 'next/server';
import { buildAppUrl } from '@/lib/site-topology';

/**
 * /app redirect — sends visitors to the authenticated app subdomain.
 * CTAs and nav links can point to /app and this route handles the redirect,
 * allowing the target URL to be changed in one place.
 */
export function GET(request: NextRequest) {
  const appUrl = new URL(buildAppUrl('/'));
  appUrl.search = request.nextUrl.search;

  return NextResponse.redirect(appUrl, { status: 302 });
}
