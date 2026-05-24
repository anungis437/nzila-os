import { ArrowLeftIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'
import { Card } from '@nzila/ui'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { orgs } from '@nzila/db/schema'
import { getExecutiveOrgId } from '@/lib/executive-os'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Organisation | Settings | Nzila Console',
}

export default async function OrganisationSettingsPage() {
  const orgId = await getExecutiveOrgId()
  const org = orgId
    ? await platformDb.query.orgs.findFirst({ where: eq(orgs.id, orgId) }).catch(() => null)
    : null

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
        <BuildingOfficeIcon className="h-7 w-7 text-gray-700" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organisation</h1>
          <p className="text-sm text-gray-500">
            Workspace context resolved for this request (read-only).
          </p>
        </div>
      </div>

      {!org ? (
        <Card variant="bordered">
          <Card.Body>
            <p className="text-sm text-gray-600">
              No organisation could be resolved for this session.
            </p>
          </Card.Body>
        </Card>
      ) : (
        <Card variant="bordered">
          <Card.Body>
            <dl className="divide-y divide-gray-100 text-sm">
              <Row label="Org ID" value={org.id} mono />
              <Row label="Legal name" value={org.legalName ?? '—'} />
              {'displayName' in org && org.displayName ? (
                <Row label="Display name" value={String(org.displayName)} />
              ) : null}
              {'jurisdiction' in org && org.jurisdiction ? (
                <Row label="Jurisdiction" value={String(org.jurisdiction)} />
              ) : null}
              {'createdAt' in org && org.createdAt ? (
                <Row
                  label="Created"
                  value={new Date(org.createdAt as Date | string).toLocaleString()}
                />
              ) : null}
            </dl>
          </Card.Body>
        </Card>
      )}

      <p className="text-xs text-gray-400 mt-6">
        Renaming an organisation or transferring ownership is performed via the platform-admin
        surface and recorded in the NAR governance ledger.
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
