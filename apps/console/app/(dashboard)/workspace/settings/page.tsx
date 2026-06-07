import Link from 'next/link'
import { Cog6ToothIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { Card, CardBody } from '@/components/ui'
import { WorkspaceShell } from '../_components/workspace-shell'
import { LegacyBridge } from '../_components/legacy-bridge'
import { bridgeFor } from '../_lib/legacy-map'
import { requireWorkspaceUser } from '../_lib/workspace-auth'

export const dynamic = 'force-dynamic'

const SETTINGS_LINKS = [
  { name: 'System Settings', href: '/settings', description: 'Preferences, configuration, and account.' },
  { name: 'Organizations', href: '/orgs', description: 'Client organization registry and workspace management.' },
]

export default async function SettingsWorkspace() {
  await requireWorkspaceUser()

  return (
    <WorkspaceShell workspace="settings">
      <div className="grid gap-5 sm:grid-cols-2">
        {SETTINGS_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card interactive className="h-full">
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Cog6ToothIcon className="h-5 w-5 text-gray-300" />
                    <span className="text-sm font-semibold text-gray-900">{link.name}</span>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 text-gray-300" />
                </div>
                  <p className="mt-2 text-sm text-gray-500">{link.description}</p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      {(() => {
        const bridge = bridgeFor('settings', '')
        return bridge ? <LegacyBridge title={bridge.title} intro={bridge.intro} links={bridge.links} /> : null
      })()}
    </WorkspaceShell>
  )
}
