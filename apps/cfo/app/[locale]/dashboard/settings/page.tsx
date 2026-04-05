/**
 * CFO — Settings Page.
 *
 * Fetches current settings server-side, renders editable form client-side.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/rbac'
import { Settings } from 'lucide-react'
import { getSettings } from '@/lib/actions/misc-actions'
import { SettingsForm } from '@/components/settings-form'

export default async function SettingsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  await requirePermission('settings:view')

  const settings = await getSettings()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-electric/10 text-electric">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-poppins text-2xl font-bold text-foreground">Settings</h2>
          <p className="text-sm text-muted-foreground">Configure your CFO workspace</p>
        </div>
      </div>

      <SettingsForm initial={settings} />
    </div>
  )
}
