import { redirect } from 'next/navigation'
import { CapabilityUnavailable } from '@/components/system/capability-unavailable'
import { requireUser, hasMinRole, isCongressOrg } from '@/lib/api-auth-guard'

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
  children: _children,
  params,
}: {
  children: React.ReactNode
  params?: Promise<{ locale: string }>
}) {
  const user = await requireUser()
  const minRoleMet = await hasMinRole('secretary_treasurer')
  if (await isCongressOrg(user.organizationId)) {
    redirect('/dashboard/clc')
  }
  if (!minRoleMet) {
    redirect('/dashboard')
  }
  const locale = (await params)?.locale
  return (
    <CapabilityUnavailable
      locale={locale}
      capability={locale?.startsWith('fr') ? 'Finances et cotisations' : 'Finance and dues'}
    />
  )
}
