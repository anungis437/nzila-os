import {
  Cog6ToothIcon,
  UserCircleIcon,
  BuildingOfficeIcon,
  PuzzlePieceIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline'
import { Card } from '@nzila/ui'
import Link from 'next/link'

export const metadata = {
  title: 'Settings | Nzila Console',
}

interface Section {
  title: string
  description: string
  icon: typeof UserCircleIcon
  href: string
}

const sections: Section[] = [
  {
    title: 'Profile',
    description: 'View the identity backing your current session.',
    icon: UserCircleIcon,
    href: '/settings/profile',
  },
  {
    title: 'Organisation',
    description: 'View workspace context resolved for this request.',
    icon: BuildingOfficeIcon,
    href: '/settings/organisation',
  },
  {
    title: 'Integrations',
    description: 'Connect Resend, Twilio, Slack, M365 and other providers.',
    icon: PuzzlePieceIcon,
    href: '/settings/integrations',
  },
  {
    title: 'Billing',
    description: 'Manage your subscription plan, invoices, and payment methods.',
    icon: CreditCardIcon,
    href: '/settings/billing',
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
            Manage your account, workspace, and integrated providers.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.title} href={s.href} className="block">
            <Card variant="bordered" className="hover:shadow-sm transition-all cursor-pointer h-full">
              <Card.Body className="flex items-start gap-4">
                <s.icon className="h-6 w-6 text-gray-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{s.title}</p>
                  <p className="text-sm text-gray-500 mt-1">{s.description}</p>
                </div>
              </Card.Body>
            </Card>
          </Link>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-8">
        Password change, MFA enrollment, and notification preferences live in the platform-auth
        admin surface and are not exposed here yet — open an issue if you need them in this
        console.
      </p>
    </div>
  )
}
