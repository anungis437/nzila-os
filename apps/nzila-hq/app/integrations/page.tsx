/**
 * Integrations index — Phase 9 (partial, deep-link pattern).
 *
 * HQ does NOT replicate operational data from peer apps. It aggregates only
 * what an executive needs and links into the system of record. This page
 * names each peer system, says what HQ aggregates, and links to the deep-link
 * detail page.
 */
import Link from 'next/link'
import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Stat } from '@/components/primitives/Stat'
import { Badge } from '@/components/primitives/Badge'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'
import { allPeerPulses, type PeerStatus } from '@/server/integrations/peer-pulse'

export const dynamic = 'force-dynamic'

interface PeerSystem {
  href: string
  name: string
  authoritativeFor: string
  hqAggregates: string[]
}

const PEERS: PeerSystem[] = [
  {
    href: '/integrations/console',
    name: 'Console',
    authoritativeFor:
      'Day-to-day operational workspace per venture (tickets, task queues, runbooks).',
    hqAggregates: [
      'Per-venture blocker counts, surfaced into Founder Dependency.',
      'Product escalations, surfaced into Wednesday cadence ritual.',
      'Console app linkage on each venture (`venture.consoleAppId`).',
    ],
  },
  {
    href: '/integrations/platform-admin',
    name: 'Platform Admin',
    authoritativeFor: 'Tenant lifecycle, organization membership, identity & RBAC seed.',
    hqAggregates: [
      'User identity (`HqUser.id`, role) used for ownership labels.',
      'Organization roster used for the relationship graph.',
    ],
  },
  {
    href: '/integrations/control-plane',
    name: 'Control Plane',
    authoritativeFor:
      'Cross-cutting governance: contracts, audit, deploy gates, schema drift checks.',
    hqAggregates: [
      'Audit log surface (referenced from `view:audit-log` capability).',
      'Drift / contract incidents — surfaced when wired to alerts engine.',
    ],
  },
]

export default async function IntegrationsIndexPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:integrations')

  const repo = getHqRepository()
  const ventures = repo.listVentures()
  const consoleLinked = ventures.filter((v) => v.consoleAppId !== null).length
  const pulses = await allPeerPulses()
  const healthy = pulses.filter((p) => p.status === 'healthy').length

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Phase 9 · Integrations"
        title="HQ is the aggregator, not the owner."
        description="Each peer system below remains the source of truth for its domain. HQ pulls only what an executive needs to make portfolio-level decisions, and deep-links back for detail."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ventures tracked" value={ventures.length} />
        <Stat
          label="Linked to Console"
          value={`${consoleLinked}/${ventures.length}`}
          tone={consoleLinked === ventures.length ? 'green' : 'amber'}
        />
        <Stat label="Peer systems" value={PEERS.length} />
        <Stat
          label="Live & healthy"
          value={`${healthy}/${pulses.length}`}
          tone={healthy === pulses.length ? 'green' : healthy === 0 ? 'red' : 'amber'}
        />
      </div>

      <Card title="Live peer pulse" description="Real-time health from /api/health on each peer. 1.5s timeout, server-side, never blocks the cockpit.">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">App</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Latency</th>
                <th className="px-4 py-2 text-left">Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pulses.map((p) => (
                <tr key={p.app}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{p.app}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                    {p.reason && (
                      <span className="ml-2 text-xs text-slate-500">{p.reason}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                    {p.latencyMs == null ? '—' : `${p.latencyMs} ms`}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 tabular-nums">
                    {p.version ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {PEERS.map((p) => (
          <Card key={p.href} title={p.name} description={p.authoritativeFor}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              What HQ aggregates
            </div>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {p.hqAggregates.map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 inline-block h-1 w-1 rounded-full bg-slate-400" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Link
                href={p.href}
                className="text-xs font-semibold text-slate-900 hover:underline"
              >
                Open {p.name} integration detail →
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <Card title="Why HQ is not a duplicate">
        <p className="text-sm text-slate-700">
          Console is the operations workspace. Platform Admin is the tenant layer. Control Plane is
          governance. HQ is the executive cockpit — it answers
          <em> &ldquo;what is the founder going to do this week, and why?&rdquo;</em> If you ever
          find HQ replicating a peer system&rsquo;s record-level data, that is a smell — push the
          aggregation back to the source and have HQ pull only the rollup.
        </p>
      </Card>
    </div>
  )
}

function statusTone(s: PeerStatus): 'emerald' | 'amber' | 'rose' | 'slate' {
  if (s === 'healthy') return 'emerald'
  if (s === 'degraded') return 'amber'
  if (s === 'down') return 'rose'
  return 'slate'
}
