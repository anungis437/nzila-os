import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { organizations } from '@/db/schema-organizations';
import { congressMemberships } from '@/db/schema';
import { arbitrationPrecedents } from '@/db/schema/arbitration-precedents-schema';
import { createTableDatabase } from './support/pglite-tables';

// DEF-0B11-PRP-PRECEDENT-ITEM-ROUTE-ORGANIZATION-SCOPE-IS-A-NO-OP-ON-A-TABLE-KEYED-BY-SOURCE-ORGANIZATION:
// the generic route filtered on a column the table does not have, so any precedent was readable, writable and
// deletable by id. These tests run the real route against real SQL and two organizations.

const state = vi.hoisted(() => ({ db: null as unknown, audit: null as unknown }));

vi.mock('@/db/db', async () => {
  const { lateBoundDb } = await import('./support/pglite-tables');
  return { db: lateBoundDb(state) };
});
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(state.db),
  withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) => fn(state.db),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: (...a: unknown[]) => (state.audit as (...x: unknown[]) => unknown)(...a) }));
vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  const make = (status: number) => (msg: string) => Object.assign(new Error(msg), { status });
  return {
    z,
    withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => (c: unknown) => handler(c),
    ApiError: {
      badRequest: make(400),
      forbidden: make(403),
      notFound: (kind: string) => Object.assign(new Error(`${kind} not found`), { status: 404 }),
    },
  };
});

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const P_A_PRIVATE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const P_A_PUBLIC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const P_A_GRANTED = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const P_B_PRIVATE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';

let pg: PGlite;
const audit = vi.fn(async () => undefined);

async function insertOrg(id: string, name: string) {
  await pg.query(
    `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path) VALUES ($1, $2, $3, 'local', ARRAY[]::uuid[])`,
    [id, name, name.toLowerCase()],
  );
}

async function insertPrecedent(id: string, org: string, sharing: string, extra: { grants?: string[]; anonymized?: boolean } = {}) {
  await pg.query(
    `INSERT INTO arbitration_precedents
       (id, source_organization_id, case_number, case_title, decision_date, arbitrator_name, jurisdiction, grievance_type,
        issue_summary, outcome, decision_summary, sharing_level, shared_with_org_ids, created_by, union_name, employer_name,
        is_parties_anonymized, document_url, document_path, has_redacted_version, redacted_document_url)
     VALUES ($1::uuid, $2, 'C-' || $1::text, 'title', '2026-01-01', 'Arb', 'ON', 'discipline', 'issue', 'upheld', 'summary', $3, $4,
        'owner-user', 'Local 1', 'Acme Ltd', $5, 'https://store/private.pdf', '/private/path.pdf', true, 'https://store/redacted.pdf')`,
    [id, org, sharing, extra.grants ?? null, extra.anonymized ?? false],
  );
}

async function row(id: string) {
  return (await pg.query<{ case_title: string; source_organization_id: string; sharing_level: string }>(
    'SELECT case_title, source_organization_id, sharing_level FROM arbitration_precedents WHERE id = $1', [id])).rows[0];
}

const ctx = (organizationId: string, id: string, body?: unknown) => ({
  organizationId,
  userId: 'user-1',
  params: { id },
  request: { json: async () => body },
});

beforeAll(async () => {
  const created = await createTableDatabase([organizations, congressMemberships, arbitrationPrecedents]);
  pg = created.pg;
  state.db = created.db;
  state.audit = audit;
});

afterAll(async () => { await pg.close(); });

beforeEach(async () => {
  audit.mockClear();
  audit.mockResolvedValue(undefined);
  await pg.exec('TRUNCATE arbitration_precedents, congress_memberships, organizations CASCADE');
  await insertOrg(ORG_A, 'Alpha');
  await insertOrg(ORG_B, 'Bravo');
  await insertPrecedent(P_A_PRIVATE, ORG_A, 'private');
  await insertPrecedent(P_A_PUBLIC, ORG_A, 'public', { anonymized: true });
  await insertPrecedent(P_A_GRANTED, ORG_A, 'private', { grants: [ORG_B] });
  await insertPrecedent(P_B_PRIVATE, ORG_B, 'private');
});

