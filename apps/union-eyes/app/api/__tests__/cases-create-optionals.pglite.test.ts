import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const mocks = vi.hoisted(() => ({
  scoped: vi.fn(), capacity: vi.fn().mockResolvedValue(undefined), audit: vi.fn().mockResolvedValue(undefined),
}));
// Isolate SQL serialization; authentication, capacity and audit enforcement have
// separate contracts. The real route statement executes in PostgreSQL here.
vi.mock('@/lib/api/framework', () => ({
  withApi: (_options: unknown, handler: unknown) => handler,
  ApiError: { badRequest: (message: string) => new Error(message) },
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: mocks.scoped }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: mocks.audit }));
vi.mock('@/lib/cases/case-authorization', () => ({
  requireCaseFilingCapacity: mocks.capacity, getCaseActor: vi.fn(), caseReadScope: vi.fn(), caseTriageQueueScope: vi.fn(),
}));
vi.mock('@/lib/cases/claim-identity', () => ({ claimIdentitySelect: vi.fn() }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/pilot-metrics', () => ({ recordUnionEyesCaseCreated: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
import { POST } from '../cases/route';

const org = '11111111-1111-4111-8111-111111111111';
let pg: PGlite;
let tx: { execute: (query: Parameters<ReturnType<typeof drizzle>['execute']>[0]) => Promise<unknown[]> };
beforeAll(async () => {
  pg = new PGlite();
  // Canonical exported column constraints/defaults, including the required amount.
  await pg.exec(`CREATE TABLE public.claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    claim_id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_number character varying(50),
    organization_id uuid NOT NULL,
    member_id text,
    is_anonymous boolean DEFAULT false NOT NULL,
    claim_type character varying(50),
    status character varying(30) DEFAULT 'submitted'::character varying NOT NULL,
    priority character varying(10) DEFAULT 'medium'::character varying NOT NULL,
    incident_date timestamp with time zone,
    location text,
    description text,
    desired_outcome text,
    witnesses_present boolean DEFAULT false NOT NULL,
    witness_details text,
    previously_reported boolean DEFAULT false NOT NULL,
    previous_report_details text,
    assigned_to character varying(255),
    assigned_at timestamp with time zone,
    ai_score integer,
    ai_analysis jsonb,
    merit_confidence integer,
    precedent_match integer,
    complexity_score integer,
    progress integer DEFAULT 0 NOT NULL,
    claim_amount character varying(20) DEFAULT '0'::character varying NOT NULL,
    settlement_amount character varying(20) DEFAULT '0'::character varying NOT NULL,
    legal_costs character varying(20) DEFAULT '0'::character varying NOT NULL,
    court_costs character varying(20) DEFAULT '0'::character varying NOT NULL,
    resolution_outcome character varying(100),
    filed_date timestamp with time zone,
    resolved_at timestamp with time zone,
    closed_at timestamp with time zone,
    attachments jsonb DEFAULT '[]'::jsonb,
    voice_transcriptions jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    idempotency_hash character varying(64),
    status_changed_at timestamp with time zone
);`);
  const db = drizzle(pg);
  tx = { execute: async query => (await db.execute(query)).rows };
});
afterAll(async () => { await pg?.close(); });
beforeEach(async () => {
  vi.clearAllMocks();
  await pg.exec('TRUNCATE claims');
  mocks.scoped.mockImplementation(async callback => callback(tx));
});

async function create(extra: Record<string, unknown>) {
  const handler = POST as unknown as (context: { request: Request; organizationId: string; userId: string }) => Promise<Response>;
  const response = await handler({
    request: new Request('http://localhost/api/cases', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claimType: 'other', description: 'Synthetic SQL serialization probe.', ...extra }) }),
    organizationId: org, userId: 'synthetic-owner',
  });
  expect(response.status).toBe(201);
  const created = await response.json();
  expect(mocks.capacity).toHaveBeenCalledWith(tx, { userId: 'synthetic-owner', organizationId: org }, 'handler');
  expect(mocks.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ resourceId: created.data.claimId, userId: 'synthetic-owner', organizationId: org }));
  return (await pg.query('SELECT location, desired_outcome, witness_details, claim_amount FROM claims WHERE claim_id=$1', [created.data.claimId])).rows[0];
}

describe('case creation optional SQL values', () => {
  it('binds omitted optional text fields as SQL NULL instead of empty SQL fragments', async () => {
    expect(await create({})).toEqual({ location: null, desired_outcome: null, witness_details: null, claim_amount: '0' });
  });
  it('maps an explicit null amount to the canonical zero default and retains supplied amounts', async () => {
    expect((await create({ claimAmount: null })).claim_amount).toBe('0');
    expect((await create({ claimAmount: '12.34' })).claim_amount).toBe('12.34');
  });
  it('retains explicit NULL and supplied text values', async () => {
    expect(await create({ location: null, desiredOutcome: 'Synthetic outcome', witnessDetails: 'Synthetic witness' }))
      .toEqual({ location: null, desired_outcome: 'Synthetic outcome', witness_details: 'Synthetic witness', claim_amount: '0' });
  });
});
