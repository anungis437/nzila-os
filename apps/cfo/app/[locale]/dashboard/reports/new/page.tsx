/**
 * CFO — Generate Report Page.
 *
 * Accepts a ?type= query param from the reports page cards.
 * Client form to select period, optional AI narrative, then calls
 * the generateReport server action.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'
import { GenerateReportForm } from '@/components/generate-report-form'

const typeLabels: Record<string, string> = {
  pnl: 'Profit & Loss',
  'balance-sheet': 'Balance Sheet',
  'cash-flow': 'Cash Flow Statement',
  'tax-summary': 'Tax Summary',
  'audit-trail': 'Audit Trail',
}

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams
  const reportType = params.type ?? 'pnl'
  const label = typeLabels[reportType] ?? reportType

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        href="../reports"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Reports
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-electric/10 text-electric">
          <FileText className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-poppins text-2xl font-bold text-foreground">Generate Report</h2>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>

      <GenerateReportForm reportType={reportType} />
    </div>
  )
}
