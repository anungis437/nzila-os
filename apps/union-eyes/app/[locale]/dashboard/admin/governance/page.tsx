export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getUserRole } from '@/lib/auth/rbac-server';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { UserRole } from '@/lib/auth/roles';
import GovernanceConsole from './governance-console';

export const metadata: Metadata = {
  title: 'Governance Console | Union Eyes',
  description: 'Golden share, reserved matters, audits, and council elections',
};

const GOVERNANCE_ADMIN_ROLES: UserRole[] = [
  UserRole.APP_OWNER,
  UserRole.COO,
  UserRole.ADMIN,
  UserRole.SYSTEM_ADMIN,
  UserRole.PLATFORM_LEAD,
];

export default async function GovernancePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const organizationId = await getOrganizationIdForUser(userId);
  const userRole = await getUserRole(userId, organizationId);

  if (!GOVERNANCE_ADMIN_ROLES.includes(userRole)) {
    redirect('/dashboard');
  }

  return <GovernanceConsole />;
}
