import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

// The route modules below are the real ones: the list is GET /api/precedents (the real handler and the real precedent service), the item is
// the crud factory's item route run through the real withApi. Only the identity, the database and the audit are stood in for. The tests
// read what those routes answer with, not a body written by hand.
const state = vi.hoisted(() => ({
  decisions: [] as Record<string, unknown>[],
  /** The where clause of the last list read, so a test can see which filters reached SQL. */
  listClause: undefined as unknown,
}));

vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>();
  return {
    ...actual,
    getCurrentUser: vi.fn(async () => ({ id: 'user-1', email: 'member@example.test', role: 'member', organizationId: 'org-1' })),
    // The deprecated role wrapper is passed through: the route's own handler is what these tests read.
    withRoleAuth: (_role: string, handler: (request: import('next/server').NextRequest, context: Record<string, unknown>) => Promise<Response>) =>
      (request: import('next/server').NextRequest, context: Record<string, unknown> = {}) => handler(request, context),
  };
});
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  createRateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: vi.fn(async () => undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: vi.fn(async () => 'org-1'),
  getUserRoleInOrganization: vi.fn(async () => 'member'),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (_context: unknown, operation: (tx: unknown) => Promise<unknown>) => operation({}),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }));
vi.mock('@/db/db', async () => {
  const { PgDialect: Dialect } = await import('drizzle-orm/pg-core');
  const dialect = new Dialect();
  return {
    db: {
      select: (selection?: unknown) => {
        // A count query selects an aggregate; a list read ends in offset(); an item read is awaited right after its where clause,
        // which names the id it wants.
        const counting = selection !== undefined;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = (clause: unknown) => {
          chain.clause = clause;
          return chain;
        };
        chain.orderBy = () => chain;
        chain.limit = () => chain;
        chain.offset = () => {
          state.listClause = chain.clause;
          return Promise.resolve(state.decisions);
        };
        chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
          const params = chain.clause ? dialect.sqlToQuery(chain.clause as SQL).params : [];
          // The crud factory counts as `total`, the precedent service as `count`.
          const result = counting
            ? [{ total: state.decisions.length, count: state.decisions.length }]
            : state.decisions.filter((decision) => params.includes(decision.id));
          return Promise.resolve(result).then(resolve, reject);
        };
        return chain;
      },
    },
  };
});

import { GET as listPrecedents } from '@/app/api/precedents/route';
import { GET as getPrecedent } from '@/app/api/arbitration/precedents/[id]/route';
import { NO_FILTERS, listParams } from '../precedent-filters';
import { readPrecedent, readPrecedentList, recordedCount, toPrecedentRecord } from '../precedent-record';

const dialect = new PgDialect();

const decision = (overrides: Record<string, unknown> = {}) => ({
  id: 'd-1',
  caseNumber: 'ABC-2021-001',
  caseTitle: 'Union v. First Employer',
  tribunal: 'private_arbitrator',
  decisionType: 'grievance',
  decisionDate: '2021-03-04T12:00:00.000Z',
  arbitrator: 'Jane Arbitrator',
  grievor: 'A. Worker',
  union: 'Local 100',
  employer: 'Acme Ltd.',
  outcome: 'grievance_upheld',
  remedy: { monetaryAward: 5000 },
  keyFindings: ['Discharge without cause was not made out', 'Reinstatement with back pay'],
  issueTypes: ['discharge', 'just_cause'],
  precedentValue: 'high',
  fullText: 'The full text of the award.',
  summary: 'The grievance was upheld.',
  reasoning: 'The employer did not meet its onus.',
  jurisdiction: 'ON',
  viewCount: 3,
  citationCount: 1,
  isPublic: true,
  accessRestrictions: null,
  createdAt: '2021-03-05T15:30:00.000Z',
  updatedAt: '2021-03-06T15:30:00.000Z',
  ...overrides,
});

async function body(response: Response): Promise<unknown> {
  expect(response.status).toBe(200);
  return response.json();
}

