/**
 * Locale-aware For Members page
 * Accessible at /{locale}/for-members
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import RolePageContent from '@/app/(marketing)/components/role-page-content';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'For Members | Union Eyes',
    description:
      'Union Eyes gives union members direct visibility into their cases, secure document sharing, and clear communication with their representative.',
  };
}

export default async function LocaleForMembersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  return <RolePageContent role="members" />;
}
