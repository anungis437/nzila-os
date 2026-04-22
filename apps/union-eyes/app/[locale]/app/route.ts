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
  appUrl.search = request.nextUrl.search;

  return NextResponse.redirect(appUrl, { status: 302 });
}