const itemResponse = (id: string) =>
  getPrecedent(new NextRequest(`http://localhost/api/arbitration/precedents/${id}`), { params: Promise.resolve({ id }) });
const listResponse = (query = 'page=1&limit=20') => listPrecedents(new NextRequest(`http://localhost/api/precedents?${query}`), {});

/** The values the last list read put in its SQL, as the database would receive them. */
const listedWith = (): unknown[] => dialect.sqlToQuery(state.listClause as SQL).params;

beforeEach(() => {
  state.listClause = undefined;
  state.decisions = [decision(), decision({ id: 'd-2', caseNumber: 'XYZ-2022-007', caseTitle: 'Union v. Second Employer' })];
});

describe('what the precedent routes answer with', () => {
  it('wraps a decision twice, so the record is two levels down', async () => {
    const json = (await body(await itemResponse('d-1'))) as { success: boolean; data: { data: Record<string, unknown> } };

    expect(json.success).toBe(true);
    expect(json.data.data).toMatchObject({ id: 'd-1', caseTitle: 'Union v. First Employer' });
    // The reading the console used to do on this body: it finds { data: row }, which is no decision at all.
    const oldReading = (json as { data?: Record<string, unknown> }).data ?? json;
    expect(oldReading.id).toBeUndefined();
    expect(oldReading.caseTitle).toBeUndefined();
  });

  it('answers a list as { precedents, total, page, limit } with no envelope, through the public projection', async () => {
    const json = (await body(await listResponse())) as { precedents: Record<string, unknown>[]; total: number; page: number; limit: number };

    expect(json).toMatchObject({ total: 2, page: 1, limit: 20 });
    expect(json).not.toHaveProperty('success');
    expect(json.precedents.map((row) => row.id)).toEqual(['d-1', 'd-2']);
    expect(json.precedents[0]).toMatchObject({ caseNumber: 'ABC-2021-001', outcome: 'grievance_upheld', precedentValue: 'high' });
    // The projection withholds the grievor, the remedy and the full text of a decision.
    for (const withheld of ['grievor', 'remedy', 'fullText', 'isPublic', 'accessRestrictions']) {
      expect(json.precedents[0]).not.toHaveProperty(withheld);
    }
  });
});

describe('readPrecedent', () => {
  it('reads the decision from the route’s own answer', async () => {
    const precedent = readPrecedent(await body(await itemResponse('d-1')));

    expect(precedent).toMatchObject({
      id: 'd-1',
      caseNumber: 'ABC-2021-001',
      caseTitle: 'Union v. First Employer',
      outcome: 'grievance_upheld',
      jurisdiction: 'ON',
      union: 'Local 100',
      reasoning: 'The employer did not meet its onus.',
    });
  });

  it('carries the stored columns under their own names, and adds none of the names the older precedent model used', async () => {
    const precedent = readPrecedent(await body(await itemResponse('d-1')));

    expect(precedent).toMatchObject({
      arbitrator: 'Jane Arbitrator',
      union: 'Local 100',
      employer: 'Acme Ltd.',
      issueTypes: ['discharge', 'just_cause'],
      summary: 'The grievance was upheld.',
      precedentValue: 'high',
      tribunal: 'private_arbitrator',
      decisionType: 'grievance',
      createdAt: '2021-03-05T15:30:00.000Z',
      updatedAt: '2021-03-06T15:30:00.000Z',
    });
    for (const alias of ['arbitratorName', 'unionName', 'employerName', 'grievanceType', 'issueSummary', 'decisionSummary', 'precedentLevel', 'sharingLevel']) {
      expect(precedent, alias).not.toHaveProperty(alias);
    }
  });

  it('does not carry a column the screens do not show, so one a route should not serve cannot reach a screen', () => {
    const precedent = toPrecedentRecord({ id: 'x', grievor: 'A. Worker', remedy: { monetaryAward: 5000 }, fullText: 'The full text', embedding: '[0.1]', isPublic: true });

    expect(Object.keys(precedent).filter((key) => precedent[key as keyof typeof precedent] !== undefined)).toEqual(['id']);
    expect(precedent).not.toHaveProperty('grievor');
    expect(precedent).not.toHaveProperty('remedy');
    expect(precedent).not.toHaveProperty('fullText');
  });

  it('shows the key findings one to a line instead of running them together', async () => {
    const precedent = readPrecedent(await body(await itemResponse('d-1')));

    expect(precedent.keyFindings).toBe('Discharge without cause was not made out\nReinstatement with back pay');
  });

  it('keeps the counts a stored decision carries, and leaves out the default zero instead of showing it as a measurement', async () => {
    expect(readPrecedent(await body(await itemResponse('d-1')))).toMatchObject({ viewCount: 3, citationCount: 1 });

    state.decisions = [decision({ viewCount: 0, citationCount: 0 })];
    const unrecorded = readPrecedent(await body(await itemResponse('d-1')));
    expect(unrecorded.viewCount).toBeUndefined();
    expect(unrecorded.citationCount).toBeUndefined();
  });

  it('refuses an answer that has no decision in it, instead of returning a blank record', () => {
    expect(() => readPrecedent({ success: true, data: { id: 'd-1' } })).toThrow('Unexpected API response: no record');
    expect(() => readPrecedent({ success: true, data: { data: { caseTitle: 'No id' } } })).toThrow('a precedent without an id');
    expect(() => readPrecedent({ code: 'NOT_FOUND', message: 'arbitration_decisions not found' })).toThrow('no data');
  });
});

