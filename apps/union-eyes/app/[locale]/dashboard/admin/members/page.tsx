/**
 * Admin Members Management Page (server component wrapper)
 * Direct organization admins manage their own invitations. Platform support
 * retains its separately guarded console; a platform title grants no invite authority.
 */
export const dynamic = 'force-dynamic';

import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { Metadata } from 'next';
import { redirect } from "next/navigation";
import { getTranslations } from 'next-intl/server';
import MembersConsole from "@/components/admin/members-console";
import OrganizationInvitations from '@/components/admin/organization-invitations';
import { canManageOrganizationInvites } from '@nzila/platform-auth/invites';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminMembersPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function AdminMembersPage() {
  const user = await requireUser();
  if (await canManageOrganizationInvites(user.userId, user.organizationId))
    return <OrganizationInvitations />;

  if (await hasMinRole('support_manager')) return <MembersConsole />;
  redirect('/dashboard');
}
