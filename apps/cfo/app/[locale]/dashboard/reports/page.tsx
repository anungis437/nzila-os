/**
 * CFO — Reports Page (Server Component).
 *
 * Financial report hub: list existing reports, generate new ones
 * with optional AI narrative summary.
 */
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/rbac'
import {
  FileText,
  BarChart3,
  PieChart,
  TrendingUp,
  ClipboardCheck,
  Download,
} from 'lucide-react'
import { listReports, type Report } from '@/lib/actions/report-actions'

const reportTypes: { value: Report['type']; label: string; icon: typeof FileText }[] = [
  { value: 'pnl', label: 'Profit & Loss', icon: BarChart3 },
  { value: 'balance-sheet', label: 'Balance Sheet', icon: PieChart },
  { value: 'cash-flow', label: 'Cash Flow Statement', icon: TrendingUp },
  { value: 'tax-summary', label: 'Tax Summary', icon: ClipboardCheck },
  { value: 'audit-trail', label: 'Audit Trail', icon: FileText },
]

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  await requirePermission('reports:view')

  const params = await searchParams
  const page = Number(params.page ?? '1')
  const { reports, total } = await listReports({ page, pageSize: 20 })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-foreground">Reports</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate and review financial reports with AI-powered narratives
          </p>
        </div>
      </div>

      {/* Report Type Quick-Generate Cards */}
      <div>
        <h3 className="mb-3 font-poppins text-sm font-semibold text-foreground">
          Generate New Report
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {reportTypes.map((rt) => (
            <Link
              key={rt.value}
              href={`reports/new?type=${rt.value}`}
              className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-electric/40 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-electric/10 text-electric transition-colors group-hover:bg-electric group-hover:text-white">
                <rt.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-foreground">{rt.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Reports List */}
      <div>
        <h3 className="mb-3 font-poppins text-sm font-semibold text-foreground">
          Recent Reports ({total})
        </h3>
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="font-poppins text-lg font-semibold text-foreground">
              No reports generated yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Click a report type above to generate your first report.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-secondary/50">
                <tr>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Report</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Period</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">AI Narrative</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.map((report) => (
                  <tr key={report.id} className="transition-colors hover:bg-secondary/30">
                    <td className="max-w-[200px] truncate px-4 py-3 font-medium text-foreground">
                      {report.title}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-electric/10 px-2 py-0.5 text-xs font-medium text-electric">
                        {report.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {report.period ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          report.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : report.status === 'generated'
                              ? 'bg-blue-500/10 text-blue-500'
                              : 'bg-amber-500/10 text-amber-500'
                        }`}
                      >
                        {report.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {report.createdAt
                        ? new Date(report.createdAt).toLocaleDateString('en-CA')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {report.narrativeSummary ? (
                        <span className="text-xs text-emerald-500">✓ Included</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`reports/${report.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-electric hover:underline"
                      >
                        <Download className="h-3 w-3" /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
