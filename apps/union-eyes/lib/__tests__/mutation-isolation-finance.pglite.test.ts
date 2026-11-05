// Mutation isolation (UE-CONV-K-006) for privileged finance workers and platform-economics services, against real
// PostgreSQL semantics (PGlite). The real code runs; only the connection plumbing and external notifiers are stood in
// for. A call made as ANOTHER organization must touch no row, the same-organization call must still work, and the
// platform-wide sweeps must bind every statement to the organization of the rows they selected.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const PARENT = '33333333-3333-4333-8333-333333333333';
const MEMBER = '44444444-4444-4444-8444-444444444444';
const RUN = '55555555-5555-4555-8555-555555555555';

const state = vi.hoisted(() => ({ db: null as unknown }));

const dbProxy = vi.hoisted(
  () =>
    new Proxy(
      {},
      {
        get: (_t, p) => {
          const d = state.db as Record<PropertyKey, unknown> | null;
          const v = d?.[p];
          return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(d) : v;
        },
      },
    ),
);

vi.mock('@/db', () => ({ db: dbProxy }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (work: (tx: unknown) => Promise<unknown>) =>
    (state.db as { transaction: (f: (t: unknown) => Promise<unknown>) => Promise<unknown> }).transaction((t) => work(t)),
  withRLSContext: async (...args: unknown[]) => {
    const work = args[args.length - 1] as (tx: unknown) => Promise<unknown>;
    return (state.db as { transaction: (f: (t: unknown) => Promise<unknown>) => Promise<unknown> }).transaction((t) => work(t));
  },
}));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: vi.fn(async () => undefined),
  AuditEventType: { DATA_CREATE: 'data_create', DATA_UPDATE: 'data_update' },
  AuditSeverity: { HIGH: 'high', MEDIUM: 'medium', CRITICAL: 'critical' },
}));
vi.mock('@/lib/services/dues-notifications', () => ({
  sendPaymentFailure: vi.fn(async () => undefined),
  sendAdminIntervention: vi.fn(async () => undefined),
  calculateRetryDate: vi.fn(() => new Date()),
}));

const { createDocumentDatabase, resetDocumentDatabase, ddl } = await import('@/lib/documents/test-support/pglite-document-database');
const schema = await import('@/db/schema');
const contracts = await import('@/services/platform-economics/contract-service');
const reconciliation = await import('@/services/platform-economics/reconciliation-service');
const { FailedPaymentRetryService } = await import('@/lib/jobs/failed-payment-retry');
const perCapita = await import('@/services/clc/per-capita-calculator');

let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
const rows = async (sql: string, params: unknown[] = []) => (await pg.query(sql, params)).rows as Array<Record<string, unknown>>;

beforeAll(async () => {
  pg = await createDocumentDatabase();
  for (const table of [
    schema.commercialContracts,
    schema.contractLineItems,
    schema.orgEntitlements,
    schema.reconciliationExceptions,
    schema.duesTransactions,
    schema.perCapitaRemittances,
  ]) {
    await pg.exec(ddl(table as never));
  }
  await pg.exec('CREATE UNIQUE INDEX org_entitlements_org_feature ON org_entitlements (organization_id, feature_key)');
  db = drizzle(pg, { schema });
  state.db = db;
});
afterAll(async () => {
  await pg.close();
});
beforeEach(async () => {
  await resetDocumentDatabase(pg);
  await pg.exec('TRUNCATE commercial_contracts, contract_line_items, org_entitlements, reconciliation_exceptions, dues_transactions, per_capita_remittances');
});

describe('platform-economics contracts', () => {
  async function draftContract(organizationId: string) {
    const [contract] = await db
      .insert(schema.commercialContracts)
      .values({
        organizationId,
        billingAccountId: PARENT,
        contractNumber: `C-${organizationId.slice(0, 4)}`,
        name: 'Platform agreement',
        status: 'draft',
        effectiveDate: new Date('2026-01-01T00:00:00Z'),
        expirationDate: new Date('2027-01-01T00:00:00Z'),
      } as never)
      .returning();
    await db.insert(schema.contractLineItems).values({ contractId: contract.id, lineType: 'feature', featureKey: 'ai_assist', description: 'AI', effectiveDate: new Date('2026-01-01T00:00:00Z') } as never);
    return contract.id as string;
  }

  it('activates and terminates only the acting organization contract', async () => {
    const id = await draftContract(ORG_A);

    await expect(contracts.activateContract(id, ORG_B, 'approver')).rejects.toThrow('not found or not in draft');
    expect((await rows('SELECT status FROM commercial_contracts WHERE id = $1', [id]))[0].status).toBe('draft');
    expect((await rows('SELECT count(*)::int AS n FROM org_entitlements'))[0].n).toBe(0);

    const activated = await contracts.activateContract(id, ORG_A, 'approver');
    expect(activated.contract.status).toBe('active');
    expect((await rows('SELECT organization_id FROM org_entitlements'))[0].organization_id).toBe(ORG_A);

    await expect(contracts.terminateContract(id, ORG_B, 'someone', 'forged')).rejects.toThrow('not found or not active');
    expect((await rows('SELECT status FROM commercial_contracts WHERE id = $1', [id]))[0].status).toBe('active');
    expect((await rows('SELECT status FROM org_entitlements'))[0].status).toBe('active');

    await contracts.terminateContract(id, ORG_A, 'someone', 'done');
    expect((await rows('SELECT status FROM commercial_contracts WHERE id = $1', [id]))[0].status).toBe('terminated');
    expect((await rows('SELECT status FROM org_entitlements'))[0].status).toBe('revoked');
  });

  it('resets expired usage periods one organization at a time without touching current periods', async () => {
    const longAgo = new Date(Date.now() - 400 * 86_400_000);
    await db.insert(schema.orgEntitlements).values([
      { organizationId: ORG_A, featureKey: 'f1', status: 'active', usagePeriod: 'monthly', usagePeriodStart: longAgo, currentUsage: 7, grantedAt: new Date() },
      { organizationId: ORG_B, featureKey: 'f1', status: 'active', usagePeriod: 'monthly', usagePeriodStart: longAgo, currentUsage: 3, grantedAt: new Date() },
      { organizationId: ORG_B, featureKey: 'f2', status: 'active', usagePeriod: 'monthly', usagePeriodStart: new Date(), currentUsage: 9, grantedAt: new Date() },
    ] as never);

    expect(await contracts.resetExpiredUsagePeriods()).toBe(2);

    const usage = await rows('SELECT organization_id, feature_key, current_usage FROM org_entitlements ORDER BY organization_id, feature_key');
    expect(usage.map((r) => [r.organization_id, r.feature_key, r.current_usage])).toEqual([
      [ORG_A, 'f1', 0],
      [ORG_B, 'f1', 0],
      [ORG_B, 'f2', 9],
    ]);
  });
});

