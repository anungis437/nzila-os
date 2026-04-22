import { NextRequest, NextResponse } from 'next/server';
import { buildAppUrl } from '@/lib/site-topology';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ locale: string }> },
) {
  const { locale } = await context.params;
  const appUrl = new URL(buildAppUrl(`/${locale}`));
  appUrl.search = request.nextUrl.search;

  return NextResponse.redirect(appUrl, { status: 302 });
}
