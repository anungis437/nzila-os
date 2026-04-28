import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Badge } from '@/components/primitives/Badge'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export default async function ControlPlaneIntegrationPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:integrations')

  const url = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? 'http://localhost:3010'

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Phase 9 · Integration"
        title="Control Plane"
        description="Authoritative for approvals, releases, change records, and DORA. Nzila HQ is read-only — every mutation happens upstream."
      />
      <Card title="Why this is a deep link, not a duplicate">
        <p className="text-sm text-slate-700">
          Control Plane owns the lifecycle of every change touching customer surfaces: pull-request
          approvals, deploy windows, runtime release records, kill-switches. Nzila HQ surfaces the
          aggregate signal (open approvals count, current freeze status) and links into the system
          of record. We never approve, freeze, or release from this app.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Open Control Plane →
          </a>
          <Badge tone="slate">{url}</Badge>
        </div>
      </Card>
      <Card title="What Nzila HQ aggregates">
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
            Pending approvals visible on Executive Home (read-only badge count).
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
            Recent change-failure rate as one input to portfolio confidence.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
            Active freezes / kill-switches surfaced as strategic alerts.
          </li>
        </ul>
      </Card>
    </div>
  )
}
