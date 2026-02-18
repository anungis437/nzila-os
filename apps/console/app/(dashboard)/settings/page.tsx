'use client'

import { Card } from '@nzila/ui'
import { Badge } from '@nzila/ui'
import {
  Cog6ToothIcon,
  UserCircleIcon,
  ShieldCheckIcon,
  BellIcon,
  KeyIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline'

const sections = [
  {
    title: 'Profile',
    description: 'Update your name, email, and avatar.',
    icon: UserCircleIcon,
    badge: null,
  },
  {
    title: 'Security',
    description: 'Manage passwords, MFA, and active sessions.',
    icon: KeyIcon,
    badge: null,
  },
  {
    title: 'Roles & Permissions',
    description: 'View your platform and entity-level roles.',
    icon: ShieldCheckIcon,
    badge: 'RBAC' as const,
  },
  {
    title: 'Notifications',
    description: 'Configure email and in-app notification preferences.',
    icon: BellIcon,
    badge: null,
  },
  {
    title: 'Organisation',
    description: 'Manage workspace-level settings and billing.',
    icon: BuildingOfficeIcon,
    badge: null,
  },
]

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Cog6ToothIcon className="h-7 w-7 text-gray-700" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">
            Manage your account, security, and workspace preferences.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.title} variant="bordered" className="hover:shadow-sm transition-all cursor-pointer">
            <Card.Body className="flex items-start gap-4">
              <s.icon className="h-6 w-6 text-gray-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{s.title}</p>
                  {s.badge && <Badge variant="info">{s.badge}</Badge>}
                </div>
                <p className="text-sm text-gray-500 mt-1">{s.description}</p>
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>
    </div>
  )
}
