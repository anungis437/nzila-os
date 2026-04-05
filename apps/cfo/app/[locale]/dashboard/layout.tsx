import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { getUserRoles, getVisiblePages, isClientRole, type FirmRole as _FirmRole, type ClientRole as _ClientRole } from '@/lib/rbac'
import { DashboardShell } from './dashboard-shell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { platformRole, firmRole } = await getUserRoles()

  // Platform admins see everything
  const visiblePages =
    platformRole === 'platform_admin'
      ? null // null = show all
      : getVisiblePages(firmRole)

  const isClient = isClientRole(firmRole)

  return (
    <DashboardShell
      visiblePages={visiblePages}
      isClientUser={isClient}
      userRole={firmRole}
    >
      {children}
    </DashboardShell>
  )
}
