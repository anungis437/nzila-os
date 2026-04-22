import { NextResponse } from 'next/server';

/**
 * /app redirect — sends visitors to the authenticated app subdomain.
 * CTAs and nav links can point to /app and this route handles the redirect,
 * allowing the target URL to be changed in one place.
 */
export function GET() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.unioneyes.app';
  return NextResponse.redirect(appUrl, { status: 302 });
}
