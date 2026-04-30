import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Badge } from '@/components/primitives/Badge'
import { fmtDate } from '@/lib/format'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

const KIND_TONE = {
  customer: 'emerald',
  partner: 'sky',
  investor: 'violet',
  buyer: 'amber',
  prospect: 'slate',
  advisor: 'sky',
  other: 'slate',
} as const

export default async function CrmPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:crm')

  const repo = getHqRepository()
  const orgs = repo.listOrganizations()
  const usersById = new Map(repo.listUsers().map((u) => [u.id, u]))
  const ventures = new Map(repo.listVentures().map((v) => [v.slug, v]))

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Phase 3 · Relationship Intelligence"
        title="Relationships"
        description="Organizations, contacts, partners, investors, advisors. Internal trust score is for routing — never shared outside Nzila HQ."
      />

      <Card title="Organizations">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Organization</th>
                <th className="px-4 py-2 text-left">Kind</th>
                <th className="px-4 py-2 text-left">Venture relevance</th>
                <th className="px-4 py-2 text-left">Owner</th>
                <th className="px-4 py-2 text-right">Trust</th>
                <th className="px-4 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {orgs.map((o) => (
                <tr key={o.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{o.name}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={KIND_TONE[o.kind]}>{o.kind}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {o.ventureRelevance.map((slug) => (
                        <Badge key={slug} tone="violet">
                          {ventures.get(slug)?.name ?? slug}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {usersById.get(o.ownerUserId)?.fullName ?? o.ownerUserId}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">
                    {o.trustScore}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{o.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Contacts" description="Last interaction, owner, next step">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Organization</th>
                <th className="px-4 py-2 text-left">Owner</th>
                <th className="px-4 py-2 text-left">Last interaction</th>
                <th className="px-4 py-2 text-left">Next step</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {repo.listContacts().map((c) => {
                const org = repo.getOrganization(c.organizationId)
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{c.fullName}</td>
                    <td className="px-4 py-2.5 text-slate-700">{c.title}</td>
                    <td className="px-4 py-2.5 text-slate-700">{org?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {usersById.get(c.ownerUserId)?.fullName ?? c.ownerUserId}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      {c.lastInteractionAt ? (
                        fmtDate(c.lastInteractionAt)
                      ) : (
                        <Badge tone="rose">undocumented</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-700">
                      {c.nextStep ?? <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