describe('readPrecedentList', () => {
  it('reads the decisions and the page count from the route’s own answer', async () => {
    const list = readPrecedentList(await body(await listResponse()));

    expect(list.totalPages).toBe(1);
    expect(list.precedents.map((precedent) => precedent.id)).toEqual(['d-1', 'd-2']);
    expect(list.precedents[1]).toMatchObject({ caseNumber: 'XYZ-2022-007', issueTypes: ['discharge', 'just_cause'], union: 'Local 100' });
  });

  it('counts the pages from the total and the page size the route reports', async () => {
    state.decisions = [decision(), decision({ id: 'd-2' }), decision({ id: 'd-3' })];

    expect(readPrecedentList(await body(await listResponse('page=1&limit=2'))).totalPages).toBe(2);
    expect(readPrecedentList(await body(await listResponse('page=1&limit=1'))).totalPages).toBe(3);
  });

  it('refuses a list that is not one, instead of returning no precedents', () => {
    expect(() => readPrecedentList({ success: true, data: { data: [], pagination: { totalPages: 1 } } })).toThrow('no list');
    expect(() => readPrecedentList({ precedents: [] })).toThrow('no pagination');
    expect(() => readPrecedentList({ precedents: [], total: 0, limit: 0 })).toThrow('no pagination');
    expect(() => readPrecedentList({ precedents: ['not a record'], total: 1, limit: 20 })).toThrow('a precedent that is not a record');
    expect(() => readPrecedentList({ precedents: [{ caseTitle: 'No id' }], total: 1, limit: 20 })).toThrow('a precedent without an id');
    expect(() => readPrecedentList(null)).toThrow('no list');
  });

  it('reads an empty list as an empty list, with no pages', () => {
    expect(readPrecedentList({ precedents: [], total: 0, page: 1, limit: 20 })).toEqual({ precedents: [], totalPages: 0 });
  });
});

