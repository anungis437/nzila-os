/**
 * Locale-aware For Leadership page
 * Accessible at /{locale}/for-leadership
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import RolePageContent from '@/app/(marketing)/components/role-page-content';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'For Leadership | UnionEyes',
    description:
      'UnionEyes gives union presidents and executive boards real-time visibility into casework, trends, and resource allocation — one system, no spreadsheets.',
  };
}

export default async function LocaleForLeadershipPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  return <RolePageContent role="leadership" />;
}
