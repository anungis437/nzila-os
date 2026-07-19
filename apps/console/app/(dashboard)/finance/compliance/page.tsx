/**
 * /finance/compliance — Tax agent surface.
 *
 * Loads upcoming filings and installments from tax_years / tax_filings
 * / tax_installments and runs the tax agent. A tax_year is treated as
 * having an "upcoming T2" if it is open and has no filing of type T2 yet.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc, ne } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  taxYears,
  taxFilings,
  taxInstallments,
  executiveAgentRuns,
  executiveAgentInsights,
} from '@nzila/db/schema'
import {
  taxAgent,
  type TaxSignal,
  type UpcomingTaxFiling,
  type UpcomingInstallment,
} from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../../lib/executive-os'
import { createLogger } from '@nzila/os-core/telemetry'

export const dynamic = 'force-dynamic'

const logger = createLogger('console.finance.compliance')

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

function daysFrom(today: Date, dateIso: string): number {
  return Math.floor((new Date(dateIso).getTime() - today.getTime()) / 86_400_000)
}

async function loadSignal(orgId: string): Promise<TaxSignal> {
  const today = new Date()

  let years: Array<typeof taxYears.$inferSelect> = []
  let filings: Array<typeof taxFilings.$inferSelect> = []
  let installments: Array<typeof taxInstallments.$inferSelect> = []

  try {
    ;[years, filings, installments] = await Promise.all([
      platformDb.select().from(taxYears).where(and(eq(taxYears.orgId, orgId), ne(taxYears.status, 'closed'))),
      platformDb.select().from(taxFilings).where(eq(taxFilings.orgId, orgId)),
      platformDb.select().from(taxInstallments).where(eq(taxInstallments.orgId, orgId)),
    ])
  } catch (error) {
    logger.warn('tax signal load failed; returning empty fallback', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { filings: [], installments: [] }
  }

  const filingsByYear = new Map<string, typeof filings>()
  for (const f of filings) {
    const arr = filingsByYear.get(f.taxYearId) ?? []
    arr.push(f)
    filingsByYear.set(f.taxYearId, arr)
  }

  const upcomingFilings: UpcomingTaxFiling[] = []
  for (const y of years) {
    const yearFilings = filingsByYear.get(y.id) ?? []
    const t2Filed = yearFilings.find((f) => f.filingType === 'T2' && f.filedDate)
    if (!t2Filed) {
      const days = daysFrom(today, y.federalFilingDeadline)
      upcomingFilings.push({
        filingId: `${y.id}:T2`,
        filingType: 'T2',
        periodLabel: y.fiscalYearLabel,
        dueDate: y.federalFilingDeadline,
        daysUntilDue: days,
        status: days < 0 ? 'late' : 'draft',
        approver: yearFilings.find((f) => f.filingType === 'T2')?.reviewedBy ?? null,
        preparer: yearFilings.find((f) => f.filingType === 'T2')?.preparedBy ?? null,
      })
    }
    if (y.provincialFilingDeadline) {
      const co17Filed = yearFilings.find((f) => f.filingType === 'CO-17' && f.filedDate)
      if (!co17Filed) {
        const days = daysFrom(today, y.provincialFilingDeadline)
        upcomingFilings.push({
          filingId: `${y.id}:CO-17`,
          filingType: 'CO-17',
          periodLabel: y.fiscalYearLabel,
          dueDate: y.provincialFilingDeadline,
          daysUntilDue: days,
          status: days < 0 ? 'late' : 'draft',
          approver: yearFilings.find((f) => f.filingType === 'CO-17')?.reviewedBy ?? null,
          preparer: yearFilings.find((f) => f.filingType === 'CO-17')?.preparedBy ?? null,
        })
      }
    }
  }

  const upcomingInstallments: UpcomingInstallment[] = installments
    .filter((i) => i.status !== 'paid')
    .map((i) => ({
      installmentId: i.id,
      authority: 'CRA', // schema does not track per-installment authority; default
      amount: Number(i.requiredAmount),
      dueDate: i.dueDate,
      daysUntilDue: daysFrom(today, i.dueDate),
      status: i.status as 'due' | 'paid' | 'late',
    }))

  return { filings: upcomingFilings, installments: upcomingInstallments }
}

export default async function CompliancePage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  async function runIt() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const signal = await loadSignal(o)
    await runAndPersist(taxAgent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/finance/compliance')
    revalidatePath('/actions')
  }

  let lastRun: typeof executiveAgentRuns.$inferSelect | undefined
  let insights: Array<typeof executiveAgentInsights.$inferSelect> = []
  if (orgId) {
    try {
      lastRun = (
        await platformDb
          .select()
          .from(executiveAgentRuns)
          .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'tax')))
          .orderBy(desc(executiveAgentRuns.startedAt))
          .limit(1)
      )[0]
      if (lastRun) {
        insights = await platformDb
          .select()
          .from(executiveAgentInsights)
          .where(eq(executiveAgentInsights.runId, lastRun.id))
      }
    } catch (error) {
      logger.warn('tax run history load failed; returning empty fallback', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Tax / Compliance</h1>
          <p className="mt-2 text-sm text-slate-600">
            Filing deadlines, installments, approver coverage. Reads from{' '}
            <code className="rounded bg-slate-100 px-1">tax_years</code>,{' '}
            <code className="rounded bg-slate-100 px-1">tax_filings</code>,{' '}
            <code className="rounded bg-slate-100 px-1">tax_installments</code>.
          </p>
        </div>
        <form action={runIt}>
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Run now
          </button>
        </form>
      </header>

      <Link href="/finance" className="mb-4 inline-block text-xs text-slate-500 hover:underline">← Finance hub</Link>

      {!orgId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No executive org resolved.</div>
      )}

      {lastRun && (
        <p className="mb-4 text-xs text-slate-500">
          Last run {new Date(lastRun.startedAt).toLocaleString('en-CA')} · {lastRun.summary ?? '—'}
        </p>
      )}

      <ul className="space-y-3">
        {insights.length === 0 && lastRun && <li className="text-sm text-slate-500">No insights from last run.</li>}
        {insights.map((i) => (
          <li key={i.id} className="rounded border border-slate-200 bg-white p-4">
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[i.severity] ?? ''}`}>{i.severity}</span>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">{i.title}</h3>
            <p className="mt-1 whitespace-pre-line text-xs text-slate-700">{i.body}</p>
            {i.recommendedNextStep && (
              <p className="mt-1 text-xs text-slate-600"><strong>Next:</strong> {i.recommendedNextStep}</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
