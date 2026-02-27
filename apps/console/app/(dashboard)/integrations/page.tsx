/**
 * Integrations Center — Catalog + Status
 * /integrations
 *
 * Enterprise integrations catalog showing all available providers,
 * their status, and quick actions. Org-scoped view.
 */
import {
  PuzzlePieceIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  DevicePhoneMobileIcon,
  BellAlertIcon,
  GlobeAltIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { Card } from '@nzila/ui'

export const dynamic = 'force-dynamic'

// ── Integration catalog ─────────────────────────────────────────────────────

interface CatalogItem {
  provider: string
  name: string
  type: string
  typeLabel: string
  description: string
  icon: React.ReactNode
  color: string
  status: 'available' | 'coming-soon'
}

const catalog: CatalogItem[] = [
  // Email
  {
    provider: 'resend',
    name: 'Resend',
    type: 'email',
    typeLabel: 'Email',
    description: 'Modern email delivery with React email templates.',
    icon: <EnvelopeIcon className="h-5 w-5 text-white" />,
    color: 'bg-black',
    status: 'available',
  },
  {
    provider: 'sendgrid',
    name: 'SendGrid',
    type: 'email',
    typeLabel: 'Email',
    description: 'Reliable transactional and marketing email at scale.',
    icon: <EnvelopeIcon className="h-5 w-5 text-white" />,
    color: 'bg-blue-600',
    status: 'available',
  },
  {
    provider: 'mailgun',
    name: 'Mailgun',
    type: 'email',
    typeLabel: 'Email',
    description: 'Email API for developers — transactional delivery.',
    icon: <EnvelopeIcon className="h-5 w-5 text-white" />,
    color: 'bg-red-600',
    status: 'available',
  },
  // SMS
  {
    provider: 'twilio',
    name: 'Twilio',
    type: 'sms',
    typeLabel: 'SMS',
    description: 'SMS, voice, and messaging APIs. TCPA-compliant.',
    icon: <DevicePhoneMobileIcon className="h-5 w-5 text-white" />,
    color: 'bg-red-500',
    status: 'available',
  },
  // Push
  {
    provider: 'firebase',
    name: 'Firebase Cloud Messaging',
    type: 'push',
    typeLabel: 'Push',
    description: 'Push notifications to iOS, Android, and Web.',
    icon: <BellAlertIcon className="h-5 w-5 text-white" />,
    color: 'bg-amber-500',
    status: 'available',
  },
  // ChatOps
  {
    provider: 'slack',
    name: 'Slack',
    type: 'chatops',
    typeLabel: 'ChatOps',
    description: 'Team notifications via webhooks or bot integration.',
    icon: <ChatBubbleLeftRightIcon className="h-5 w-5 text-white" />,
    color: 'bg-purple-600',
    status: 'available',
  },
  {
    provider: 'teams',
    name: 'Microsoft Teams',
    type: 'chatops',
    typeLabel: 'ChatOps',
    description: 'Channel notifications via incoming webhooks + Adaptive Cards.',
    icon: <ChatBubbleLeftRightIcon className="h-5 w-5 text-white" />,
    color: 'bg-indigo-600',
    status: 'available',
  },
  // CRM
  {
    provider: 'hubspot',
    name: 'HubSpot',
    type: 'crm',
    typeLabel: 'CRM',
    description: 'Sync contacts, deals, and engagement notes. Rate-limit aware.',
    icon: <UserGroupIcon className="h-5 w-5 text-white" />,
    color: 'bg-orange-500',
    status: 'available',
  },
  // Webhooks
  {
    provider: 'webhooks',
    name: 'Webhooks',
    type: 'webhooks',
    typeLabel: 'Webhooks',
    description: 'Outbound event delivery with HMAC signatures and replay protection.',
    icon: <GlobeAltIcon className="h-5 w-5 text-white" />,
    color: 'bg-gray-700',
    status: 'available',
  },
]

function StatusBadge({ status }: { status: CatalogItem['status'] }) {
  if (status === 'available') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Available
      </span>
    )
  }
  return (
    <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded">Coming soon</span>
  )
}

function TypeBadge({ label }: { label: string }) {
  return (
    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-medium">
      {label}
    </span>
  )
}

export default function IntegrationsCatalogPage() {
  const grouped = {
    email: catalog.filter((c) => c.type === 'email'),
    sms: catalog.filter((c) => c.type === 'sms'),
    push: catalog.filter((c) => c.type === 'push'),
    chatops: catalog.filter((c) => c.type === 'chatops'),
    crm: catalog.filter((c) => c.type === 'crm'),
    webhooks: catalog.filter((c) => c.type === 'webhooks'),
  }

  const sections = [
    { key: 'email', label: 'Email Providers', items: grouped.email },
    { key: 'sms', label: 'SMS Providers', items: grouped.sms },
    { key: 'push', label: 'Push Notifications', items: grouped.push },
    { key: 'chatops', label: 'ChatOps', items: grouped.chatops },
    { key: 'crm', label: 'CRM', items: grouped.crm },
    { key: 'webhooks', label: 'Webhooks', items: grouped.webhooks },
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PuzzlePieceIcon className="h-7 w-7 text-gray-700" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integrations Center</h1>
            <p className="text-sm text-gray-500">
              Configure and monitor all platform integrations. Org-scoped, audited, governed.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/integrations/deliveries"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Delivery Logs
          </Link>
          <Link
            href="/integrations/dlq"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Dead Letters
          </Link>
        </div>
      </div>

      {/* Catalog sections */}
      {sections.map((section) => (
        <div key={section.key} className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">{section.label}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.items.map((item) => (
              <Link key={item.provider} href={`/integrations/${item.provider}`}>
                <Card variant="bordered" className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <Card.Body>
                    <div className="flex items-start gap-3">
                      <div
                        className={`h-10 w-10 rounded-lg ${item.color} flex items-center justify-center shrink-0`}
                      >
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{item.name}</h3>
                          <StatusBadge status={item.status} />
                          <TypeBadge label={item.typeLabel} />
                        </div>
                        <p className="text-sm text-gray-500">{item.description}</p>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
