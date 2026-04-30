import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Badge } from '@/components/primitives/Badge'
import { EmptyState } from '@/components/primitives/EmptyState'
import { fmtDate } from '@/lib/format'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export default async function DocumentsPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:documents')

  const repo = getHqRepository()
  const docs = repo.listDocuments()
  const ventures = new Map(repo.listVentures().map((v) => [v.slug, v]))
  const usersById = new Map(repo.listUsers().map((u) => [u.id, u]))

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Phase 8 · Strategic Document Hub"
        title="Documents"
        description="Decks, proposals, term sheets, pricing, legal, partnership memos, investor materials. Source of truth for what we send out."
      />
      <Card>
        {docs.length === 0 ? (
          <EmptyState title="No documents tracked yet" />
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Title</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-left">Venture</th>
                  <th className="px-4 py-2 text-left">Owner</th>
                  <th className="px-4 py-2 text-left">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {docs.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium">
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-slate-900 hover:underline"
                      >
                        {d.title}
                      </a>
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone="slate">{d.category}</Badge>
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      {d.ventureSlug ? (ventures.get(d.ventureSlug)?.name ?? d.ventureSlug) : '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      {usersById.get(d.ownerUserId)?.fullName ?? d.ownerUserId}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{fmtDate(d.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
