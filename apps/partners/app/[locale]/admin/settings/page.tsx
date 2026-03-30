import { getAdminSettings } from '@/lib/actions/admin-actions'
import { AdminSettingsForm } from '@/components/partner/AdminSettingsForm'

export default async function SettingsPage() {
  const settings = await getAdminSettings()

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure partner program policies and defaults
        </p>
      </div>

      <AdminSettingsForm initial={settings} />
    </div>
  )
}
