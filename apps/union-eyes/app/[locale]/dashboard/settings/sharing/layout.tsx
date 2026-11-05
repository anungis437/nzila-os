import { redirect } from 'next/navigation';
import { requireUser, getUserRole } from '@/lib/api-auth-guard';
import { canManageOrganizationSettings } from '@/lib/auth/org-settings-access';

type SharingLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// The sharing page is a client component, so the administrator check lives in this server layout.
export default async function SharingSettingsLayout({ children, params }: SharingLayoutProps) {
  const { locale } = await params;
  const user = await requireUser();
  const role = await getUserRole(user.userId, user.organizationId);
  if (!canManageOrganizationSettings(role)) {
    redirect(`/${locale}/dashboard/profile`);
  }
  return <>{children}</>;
}
