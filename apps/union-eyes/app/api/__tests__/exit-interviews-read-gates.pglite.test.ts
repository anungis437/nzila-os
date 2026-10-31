import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';

// DEF-0B7-EXC-READS-IGNORE-SENSITIVITY-LEVEL and the knowledge-base half of DEF-0B7-EXC-PUBLISH-AND-INDEX-COPY…:
// the interview list, item, documents and the knowledge-base copy returned an interview to any member whatever its
// sensitivity level or consent. The real routes run against real SQL with interviews at every level.

const state = vi.hoisted(() => ({
  db: null as unknown,
  userId: 'u-member',
  role: 'member' as 'member' | 'steward' | 'officer' | 'admin',
}));

const RANK: Record<string, number> = { member: 1, steward: 2, officer: 3, admin: 4 };

vi.mock('@/db/db', async () => {
  const { lateBoundDb } = await import('./support/pglite-tables');
  return { db: lateBoundDb(state) };
});
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (...a: unknown[]) => (a[a.length - 1] as (tx: unknown) => Promise<unknown>)(state.db),
  withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) => fn(state.db),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async () => undefined) }));
vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  const make = (status: number) => (message: string) => Object.assign(new Error(message), { status });
  return {
    z,
    withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => (c: unknown) => handler(c),
    ApiError: { notFound: make(404), forbidden: make(403), badRequest: make(400), conflict: make(409) },
  };
});
vi.mock('@/lib/api-auth-guard', () => ({
  ROLE_HIERARCHY: { member: 1, steward: 2, officer: 3, admin: 4 },
  normalizeRole: (r: string) => r,
  hasMinRole: async (min: string) => RANK[state.role] >= RANK[min],
  withApiAuth: (handler: unknown) => handler,
  getCurrentUser: async () => ({ id: state.userId, organizationId: ORG }),
}));

const ORG = '11111111-1111-4111-8111-111111111111';
const CHILD = '22222222-2222-4222-8222-222222222222';
let pg: PGlite;

const id = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;

async function interview(n: number, over: { status?: string; level?: string | null; consent?: boolean | null; createdBy?: string } = {}) {
  await pg.query(
    `INSERT INTO exit_interviews (id, organization_id, retiring_employee_name, role_in_union, years_of_service, title, key_lessons, status,
       sensitivity_level, consent_granted, created_by, summary, retirement_reason, continuity_risk_score)
     VALUES ($1::uuid, $2::uuid, 'Jane Retiree', 'steward', 20, $3, 'Lessons learned here', $4, $5, $6, $7, 'AI summary', 'health', 80)`,
    [id(n), ORG, `Interview ${n}`, over.status ?? 'published', over.level === undefined ? 'public_internal' : over.level, over.consent === undefined ? true : over.consent, over.createdBy ?? 'author-1'],
  );
}

const call = <T extends (...a: never[]) => unknown>(fn: T, ctx: Record<string, unknown>) => (fn as unknown as (c: unknown) => Promise<{ data: unknown }>)(ctx);

beforeAll(async () => {
  const { exitInterviews, exitInterviewEvents, exitInterviewDocuments } = await import('@/db/schema');
  const { createTableDatabase } = await import('./support/pglite-tables');
  const created = await createTableDatabase([exitInterviews, exitInterviewEvents, exitInterviewDocuments], [
    `CREATE TABLE knowledge_base (id uuid primary key default gen_random_uuid(), organization_id uuid not null, title text not null,
       document_type text not null default 'guide', content text not null, summary text, source_type text not null, source_id text,
       source_url text, tags jsonb, language text not null default 'en', effective_date timestamp, version int not null default 1,
       is_public boolean not null default false, view_count int not null default 0, is_active boolean not null default true,
       created_at timestamp default now(), updated_at timestamp default now())`,
    `CREATE TABLE organizations (id uuid primary key, parent_id uuid)`,
  ]);
  pg = created.pg;
  state.db = created.db;
});

afterAll(async () => { await pg.close(); });

beforeEach(async () => {
  state.userId = 'u-member';
  state.role = 'member';
  await pg.exec('TRUNCATE exit_interviews, exit_interview_events, exit_interview_documents, knowledge_base, organizations CASCADE');
  await pg.query(`INSERT INTO organizations (id, parent_id) VALUES ($1::uuid, NULL), ($2::uuid, $1::uuid)`, [ORG, CHILD]);
  await interview(1, { level: 'public_internal' });
  await interview(2, { level: 'restricted' });
  await interview(3, { level: 'privileged' });
  await interview(4, { level: 'legal_sensitive' });
  await interview(5, { level: 'executive_confidential' });
  await interview(6, { level: 'public_internal', consent: false });
  await interview(7, { level: null });
  await interview(8, { level: 'public_internal', status: 'draft', createdBy: 'author-1' });
  await interview(9, { level: 'privileged', status: 'draft', createdBy: 'u-member' });
});

const listIds = async (role: typeof state.role, userId = 'u-member') => {
  state.role = role;
  state.userId = userId;
  const { GET } = await import('../exit-interviews/route');
  const result = (await call(GET, { organizationId: ORG, userId, user: { role }, query: {} })) as { data: Array<{ id: string }> };
  return result.data.map((r) => r.id).sort();
};

