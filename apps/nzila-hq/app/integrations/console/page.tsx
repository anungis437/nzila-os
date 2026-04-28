import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Badge } from '@/components/primitives/Badge'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export default async function ConsoleIntegrationPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:integrations')

  const url = process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3001'

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Phase 11 · Integration"
        title="Operator Console"
        description="Authoritative for product health, cross-tenant operations, support escalations, and operational telemetry."
      />
      <Card title="Why this is a deep link, not a duplicate">
        <p className="text-sm text-slate-700">
          Console is where operators do the work — incident response, tenant configuration,
          escalation triage. Nzila HQ surfaces strategic-level rollups (open P1s by venture,
          customer-impacting incidents this week) so the founder sees the signal without leaving the
          executive cockpit. Operators always work in Console.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Open Console →
          </a>
          <Badge tone="slate">{url}</Badge>
        </div>
      </Card>
      <Card title="What Nzila HQ aggregates">
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
            Open P1/P2 incident counts by venture on portfolio cards.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
            Product escalations routed into the delegation queue.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
            Health badge color (green/amber/red) per venture.
          </li>
        </ul>
      </Card>
    </div>
  )
}
