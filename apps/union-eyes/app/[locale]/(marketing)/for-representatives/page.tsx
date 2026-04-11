/**
 * Locale-aware For Representatives page
 * Accessible at /{locale}/for-representatives
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import RolePageContent from '@/app/(marketing)/components/role-page-content';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'For Representatives | UnionEyes',
    description:
      'UnionEyes helps stewards and reps move from intake to outcome with confidence — guided workflows, precedent search, and real-time case status.',
  };
}

export default async function LocaleForRepresentativesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  return <RolePageContent role="representatives" />;
}