describe('exit interview list', () => {
  it('a member sees only published, consented, public-internal interviews, plus their own drafts', async () => {
    expect(await listIds('member')).toEqual([id(1), id(9)].sort());
  });

  it('a steward sees public-internal and restricted rows (and unrecorded), never privileged or above', async () => {
    const ids = await listIds('steward', 'u-steward');
    expect(ids).toEqual(expect.arrayContaining([id(1), id(2), id(6), id(7), id(8)]));
    for (const forbidden of [3, 4, 5, 9]) expect(ids).not.toContain(id(forbidden));
  });

  it('an officer reads privileged; legal-sensitive and executive-confidential need an administrator', async () => {
    const officer = await listIds('officer', 'u-officer');
    expect(officer).toContain(id(3));
    expect(officer).not.toContain(id(4));
    expect(officer).not.toContain(id(5));
    const admin = await listIds('admin', 'u-admin');
    for (const n of [3, 4, 5]) expect(admin).toContain(id(n));
  });

  it('a member receives the content, not the retiring employee, the retirement reason, the AI risk score or the user ids', async () => {
    state.role = 'member';
    const { GET } = await import('../exit-interviews/route');
    const { data } = (await call(GET, { organizationId: ORG, userId: 'u-member', user: { role: 'member' }, query: {} })) as { data: Array<Record<string, unknown>> };
    const row = data.find((r) => r.id === id(1))!;
    expect(row).toMatchObject({ title: 'Interview 1', keyLessons: 'Lessons learned here' });
    for (const key of ['retiringEmployeeName', 'retirementReason', 'continuityRiskScore', 'createdBy', 'updatedBy', 'reviewedBy']) expect(row).not.toHaveProperty(key);
  });
});

describe('exit interview item and attachments', () => {
  const item = async (n: number, role: typeof state.role, userId = 'u-member') => {
    state.role = role;
    state.userId = userId;
    const { GET } = await import('../exit-interviews/[id]/route');
    return call(GET, { params: { id: id(n) }, organizationId: ORG, userId, user: { role } });
  };

  it('refuses, as not found, an interview above the caller\'s level or without consent', async () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8]) await expect(item(n, 'member'), `interview ${n}`).rejects.toMatchObject({ status: 404 });
    for (const n of [3, 4, 5]) await expect(item(n, 'steward', 'u-steward'), `steward ${n}`).rejects.toMatchObject({ status: 404 });
    await expect(item(4, 'officer', 'u-officer')).rejects.toMatchObject({ status: 404 });
    await expect(item(4, 'admin', 'u-admin')).resolves.toMatchObject({ data: { id: id(4) } });
  });

  it('gives a member the public-internal interview without the workflow events', async () => {
    await pg.query(`INSERT INTO exit_interview_events (interview_id, organization_id, event_type, actor_user_id) VALUES ($1::uuid, $2::uuid, 'published', 'admin-1')`, [id(1), ORG]);
    const { data } = (await item(1, 'member')) as { data: Record<string, unknown> };
    expect(data).toMatchObject({ id: id(1) });
    expect(data.events).toEqual([]);
    expect(data).not.toHaveProperty('retiringEmployeeName');
  });

  it('keeps the attachments, transcripts and file locations of a restricted interview from a member', async () => {
    await pg.query(`INSERT INTO exit_interview_documents (interview_id, organization_id, title, file_url, mime_type, transcript_text, created_by) VALUES ($1::uuid, $2::uuid, 'Tape', 'https://nzilacanadastore.blob.core.windows.net/x.pdf', 'application/pdf', 'secret transcript', 'author-1')`, [id(2), ORG]);
    const { GET } = await import('../exit-interviews/[id]/documents/route');
    state.role = 'member';
    await expect(call(GET, { params: { id: id(2) }, organizationId: ORG, userId: 'u-member', user: { role: 'member' } })).rejects.toMatchObject({ status: 404 });
    state.role = 'steward';
    const ok = (await call(GET, { params: { id: id(2) }, organizationId: ORG, userId: 'u-steward', user: { role: 'steward' } })) as { data: Array<{ transcriptText: string }> };
    expect(ok.data[0].transcriptText).toBe('secret transcript');
  });
});

describe('knowledge base copy of an interview', () => {
  const kb = (title: string, sourceType: string, sourceId: string | null, org = ORG) =>
    pg.query(`INSERT INTO knowledge_base (organization_id, title, content, source_type, source_id) VALUES ($1::uuid, $2, 'body', $3, $4)`, [org, title, sourceType, sourceId]);

  const titles = async (role: typeof state.role, org = ORG) => {
    state.role = role;
    const { GET } = await import('../knowledge-base/route');
    const response = await (GET as unknown as (r: NextRequest, c: unknown) => Promise<Response>)(new NextRequest('http://localhost/api/knowledge-base'), {});
    return ((await response.json()).data as Array<{ title: string }>).map((r) => r.title).sort();
  };

  beforeEach(async () => {
    await kb('Public interview copy', 'exit_interview', id(1));
    await kb('Restricted interview copy', 'exit_interview', id(2));
    await kb('Privileged interview copy', 'exit_interview', id(3));
    await kb('No-consent interview copy', 'exit_interview', id(6));
    await kb('Orphan interview copy', 'exit_interview', id(99));
    await kb('Policy', 'policy', null);
    await kb('Parent organization interview', 'exit_interview', id(1), CHILD);
  });

  it('a member receives the copy of a public-internal consented interview and ordinary documents, nothing else', async () => {
    expect(await titles('member')).toEqual(['Policy', 'Public interview copy']);
  });

  it('the copy follows the interview\'s level: a steward gains restricted, an officer privileged', async () => {
    expect(await titles('steward')).toEqual(['No-consent interview copy', 'Policy', 'Public interview copy', 'Restricted interview copy'].filter((t) => t !== 'No-consent interview copy').sort());
    expect(await titles('officer')).toContain('Privileged interview copy');
    expect(await titles('officer')).not.toContain('No-consent interview copy');
  });

  it('an interview copy never reaches an organization through the parent link', async () => {
    state.role = 'admin';
    expect(await titles('admin')).not.toContain('Parent organization interview');
  });
});