describe('platform-economics reconciliation exceptions', () => {
  it('resolves an exception for its organization and never for another', async () => {
    const [exception] = await db
      .insert(schema.reconciliationExceptions)
      .values({ runId: RUN, organizationId: ORG_A, exceptionType: 'amount_discrepancy', status: 'open', sourceType: 'invoice', sourceId: RUN, description: 'x' } as never)
      .returning();

    await expect(
      reconciliation.resolveException(exception.id, ORG_B, { status: 'written_off', resolvedBy: 'admin-b', notes: 'forged' }),
    ).rejects.toThrow('not found or already resolved');
    expect((await rows('SELECT exception_status, resolved_by FROM reconciliation_exceptions WHERE id = $1', [exception.id]))[0]).toMatchObject({ exception_status: 'open', resolved_by: null });

    const resolved = await reconciliation.resolveException(exception.id, ORG_A, { status: 'resolved', resolvedBy: 'admin-a', notes: 'matched' });
    expect(resolved.status).toBe('resolved');
  });
});

describe('failed payment retry worker', () => {
  async function failedTransaction(organizationId: string) {
    const [txn] = await db
      .insert(schema.duesTransactions)
      .values({
        organizationId,
        memberId: MEMBER,
        transactionType: 'dues',
        amount: '50.00',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        dueDate: '2026-01-15',
        status: 'pending',
        duesAmount: '50.00',
        totalAmount: '50.00',
        metadata: { failureCount: 4 },
      } as never)
      .returning();
    return txn.id as string;
  }

  it('marks a transaction for admin intervention only inside its own organization', async () => {
    const id = await failedTransaction(ORG_A);
    const mark = (FailedPaymentRetryService as unknown as { markForAdminIntervention: (id: string, org: string, failures: number) => Promise<void> }).markForAdminIntervention;

    await mark.call(FailedPaymentRetryService, id, ORG_B, 4);
    expect((await rows('SELECT status, metadata FROM dues_transactions WHERE id = $1', [id]))[0]).toMatchObject({ status: 'pending', metadata: { failureCount: 4 } });

    await mark.call(FailedPaymentRetryService, id, ORG_A, 4);
    const [row] = await rows('SELECT status, metadata FROM dues_transactions WHERE id = $1', [id]);
    expect(row.status).toBe('overdue');
    expect(row.metadata).toMatchObject({ requiresAdminIntervention: true });
  });

  it('the scheduled run marks each organization transaction through its own organization', async () => {
    const a = await failedTransaction(ORG_A);
    const b = await failedTransaction(ORG_B);

    await FailedPaymentRetryService.runRetryJob();

    const statuses = await rows('SELECT id, status FROM dues_transactions');
    expect(statuses.find((r) => r.id === a)?.status).toBe('overdue');
    expect(statuses.find((r) => r.id === b)?.status).toBe('overdue');
  });
});

describe('monthly per-capita overdue sweep', () => {
  async function remittance(organizationId: string, status: string, dueDate: string) {
    const [row] = await db
      .insert(schema.perCapitaRemittances)
      .values({
        organizationId,
        fromOrganizationId: organizationId,
        toOrganizationId: PARENT,
        remittanceMonth: 1,
        remittanceYear: 2026,
        dueDate,
        totalMembers: 10,
        goodStandingMembers: 9,
        remittableMembers: 9,
        perCapitaRate: '2.00',
        totalAmount: '18.00',
        status,
      } as never)
      .returning();
    return row.id as string;
  }

  it('marks pending past-due remittances overdue per organization and audits each organization separately', async () => {
    const a = await remittance(ORG_A, 'pending', '2026-01-10');
    const b = await remittance(ORG_B, 'pending', '2026-01-10');
    const paid = await remittance(ORG_B, 'paid', '2026-01-10');
    const notDue = await remittance(ORG_A, 'pending', '2099-01-01');

    expect(await perCapita.markOverdueRemittances()).toBe(2);

    const statuses = Object.fromEntries((await rows('SELECT id, status FROM per_capita_remittances')).map((r) => [r.id as string, r.status]));
    expect(statuses[a]).toBe('overdue');
    expect(statuses[b]).toBe('overdue');
    expect(statuses[paid]).toBe('paid');
    expect(statuses[notDue]).toBe('pending');

    const audits = await rows("SELECT organization_id FROM audit_security.audit_logs WHERE action = 'per_capita.remittance.mark_overdue' ORDER BY organization_id");
    expect(audits.map((r) => r.organization_id)).toEqual([ORG_A, ORG_B]);
  });
});
