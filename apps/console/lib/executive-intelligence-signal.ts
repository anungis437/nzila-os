/**
 * apps/console/lib/executive-intelligence-signal.ts
 *
 * Shared loader that builds a `SynthesisSignal` from whatever live bridge
 * tables are currently materialized in the platform DB:
 *   - cs_accounts (renewals, health, support burden, QBR staleness)
 *   - erp_invoices (joined by customer_name → overdue AR per account)
 *   - runway_assumptions + treasury_snapshots (runway proxy)
 *
 * Missing domains (ITSM tickets, grants, portfolio items) yield empty arrays
 * today; the cross-domain agent treats these as no-signal and degrades
 * gracefully.
 */
import { and, eq, desc, sum, sql } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import {
  csAccounts,
  erpInvoices,
  runwayAssumptions,
  treasurySnapshots,
} from '@nzila/db/schema'
import type { SynthesisSignal, SynthesisAccount } from '@nzila/executive-os'

function healthCoerce(h: string | null): SynthesisAccount['healthScore'] {
  if (h === 'red' || h === 'yellow' || h === 'green') return h
  return 'unknown'
}

export async function loadSynthesisSignal(orgId: string): Promise<SynthesisSignal> {
  const now = Date.now()

  // 1. CS accounts
  const accountRows = await platformDb
    .select()
    .from(csAccounts)
    .where(eq(csAccounts.organizationId, orgId))
    .limit(500)

  // 2. Overdue AR per customer_name (status != 'paid' AND amount_due > 0 AND due_date < now)
  const arRows = await platformDb
    .select({
      customerName: erpInvoices.customerName,
      overdue: sum(erpInvoices.amountDue).as('overdue'),
    })
    .from(erpInvoices)
    .where(
      and(
        eq(erpInvoices.organizationId, orgId),
        sql`${erpInvoices.amountDue} > 0`,
        sql`${erpInvoices.dueDate} < now()`,
      ),
    )
    .groupBy(erpInvoices.customerName)

  const overdueByCustomer = new Map<string, number>()
  for (const r of arRows) {
    overdueByCustomer.set(r.customerName.toLowerCase(), Number(r.overdue ?? 0))
  }

  const accounts: SynthesisAccount[] = accountRows.map((a) => {
    const renewMs = a.renewalDate ? new Date(a.renewalDate).getTime() : null
    const renewalInDays = renewMs !== null ? Math.floor((renewMs - now) / 86_400_000) : null
    const qbrMs = a.lastQbrAt ? new Date(a.lastQbrAt).getTime() : null
    const lastQbrDaysAgo = qbrMs !== null ? Math.floor((now - qbrMs) / 86_400_000) : null
    const overdueArCad = overdueByCustomer.get(a.clientName.toLowerCase()) ?? 0
    return {
      accountId: a.id,
      clientName: a.clientName,
      contractValueCad: a.contractValue === null ? 0 : Number(a.contractValue),
      healthScore: healthCoerce(a.healthScore),
      renewalInDays,
      openSupportTickets: a.openSupportCount ?? 0,
      lastQbrDaysAgo,
      overdueArCad,
    }
  })

  // 3. Runway proxy: latest treasury snapshot + monthly burn assumption.
  // If neither table populated, runway is null (agent handles gracefully).
  let runwayMonths: number | null = null
  const [lastTreasury] = await platformDb
    .select()
    .from(treasurySnapshots)
    .where(eq(treasurySnapshots.orgId, orgId))
    .orderBy(desc(treasurySnapshots.date))
    .limit(1)
  const [assumption] = await platformDb
    .select()
    .from(runwayAssumptions)
    .where(eq(runwayAssumptions.orgId, orgId))
    .orderBy(desc(runwayAssumptions.updatedAt))
    .limit(1)
  if (lastTreasury && assumption) {
    const cash = Number(lastTreasury.cashOnHand)
    const discretionary = Number(assumption.discretionarySpend)
    const revenue = Number(assumption.expectedMonthlyRevenue)
    const netBurn = Math.max(1, discretionary - revenue) // avoid div-by-zero
    runwayMonths = cash / netBurn
  }

  return {
    runwayMonths,
    accounts,
    incidents: [],
    grants: [],
    portfolio: [],
  }
}
