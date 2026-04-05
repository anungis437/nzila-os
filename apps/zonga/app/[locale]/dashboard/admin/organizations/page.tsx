/**
 * Zonga — Organization Management (Server Component).
 *
 * Platform admin view listing all organizations (labels, distributors)
 * with member counts, plan tiers, and status tracking.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import Link from 'next/link'

interface OrgRow {
  id: string
  name: string
  slug: string | null
  status: string | null
  memberCount: number
  createdAt: string
}

const statusBadge = (status: string | null) => {
  const s = status ?? 'active'
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    suspended: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
    trial: 'bg-blue-100 text-blue-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[s] ?? colors.active}`}>
      {s}
    </span>
  )
}

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams
  const searchFilter = params.search
    ? sql` AND LOWER(o.name) LIKE ${'%' + params.search.toLowerCase() + '%'}`
    : sql``

  let orgs: OrgRow[] = []
  try {
    const rows = await platformDb.execute(sql`
      SELECT
        o.id,
        o.name,
        o.slug,
        o.status,
        COALESCE(c.cnt, 0)::int AS "memberCount",
        o.created_at AS "createdAt"
      FROM organizations o
      LEFT JOIN (
        SELECT org_id, COUNT(*)::int AS cnt FROM zonga_creators GROUP BY org_id
      ) c ON c.org_id = o.id
      WHERE o.organization_type = 'local'
      ${searchFilter}
      ORDER BY o.name ASC
      LIMIT 100
    `)
    orgs = rows as unknown as OrgRow[]
  } catch {
    // DB not seeded or table missing — show empty state
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {orgs.length} organization{orgs.length !== 1 ? 's' : ''} registered on the platform.
          </p>
        </div>

        {/* Search */}
        <form className="flex gap-2">
          <input
            type="text"
            name="search"
            placeholder="Search organizations…"
            defaultValue={params.search ?? ''}
            className="rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Search
          </button>
        </form>
      </div>

      {orgs.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <p className="text-4xl">🏢</p>
            <p className="mt-3 text-sm font-medium text-foreground">No organizations found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Organizations will appear here once labels and distributors register.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Members</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orgs.map((org) => (
                  <tr key={org.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <Link href={`organizations/${org.id}`} className="hover:text-emerald-600 transition-colors">
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{org.slug ?? '—'}</td>
                    <td className="px-4 py-3">{org.memberCount}</td>
                    <td className="px-4 py-3">{statusBadge(org.status)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
