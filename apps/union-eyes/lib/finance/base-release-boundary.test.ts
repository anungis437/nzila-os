/** Component proof of unconditional excluded-service denial before I/O.
 * No authentication verdict is mocked or qualified here; real canonical
 * session/LOGIN/HTTP proofs live in finance-*.postgres.test.ts. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
const effects = vi.hoisted(() => ({ attempted: [] as string[] }))
vi.mock('@/db', () => ({
  db: new Proxy(
    {},
    {
      get(_target, property) {
        return () => {
          effects.attempted.push(`db.${String(property)}`)
          throw new Error('Excluded database I/O reached')
        }
      },
    },
  ),
}))
vi.mock('@/db/db', async () => ({ db: (await import('@/db')).db }))
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: () => {
    effects.attempted.push('business.audit')
    throw new Error('Excluded audit reached')
  },
}))
vi.mock('@/lib/audit-logger', () => ({
  auditLog: () => {
    effects.attempted.push('security.audit')
    throw new Error('Unexpected audit reached')
  },
  AuditEventType: new Proxy({}, { get: (_target, key) => String(key) }),
  AuditSeverity: new Proxy({}, { get: (_target, key) => String(key) }),
}))
import { BaseFinancialCapabilityUnavailable } from './base-release-boundary'
import * as duties from '../authority/store/finance-route-adapter'
import { recordArrearsPayment } from '../dues/arrears-payment'
import * as outputs from '../../services/platform-economics/finance-outputs'
import type { RLSTx } from '../db/with-rls-context'
import type { SqlExecutor } from '../authority/store/executor'
import type { AuthorityRequest } from '../authority/ontology'
import {
  loadFinancialTransaction,
  createCanonicalResourceLoader,
} from '../authority/store/resources'
import { recordFinancialStep } from '../authority/store/workflow'
const id = '11111111-1111-4111-8111-111111111111'
const tx = {
  execute: () => {
    effects.attempted.push('tx.execute')
    throw new Error('Excluded transaction I/O reached')
  },
} as unknown as RLSTx
const exec = {
  query: () => {
    effects.attempted.push('executor.query')
    throw new Error('Excluded executor I/O reached')
  },
} as unknown as SqlExecutor
const input = {
  userId: 'synthetic-caller',
  organizationId: id,
  transactionId: id,
  action: 'finance:view' as const,
}
const financialRequest: AuthorityRequest = {
  principalUserId: input.userId,
  organizationId: id,
  action: 'finance:view',
  resource: { type: 'financial_transaction', id, organizationId: id },
}
const entries: Array<[string, () => unknown]> = [
  ['decideFinancialAction', () => duties.decideFinancialAction(tx, input)],
  ['decideFinancialActionOn', () => duties.decideFinancialActionOn(exec, input)],
  ['assertLiveFinancialMandate', () => duties.assertLiveFinancialMandate(exec, id)],
  ['requireFinancialDuty', () => duties.requireFinancialDuty(tx, input)],
  ['requireFinancialDutyOn', () => duties.requireFinancialDutyOn(exec, input)],
  [
    'performFinancialDuty',
    () =>
      duties.performFinancialDuty(
        tx,
        { ...input, step: 'registered', accountId: id, requiredApprovals: 1 },
        async () => {
          effects.attempted.push('financial.business.callback')
          return {
            result: null,
            audit: { action: 'must.not.run', resourceType: 'payments', resourceId: id },
          }
        },
      ),
  ],
  ['readFinancialTransaction', () => duties.readFinancialTransaction(tx, input)],
  [
    'recordArrearsPayment',
    () =>
      recordArrearsPayment(tx, {
        userId: input.userId,
        organizationId: id,
        memberId: input.userId,
        paymentId: id,
        amount: 10,
      }),
  ],
  ['exportMasterInvoice', () => outputs.exportMasterInvoice(id, id)],
  ['exportAllocationStatement', () => outputs.exportAllocationStatement(id, id)],
  ['exportChargebackReport', () => outputs.exportChargebackReport(id, id)],
  ['exportGlJournal', () => outputs.exportGlJournal(id, id)],
  ['generateEvidencePack', () => outputs.generateEvidencePack(id, id)],
  ['loadFinancialTransaction', () => loadFinancialTransaction(exec, financialRequest)],
  [
    'canonical financial resource dispatch',
    () => createCanonicalResourceLoader()(exec, financialRequest, new Date('2026-11-18T00:00:00Z')),
  ],
  [
    'recordFinancialStep',
    () =>
      recordFinancialStep(
        exec,
        { memberships: async () => [] },
        {
          organizationId: id,
          actorUserId: input.userId,
          paymentId: id,
          step: 'registered',
          accountId: id,
          requiredApprovals: 1,
        },
      ),
  ],
]
beforeEach(() => {
  effects.attempted = []
})
describe('excluded financial service boundaries', () => {
  it.each(entries)(
    '%s refuses before any database/audit/provider callback',
    async (_name, operation) => {
      const error = await Promise.resolve()
        .then(operation)
        .then(
          () => null,
          (error: unknown) => error,
        )
      expect(error).toBeInstanceOf(BaseFinancialCapabilityUnavailable)
      expect(error).toMatchObject({ code: 'NOT_IMPLEMENTED', status: 501 })
      expect(effects.attempted).toEqual([])
    },
  )
  it('keeps existing pure invalid-input floors before financial unavailability', async () => {
    await expect(
      loadFinancialTransaction(exec, {
        ...financialRequest,
        resource: { ...financialRequest.resource, id: 'not-a-uuid' },
      }),
    ).resolves.toBeNull()
    for (const change of [{ organizationId: 'not-a-uuid' }, { actorUserId: ' ' }])
      await expect(
        recordFinancialStep(
          exec,
          { memberships: async () => [] },
          {
            organizationId: id,
            actorUserId: input.userId,
            paymentId: id,
            step: 'registered',
            ...change,
          },
        ),
      ).rejects.toMatchObject({ name: 'AuthorityStoreError', code: 'INVALID_CONTEXT' })
    expect(effects.attempted).toEqual([])
  })
  it('preserves the nonfinancial message-retention resource branch', async () => {
    const req: AuthorityRequest = {
      principalUserId: input.userId,
      organizationId: id,
      action: 'message:read_retention_policy',
      resource: { type: 'message_retention', id, organizationId: id },
    }
    await expect(
      createCanonicalResourceLoader()(exec, req, new Date('2026-11-18T00:00:00Z')),
    ).resolves.toEqual({ resource: { kind: 'message_retention', id, organizationId: id } })
    expect(effects.attempted).toEqual([])
  })
})
