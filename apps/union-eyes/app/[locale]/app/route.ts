import { NextRequest, NextResponse } from 'next/server';
import { buildAppUrl } from '@/lib/site-topology';
import { auth } from '@nzila/platform-auth/entra/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ locale: string }> },
) {
  await auth();
  const { locale } = await context.params;
  const appUrl = new URL(buildAppUrl(`/${locale}`));

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
