import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Badge } from '@/components/primitives/Badge'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export default async function PlatformAdminIntegrationPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:integrations')

  const url = process.env.NEXT_PUBLIC_PLATFORM_ADMIN_URL ?? 'http://localhost:3015'

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Phase 10 · Integration"
        title="Platform Admin"
        description="Authoritative for organizations, users, seats, role assignments, billing entitlements. All membership changes happen here."
      />
      <Card title="Why this is a deep link, not a duplicate">
        <p className="text-sm text-slate-700">
          Platform Admin is the membership system of record across every Nzila product surface
          (Console, Union Eyes, Zonga, etc.). Nzila HQ uses its read-only API to attribute contacts,
          opportunities, and venture relationships to the correct org — but never creates or
          modifies orgs, users, or seats from this app.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Open Platform Admin →
          </a>
          <Badge tone="slate">{url}</Badge>
        </div>
      </Card>
      <Card title="What Nzila HQ aggregates">
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
            Organization name + tier on portfolio cards and CRM rows.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
            Seat utilization for revenue concentration / expansion signals.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
            User identity for delegation queue ownership.
          </li>
        </ul>
      </Card>
    </div>
  )
}
