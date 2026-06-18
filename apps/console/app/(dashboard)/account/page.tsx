import Link from 'next/link'
import {
  UserCircleIcon,
  EnvelopeIcon,
  BuildingOffice2Icon,
  ShieldCheckIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import { getAuthUser } from '@nzila/platform-auth/password'
import { isSuperAdmin } from '@nzila/os-core/config/super-admins'
import { Card, CardBody, Badge, EmptyState } from '@/components/ui'
import { CommandPageShell } from '@/components/command-page-shell'
import { PageHeader } from '@/components/ui'
import { SignOutButton } from '@/components/auth/sign-out-button'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const user = await getAuthUser()

  if (!user) {
    return (
      <CommandPageShell as="div" className="space-y-8">
        <PageHeader eyebrow="Nzila Console" title="Account" description="Your profile and session." />
        <Card>
          <CardBody>
            <EmptyState
              icon={<UserCircleIcon className="h-6 w-6" />}
              title="Not signed in"
              description="No active session was found. Sign in to view your account details."
            />
            <div className="mt-6 flex justify-center">
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Go to sign in
              </Link>
            </div>
          </CardBody>
        </Card>
      </CommandPageShell>
    )
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—'
  const initials =
    (user.firstName?.charAt(0) ?? '') + (user.lastName?.charAt(0) ?? '') ||
    user.email.charAt(0).toUpperCase()
  const role = isSuperAdmin(user.email) ? 'Platform Admin' : 'Member'

  const rows = [
    { label: 'Name', value: fullName, icon: UserCircleIcon },
    { label: 'Email', value: user.email, icon: EnvelopeIcon },
    { label: 'Organization', value: user.organizationId ?? 'Personal workspace', icon: BuildingOffice2Icon },
    { label: 'Role', value: role, icon: ShieldCheckIcon },
  ]

  return (
    <CommandPageShell as="div" className="space-y-10">
      <PageHeader
        eyebrow="Nzila Console"
        title="Account"
        description="Your profile and session."
        actions={
          <Link
            href="/workspace/overview"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Overview
          </Link>
        }
      />

      <Card>
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold uppercase text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-gray-900">{fullName}</p>
              <p className="truncate text-sm text-gray-500">{user.email}</p>
            </div>
            <div className="ml-auto">
              <Badge tone={role === 'Platform Admin' ? 'violet' : 'gray'}>{role}</Badge>
            </div>
          </div>

          <dl className="mt-8 divide-y divide-gray-100 border-t border-gray-100">
            {rows.map((row) => {
              const Icon = row.icon
              return (
                <div key={row.label} className="flex items-center gap-4 py-4">
                  <dt className="flex w-40 shrink-0 items-center gap-2 text-sm text-gray-400">
                    <Icon className="h-4 w-4" />
                    {row.label}
                  </dt>
                  <dd className="min-w-0 truncate text-sm font-medium text-gray-900">{row.value}</dd>
                </div>
              )
            })}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="text-base font-semibold text-gray-900">Session</h3>
          <p className="mt-1.5 text-sm text-gray-500">
            Sign out to end this session on this device. You will be returned to the sign-in screen.
          </p>
          <div className="mt-5">
            <SignOutButton />
          </div>
        </CardBody>
      </Card>
    </CommandPageShell>
  )
}
