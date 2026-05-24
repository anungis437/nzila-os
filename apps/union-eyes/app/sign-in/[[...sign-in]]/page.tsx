// This non-locale /sign-in route exists so links produced before locale
// resolution still land somewhere valid. The actual sign-in surface lives
// under /[locale]/(auth)/sign-in/ where it can render locale-aware copy,
// metadata, and translated CTAs. Anything that arrives here is redirected
// to the default-locale sign-in (preserving any catch-all segments).

import { redirect } from 'next/navigation';

import { defaultLocale } from '@/lib/locales';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ 'sign-in'?: string[] }>;
};

export default async function NonLocaleSignInRedirect({ params }: PageProps) {
  const { 'sign-in': segments } = await params;
  const tail = segments?.length ? `/${segments.join('/')}` : '';
  redirect(`/${defaultLocale}/sign-in${tail}`);
}
