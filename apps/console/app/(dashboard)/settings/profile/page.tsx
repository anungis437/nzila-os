import { ArrowLeftIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import { Card } from '@nzila/ui'
import Link from 'next/link'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { getUserRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Profile | Settings | Nzila Console',
}

export default async function ProfilePage() {
  const user = await currentUser()
  const role = await getUserRole()

  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null
  const fullName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    null

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Settings
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <UserCircleIcon className="h-7 w-7 text-gray-700" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-sm text-gray-500">
            Identity attached to your current session (read-only).
          </p>
        </div>
      </div>

      {!user ? (
        <Card variant="bordered">
          <Card.Body>
            <p className="text-sm text-gray-600">
              No active session. Sign in to view your profile.
            </p>
          </Card.Body>
        </Card>
      ) : (
        <Card variant="bordered">
          <Card.Body>
            <dl className="divide-y divide-gray-100 text-sm">
              <Row label="User ID" value={user.id} mono />
              <Row label="Full name" value={fullName ?? '—'} />
              <Row label="Email" value={email ?? '—'} />
              <Row label="Effective role" value={role} mono />
            </dl>
          </Card.Body>
        </Card>
      )}

      <p className="text-xs text-gray-400 mt-6">
        Editing identity attributes is performed in the upstream identity provider
        (Microsoft Entra ID or the local password store) — changes propagate on the next
        session refresh.
      </p>
    </div>
  )
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`col-span-2 text-gray-900 ${mono ? 'font-mono text-xs break-all' : ''}`}>
        {value}
      </dd>
    </div>
  )
}
