/**
 * Principal-specific financial authority for records that are not a `public.payments` duty.
 *
 * A live financial mandate somewhere in the organization is necessary and not sufficient.
 * The caller must hold the requested power, on a mandate that names the account and either
 * the record or the organization ledger, and must not already hold a conflicting duty or
 * appear as a participant in the action.
 */
import { and, eq, inArray, type SQL } from 'drizzle-orm'
import type { AnyColumn } from 'drizzle-orm'
import { actionPower, assessMandate } from '@/lib/authority/common'
import type { Mandate } from '@/lib/authority/ontology'
import { dutyConflicts } from '@/lib/authority/policies/finance'
import { FinancialDutyError, assertLiveFinancialMandate, type FinancialAction } from '@/lib/authority/store/finance-route-adapter'
import { loadHolderMandates } from '@/lib/authority/store/facts'
import type { SqlExecutor } from '@/lib/authority/store/executor'

const SEGREGATED = new Set(['approve', 'execute', 'reconcile', 'audit'])

export interface PrincipalFinancialInput {
  organizationId: string
  userId: string
  action: FinancialAction
  accountId?: string
  resourceId?: string
  employerId?: string
  participants?: readonly string[]
  requiresLedger?: boolean
}

export interface PrincipalFinancialGrant {
  mandateId: string
  ledgerWide: boolean
  resourceIds: readonly string[]
  accountIds: readonly string[]
}

export type PrincipalFinancialDenial = 'DUTY_NOT_HELD' | 'NOT_FOUND' | 'SEGREGATION_OF_DUTIES'

function covers(mandate: Mandate, input: PrincipalFinancialInput, now: Date): boolean {
  if (mandate.principalUserId !== input.userId || mandate.kind !== 'financial') return false
  if (!assessMandate(mandate, input.organizationId, now).effective) return false
  if (!mandate.powers.includes(actionPower(input.action))) return false
  const accounts = mandate.scope.accountIds ?? []
  const resources = mandate.scope.resourceIds ?? []
  if (input.accountId && !accounts.includes(input.accountId)) return false
  if (input.requiresLedger && !resources.includes(input.organizationId)) return false
  if (input.resourceId && !resources.includes(input.resourceId) && !resources.includes(input.organizationId)) return false
  if (input.employerId && !resources.includes(input.employerId) && !resources.includes(input.organizationId)) return false
  return true
}

export function decidePrincipalFinancialAuthority(
  input: PrincipalFinancialInput,
  mandates: readonly Mandate[],
  now: Date,
): { ok: true; grant: PrincipalFinancialGrant } | { ok: false; code: PrincipalFinancialDenial; message: string } {
  const power = actionPower(input.action)
  const covering = mandates.filter((mandate) => covers(mandate, input, now))
  if (covering.length === 0) {
    const canView = input.action !== 'finance:view' && mandates.some((mandate) => covers(mandate, { ...input, action: 'finance:view' }, now))
    if (canView) return { ok: false, code: 'DUTY_NOT_HELD', message: `The ${input.action} duty is not held for this record.` }
    if (input.resourceId) return { ok: false, code: 'NOT_FOUND', message: 'Record not found.' }
    return { ok: false, code: 'DUTY_NOT_HELD', message: `The ${input.action} duty is not held.` }
  }

  const holder = covering[0]
  const resources = holder.scope.resourceIds ?? []
  const ledgerWide = resources.includes(input.organizationId)
  const resourceIds = resources.filter((id) => id !== input.organizationId)
  const targeted = Boolean(input.accountId || input.resourceId || input.employerId || input.requiresLedger)
  if (!targeted && !ledgerWide && resourceIds.length === 0) {
    return { ok: false, code: 'DUTY_NOT_HELD', message: 'A financial mandate must name this record or the organization ledger.' }
  }

  if (SEGREGATED.has(power) && (input.participants ?? []).includes(input.userId)) {
    return { ok: false, code: 'SEGREGATION_OF_DUTIES', message: 'The caller already participated in this financial action.' }
  }
  if (SEGREGATED.has(power)) {
    const accounts = input.accountId ? [input.accountId] : [...(holder.scope.accountIds ?? [])]
    const conflict = dutyConflicts(mandates.filter((mandate) => mandate.principalUserId === input.userId)).find(
      (item) => accounts.includes(item.accountId) && (item.duties[0] === power || item.duties[1] === power),
    )
    if (conflict) {
      return { ok: false, code: 'SEGREGATION_OF_DUTIES', message: `The ${power} duty conflicts with ${conflict.duties[0] === power ? conflict.duties[1] : conflict.duties[0]} on the same account.` }
    }
  }

  return {
    ok: true,
    grant: {
      mandateId: holder.id,
      ledgerWide,
      resourceIds,
      accountIds: [...(holder.scope.accountIds ?? [])],
    },
  }
}

/** Organization count first. A count of zero is FINANCIAL_MANDATES_NOT_ISSUED and does not inspect the caller. */
export async function assertPrincipalFinancialAuthority(exec: SqlExecutor, input: PrincipalFinancialInput, now = new Date()): Promise<PrincipalFinancialGrant> {
  await assertLiveFinancialMandate(exec, input.organizationId)
  const mandates = await loadHolderMandates(exec, input.organizationId, input.userId)
  const decision = decidePrincipalFinancialAuthority(input, mandates, now)
  if (!decision.ok) throw new FinancialDutyError(decision.code, decision.message)
  return decision.grant
}

/** Ledger-wide mandates see the organization. Every other grant sees only the records it names. */
export function rowsVisibleToGrant(
  grant: PrincipalFinancialGrant,
  organizationId: string,
  organizationColumn: AnyColumn,
  idColumn: AnyColumn,
): SQL {
  const organization = eq(organizationColumn, organizationId)
  if (grant.ledgerWide) return organization
  return and(organization, inArray(idColumn, [...grant.resourceIds])) ?? organization
}
