/**
 * Locale-aware For CLC page
 * Accessible at /{locale}/for-clc
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import RolePageContent from '@/app/(marketing)/components/role-page-content';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'For CLC & Labour Councils | Union Eyes',
    description:
      'Union Eyes gives the Canadian Labour Congress and labour councils movement-wide visibility — aggregate casework trends, campaign coordination, and impact reporting.',
  };
}

export default async function LocaleForCLCPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  return <RolePageContent role="clc" />;
}
