import { resolveOrgCommerceContext } from '@/lib/resolve-org'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const { config } = await resolveOrgCommerceContext()
  return <SettingsForm config={config} />
}
