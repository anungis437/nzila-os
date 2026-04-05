/**
 * Zonga — Compliance & Audit Exports (Server Component).
 *
 * Admin view for generating compliance reports, viewing audit trails,
 * and exporting data for regulatory requirements.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'

interface AuditEntry {
  timestamp: string
  actor: string
  action: string
  entity: string
  detail: string
}

export default async function CompliancePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Sample audit trail — these would come from generateComplianceExport in production
  const recentAudit: AuditEntry[] = [
    { timestamp: '2026-03-30 09:14', actor: 'admin@nzila.io', action: 'asset.approved', entity: 'TRK-2847', detail: 'Track approved after rights verification' },
    { timestamp: '2026-03-30 08:42', actor: 'ops@nzila.io', action: 'payout.dispatched', entity: 'PAY-1193', detail: 'Batch payout: 12 creators via M-Pesa' },
    { timestamp: '2026-03-29 17:30', actor: 'admin@nzila.io', action: 'creator.suspended', entity: 'CRE-0443', detail: 'DMCA violation — duplicate content' },
    { timestamp: '2026-03-29 14:15', actor: 'system', action: 'integrity.scan', entity: 'SCAN-88', detail: 'Full catalog scan: 0 duplicates found' },
    { timestamp: '2026-03-29 10:22', actor: 'admin@nzila.io', action: 'export.generated', entity: 'EXP-017', detail: 'Q1 2026 revenue report (CSV)' },
    { timestamp: '2026-03-28 16:45', actor: 'system', action: 'rights.expired', entity: 'LIC-334', detail: 'Sync license expired: "Sunset Groove"' },
  ]

  const exportTypes = [
    { type: 'revenue', label: 'Revenue Report', description: 'Streaming revenue, tips, ticket sales by period', icon: '💰' },
    { type: 'royalties', label: 'Royalty Splits', description: 'Creator royalty distribution and split agreements', icon: '📊' },
    { type: 'audit_trail', label: 'Audit Trail', description: 'Full activity log for admin actions and system events', icon: '📋' },
    { type: 'moderation', label: 'Moderation History', description: 'Content moderation cases, resolutions, and escalations', icon: '🛡️' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Compliance & Audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate compliance exports, review audit trails, and manage regulatory data.
        </p>
      </div>

      {/* Export Types */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Export Reports</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {exportTypes.map((exp) => (
            <Card key={exp.type}>
              <div className="p-5 flex items-start gap-4">
                <span className="text-2xl">{exp.icon}</span>
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">{exp.label}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{exp.description}</p>
                  <div className="mt-3 flex gap-2">
                    <button className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                      Export JSON
                    </button>
                    <button className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50">
                      Export CSV
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Audit Trail */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Audit Trail</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentAudit.map((entry, i) => (
                  <tr key={i} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{entry.timestamp}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{entry.actor}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{entry.entity}</td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Compliance Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <div className="p-5 text-center">
            <p className="text-3xl font-bold text-emerald-600">98.7%</p>
            <p className="mt-1 text-xs text-muted-foreground">Rights Compliance Rate</p>
          </div>
        </Card>
        <Card>
          <div className="p-5 text-center">
            <p className="text-3xl font-bold text-emerald-600">0</p>
            <p className="mt-1 text-xs text-muted-foreground">Outstanding DMCA Claims</p>
          </div>
        </Card>
        <Card>
          <div className="p-5 text-center">
            <p className="text-3xl font-bold text-emerald-600">17</p>
            <p className="mt-1 text-xs text-muted-foreground">Exports Generated (MTD)</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
