/**
 * Locale-aware For Federations page
 * Accessible at /{locale}/for-federations
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import RolePageContent from '@/app/(marketing)/components/role-page-content';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'For Federations | Union Eyes',
    description:
      'Union Eyes gives federations and national unions cross-local visibility into casework, resources, and outcomes — coordinate effectively and support locals that need it most.',
  };
}

export default async function LocaleForFederationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  return <RolePageContent role="federations" />;
}