describe('the query the console builds, against the real list route', () => {
  it('reaches the route as the filters it applies, so a filter is never sent to a route that ignores it', async () => {
    const query = listParams(
      {
        query: 'harassment',
        outcomes: ['grievance_upheld', 'settled'],
        precedentValues: ['high'],
        jurisdiction: 'ON',
        sector: 'public',
        arbitrator: 'Jane',
        fromDate: '2021-01-01',
        toDate: '2021-12-31',
      },
      2,
      20,
    );

    expect(query.toString()).toBe(
      'page=2&limit=20&searchQuery=harassment&outcome=grievance_upheld%2Csettled&precedentValue=high&jurisdiction=ON&sector=public&arbitrator=Jane&dateFrom=2021-01-01&dateTo=2021-12-31T23%3A59%3A59.999Z',
    );
    await body(await listResponse(query.toString()));

    const sent = listedWith();
    expect(sent).toEqual(expect.arrayContaining(['%harassment%', 'grievance_upheld', 'settled', 'high', 'ON', '%public%', '%Jane%']));
    // The date range is applied on both ends: the whole of the end day is included.
    expect(sent).toEqual(expect.arrayContaining(['2021-01-01T00:00:00.000Z', '2021-12-31T23:59:59.999Z']));
  });

  it('applies nothing but the visibility rule when no filter is set', async () => {
    await body(await listResponse(listParams(NO_FILTERS, 1, 20).toString()));

    const clause = dialect.sqlToQuery(state.listClause as SQL);
    expect(clause.sql).toContain('"arbitration_decisions"."is_public" = $1');
    expect(clause.params).toEqual([true, '']);
  });

  it('does not apply a filter the old search screen sent under a name the route does not read', async () => {
    await body(await listResponse('page=1&limit=20&search=harassment&outcomes=grievance_upheld&jurisdictions=ON'));

    expect(listedWith()).toEqual([true, '']);
  });
});

describe('toPrecedentRecord', () => {
  it('leaves a field the row does not have empty instead of filling it in', () => {
    const precedent = toPrecedentRecord({ id: 'x' });

    expect(precedent.caseTitle).toBeUndefined();
    expect(precedent.issueTypes).toBeUndefined();
    expect(precedent.keyFindings).toBeUndefined();
    expect(precedent.arbitrator).toBeUndefined();
    expect(precedent.legalCitations).toBeUndefined();
    expect(precedent.viewCount).toBeUndefined();
  });

  it('leaves out a list with nothing in it, and an empty or non-text value, instead of showing an empty section', () => {
    const precedent = toPrecedentRecord({ id: 'x', issueTypes: [], keyFindings: ['', 3], legalCitations: [], caseNumber: '', reasoning: 7 });

    expect(precedent.issueTypes).toBeUndefined();
    expect(precedent.keyFindings).toBeUndefined();
    expect(precedent.legalCitations).toBeUndefined();
    expect(precedent.caseNumber).toBeUndefined();
    expect(precedent.reasoning).toBeUndefined();
  });

  it('reads the legal citations that name one, with their type and relevance, and drops the rest', () => {
    const precedent = toPrecedentRecord({
      id: 'x',
      legalCitations: [
        { citation: 'Canada Labour Code, s. 240', type: 'statute', relevance: 'Unjust dismissal' },
        { citation: 'Wallace v. United Grain Growers', type: 7 },
        { type: 'statute' },
        'Not a record',
      ],
    });

    expect(precedent.legalCitations).toEqual([
      { citation: 'Canada Labour Code, s. 240', type: 'statute', relevance: 'Unjust dismissal' },
      { citation: 'Wallace v. United Grain Growers', type: undefined, relevance: undefined },
    ]);
  });

  it('counts only a positive number as recorded: not zero, not null, not text', () => {
    expect(recordedCount(12)).toBe(12);
    expect(recordedCount(0)).toBeUndefined();
    expect(recordedCount(-1)).toBeUndefined();
    expect(recordedCount(null)).toBeUndefined();
    expect(recordedCount(undefined)).toBeUndefined();
    expect(recordedCount('7')).toBeUndefined();
    expect(recordedCount(Number.NaN)).toBeUndefined();
    expect(toPrecedentRecord({ id: 'x', viewCount: 12, citationCount: null })).toMatchObject({ viewCount: 12, citationCount: undefined });
  });
});
