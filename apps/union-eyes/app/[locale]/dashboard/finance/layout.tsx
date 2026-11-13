import { redirect } from 'next/navigation';
import { requireUser, hasMinRole, isCongressOrg } from '@/lib/api-auth-guard';
import { logger } from '@/lib/logger';

/**
 * Finance routes layout — blocks congress-type organizations.
 *
 * CLC / congress orgs should not see individual union financial data;
 * they have their own dashboard at /dashboard/clc.
 *
 * Financial visibility is not inherited by a general officer (UE-OFFICER-
 * EXECUTIVE-CANONICAL-2.1 §VII); the floor matches the /api/finance handlers.
 */
export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const minRoleMet = await hasMinRole('secretary_treasurer');
  // TEMPORARY DIAGNOSTIC (CHG-2026-0114): run 43358192998 showed an officer-role
  // persona reaching /dashboard/finance with status 200 and no redirect, despite
  // officer (level 80) being below the secretary_treasurer floor (110) in
  // ROLE_HIERARCHY. Logging the actual resolved values to find the real cause
  // before changing any guard logic -- remove once root-caused.
  logger.error('[finance-layout-diagnostic]', { userId: user.userId, organizationId: user.organizationId, roles: user.roles, minRoleMet });
  if (await isCongressOrg(user.organizationId)) {
    redirect('/dashboard/clc');
  }
  if (!minRoleMet) {
    redirect('/dashboard');
  }
  return <>{children}</>;
}
