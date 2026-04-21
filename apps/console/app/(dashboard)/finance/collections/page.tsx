/**
 * /finance/collections — Collections agent surface.
 *
 * Live vs `erp_invoices` (ERP AR mirror). Overdue = dueDate < now AND
 * status ∉ {paid, void, cancelled} AND amountDue > 0.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc, lt, gt, not, inArray, sql } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  erpInvoices,
  executiveAgentRuns,
  executiveAgentInsights,
  executiveAgentActions,
} from '@nzila/db/schema'
import {
  collectionsAgent,
  type CollectionsSignal,
  type OverdueInvoice,
} from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../../lib/executive-os'

export const dynamic = 'force-dynamic'

const CLOSED_INVOICE_STATUSES = ['paid', 'void', 'cancelled', 'written_off']

async function loadSignal(orgId: string): Promise<CollectionsSignal> {
  const now = new Date()
  const rows = await platformDb
    .select({
      id: erpInvoices.id,
      customerId: erpInvoices.customerId,
      customerName: erpInvoices.customerName,
      amountDue: erpInvoices.amountDue,
      dueDate: erpInvoices.dueDate,
      status: erpInvoices.status,
      memo: erpInvoices.memo,
    })
    .from(erpInvoices)
    .where(
      and(
        eq(erpInvoices.organizationId, orgId),
        lt(erpInvoices.dueDate, now),
        not(inArray(erpInvoices.status, CLOSED_INVOICE_STATUSES)),
        gt(sql`${erpInvoices.amountDue}::numeric`, sql`0`),
      ),
    )
    .orderBy(desc(erpInvoices.dueDate))
    .limit(500)

  const invoices: OverdueInvoice[] = rows.map((r) => {
    const due = new Date(r.dueDate)
    const daysOverdue = Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86_400_000))
    const amount = Number(r.amountDue)
    const disputed =
      typeof r.memo === 'string' && /dispute/i.test(r.memo) ? true : undefined
    return {
      invoiceId: r.id,
      clientId: r.customerId,
      clientName: r.customerName,
      amount: Number.isFinite(amount) ? amount : 0,
      dueDate: due.toISOString(),
      daysOverdue,
      disputed,
    }
  })

  return { invoices }
}

export default async function CollectionsPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  async function runCollections() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const signal = await loadSignal(o)
    await runAndPersist(collectionsAgent, {
      orgId: o,
      actorId: u.id,
      triggeredBy: 'manual',
      input: signal,
    })
    revalidatePath('/finance/collections')
    revalidatePath('/actions')
  }

  const [lastRun] = orgId
    ? await platformDb
        .select()
        .from(executiveAgentRuns)
        .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'collections')))
        .orderBy(desc(executiveAgentRuns.startedAt))
        .limit(1)
    : [null]

  const insights = lastRun
    ? await platformDb
        .select()
        .from(executiveAgentInsights)
        .where(eq(executiveAgentInsights.runId, lastRun.id))
    : []

  const drafts = orgId
    ? await platformDb
        .select()
        .from(executiveAgentActions)
        .where(
          and(
            eq(executiveAgentActions.orgId, orgId),
            eq(executiveAgentActions.agentKey, 'collections'),
            eq(executiveAgentActions.approvalState, 'pending'),
          ),
        )
        .orderBy(desc(executiveAgentActions.createdAt))
        .limit(20)
    : []

  const signal = orgId ? await loadSignal(orgId) : { invoices: [] as OverdueInvoice[] }
  const totalOverdue = signal.invoices.reduce((sum, i) => sum + i.amount, 0)
  const over60 = signal.invoices.filter((i) => i.daysOverdue >= 60).length

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Collections</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            AR priority queue, follow-up sequencing, and dispute flags.
            Approve drafts in <Link className="underline" href="/actions">/actions</Link>.
          </p>
        </div>
        <form action={runCollections}>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Run now
          </button>
        </form>
      </header>

      {!orgId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No executive org resolved.
        </div>
      )}

      {lastRun && (
        <p className="mb-4 text-xs text-slate-500">
          Last run {new Date(lastRun.startedAt).toLocaleString('en-CA')} · {lastRun.summary ?? '—'}
        </p>
      )}

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Overdue invoices</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{signal.invoices.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total overdue</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">${totalOverdue.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className={`rounded-lg border p-4 ${over60 > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs uppercase tracking-wide text-slate-500">≥60d overdue</p>
          <p className={`mt-1 text-2xl font-semibold ${over60 > 0 ? 'text-red-800' : 'text-slate-900'}`}>{over60}</p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Insights</h2>
        {insights.length === 0 ? (
          <p className="text-sm text-slate-500">No insights yet. Click "Run now" to refresh against live AR.</p>
        ) : (
          <ul className="space-y-2">
            {insights.map((i) => (
              <li key={i.id} className="rounded border border-slate-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-slate-900">{i.title}</h3>
                <p className="mt-1 whitespace-pre-line text-xs text-slate-700">{i.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Pending drafts ({drafts.length})</h2>
        {drafts.length === 0 ? (
          <p className="text-sm text-slate-500">None pending.</p>
        ) : (
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li key={d.id} className="rounded border border-slate-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-slate-900">{d.title}</h3>
                {d.description && <p className="mt-1 text-xs text-slate-700">{d.description}</p>}
                <p className="mt-1 text-xs text-slate-400">risk: {d.riskLevel}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
