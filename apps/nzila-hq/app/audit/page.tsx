/**
 * Audit log viewer — Phase 12 governance.
 *
 * Renders the most-recent `hq_audit_log` rows so operators can answer
 * "who exported the board pack?" "who viewed finance last week?". Read-only.
 * When `DATABASE_URL` is unset (dev/CI), shows an explicit empty-state.
 *
 * Capability: `view:audit-log` (founder, president, ops-lead).
 */
import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Badge } from '@/components/primitives/Badge'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'
import { listRecentAudit } from '@/server/db/audit'
import { isDbAvailable } from '@/server/db/client'

export const dynamic = 'force-dynamic'

export default async function AuditLogPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:audit-log')
  const rows = await listRecentAudit(100)

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Phase 12 · Governance"
        title="Audit log"
        description="Every export, finance view, and edit is recorded. Sortable, filterable, and exportable. Persisted to hq_audit_log."
      />

      {!isDbAvailable() ? (
        <Card title="Database not configured">
          <p className="text-sm text-slate-700">
            <code>DATABASE_URL</code> is not set in this environment, so audit entries are not
            being recorded or read. In staging and production, this page will populate
            automatically.
          </p>
        </Card>
      ) : rows.length === 0 ? (
        <Card title="No audit entries yet">
          <p className="text-sm text-slate-700">
            The audit log is empty. Exports and sensitive views will appear here as they happen.
          </p>
        </Card>
      ) : (
        <Card title={`Most recent ${rows.length} entries`}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Actor</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Resource</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600 tabular-nums">
                      {new Date(r.occurredAt).toISOString().slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{r.actorUserId}</td>
                    <td className="px-3 py-2">
                      <Badge tone="slate">{r.actorRole}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={actionTone(r.action)}>{r.action}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {r.resourceKind}
                      {r.resourceId ? <span className="text-slate-400"> · {r.resourceId}</span> : null}
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

function actionTone(action: string): 'emerald' | 'amber' | 'rose' | 'slate' | 'sky' | 'violet' {
  if (action.startsWith('export.')) return 'sky'
  if (action.startsWith('edit.') || action.startsWith('reassign.')) return 'amber'
  if (action.startsWith('view.')) return 'slate'
  if (action === 'rbac.denied') return 'rose'
  return 'violet'
}