describe('GET /api/precedents/[id]', () => {
  it('returns the owner the full row', async () => {
    const { GET } = await import('../precedents/[id]/route');
    const result = (await (GET as any)(ctx(ORG_A, P_A_PRIVATE))) as { data: Record<string, unknown> };
    expect(result.data).toMatchObject({ id: P_A_PRIVATE, isOwner: true, createdBy: 'owner-user', documentUrl: 'https://store/private.pdf' });
  });

  it('reads another organization\'s private precedent as not found', async () => {
    const { GET } = await import('../precedents/[id]/route');
    await expect((GET as any)(ctx(ORG_B, P_A_PRIVATE))).rejects.toMatchObject({ status: 404 });
  });

  it('shows a reader a public precedent without the owner document location, author or grant list, and hides anonymized parties', async () => {
    const { GET } = await import('../precedents/[id]/route');
    const { data } = (await (GET as any)(ctx(ORG_B, P_A_PUBLIC))) as { data: Record<string, unknown> };
    expect(data).toMatchObject({ isOwner: false, unionName: null, employerName: null, redactedDocumentUrl: 'https://store/redacted.pdf' });
    for (const key of ['documentUrl', 'documentPath', 'createdBy', 'sharedWithOrgIds']) expect(data).not.toHaveProperty(key);
  });

  it('shows a private precedent only to an organization the owner named', async () => {
    const { GET } = await import('../precedents/[id]/route');
    await expect((GET as any)(ctx(ORG_B, P_A_GRANTED))).resolves.toMatchObject({ data: { id: P_A_GRANTED, isOwner: false } });
  });

  it('rejects a malformed identifier and a call with no organization', async () => {
    const { GET } = await import('../precedents/[id]/route');
    await expect((GET as any)(ctx(ORG_A, 'nope'))).rejects.toMatchObject({ status: 400 });
    await expect((GET as any)({ ...ctx(ORG_A, P_A_PRIVATE), organizationId: null })).rejects.toMatchObject({ status: 400 });
  });
});

describe('PATCH /api/precedents/[id]', () => {
  it('lets the owner edit an allow-listed field and audits it', async () => {
    const { PATCH } = await import('../precedents/[id]/route');
    await (PATCH as any)(ctx(ORG_A, P_A_PRIVATE, { caseTitle: 'renamed' }));
    expect((await row(P_A_PRIVATE)).case_title).toBe('renamed');
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'precedent.update', resourceId: P_A_PRIVATE, details: { fields: ['caseTitle'] } }));
  });

  it('cannot modify another organization\'s precedent, whatever its sharing level', async () => {
    const { PATCH } = await import('../precedents/[id]/route');
    for (const id of [P_A_PRIVATE, P_A_PUBLIC, P_A_GRANTED]) {
      await expect((PATCH as any)(ctx(ORG_B, id, { caseTitle: 'hijacked' }))).rejects.toMatchObject({ status: 404 });
      expect((await row(id)).case_title).toBe('title');
    }
    expect(audit).not.toHaveBeenCalled();
  });

  it('refuses to change ownership, counters or audit columns', async () => {
    const { PATCH } = await import('../precedents/[id]/route');
    for (const body of [{ sourceOrganizationId: ORG_B }, { createdBy: 'x' }, { citationCount: 99 }, { id: P_B_PRIVATE }]) {
      await expect((PATCH as any)(ctx(ORG_A, P_A_PRIVATE, body))).rejects.toMatchObject({ status: 400 });
    }
    expect((await row(P_A_PRIVATE)).source_organization_id).toBe(ORG_A);
  });

  it('refuses an empty update and keeps the row when the audit cannot be written', async () => {
    const { PATCH } = await import('../precedents/[id]/route');
    await expect((PATCH as any)(ctx(ORG_A, P_A_PRIVATE, {}))).rejects.toMatchObject({ status: 400 });
    audit.mockRejectedValue(new Error('audit down'));
    await expect((PATCH as any)(ctx(ORG_A, P_A_PRIVATE, { caseTitle: 'x' }))).rejects.toThrow('audit down');
  });

  it('refuses a federation share the owner has no standing for', async () => {
    const { PATCH } = await import('../precedents/[id]/route');
    await expect((PATCH as any)(ctx(ORG_A, P_A_PRIVATE, { sharingLevel: 'federation' }))).rejects.toMatchObject({ status: 403 });
    expect((await row(P_A_PRIVATE)).sharing_level).toBe('private');
  });
});

describe('DELETE /api/precedents/[id]', () => {
  it('deletes an owned precedent and audits it', async () => {
    const { DELETE } = await import('../precedents/[id]/route');
    await expect((DELETE as any)(ctx(ORG_A, P_A_PRIVATE))).resolves.toEqual({ success: true });
    expect(await row(P_A_PRIVATE)).toBeUndefined();
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'precedent.delete', resourceId: P_A_PRIVATE }));
  });

  it('cannot delete another organization\'s precedent, shared or not', async () => {
    const { DELETE } = await import('../precedents/[id]/route');
    for (const id of [P_A_PRIVATE, P_A_PUBLIC, P_A_GRANTED]) {
      await expect((DELETE as any)(ctx(ORG_B, id))).rejects.toMatchObject({ status: 404 });
      expect(await row(id)).toBeDefined();
    }
  });
});
