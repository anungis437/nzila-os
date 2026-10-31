import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

// DEF-0B11-RPT-EXECUTE-JOINED-TABLES-CARRY-NO-ORGANIZATION-PREDICATE…: the only organization predicate was on the base
// table, so a caller-configured join selected the rows of other organizations. These tests run the real executor,
// unmocked, against real SQL holding two organizations.

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/db/db', async () => {
  const { lateBoundDb } = await import('../../app/api/__tests__/support/pglite-tables');
  return { db: lateBoundDb(state) };
});

import { ReportExecutor } from '../report-executor';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
let pg: PGlite;

beforeAll(async () => {
  const { PGlite: Engine } = await import('@electric-sql/pglite');
  pg = new Engine();
  state.db = drizzle(pg);
  await pg.exec(`
    CREATE TABLE claims (id text primary key, organization_id uuid not null, claim_number text, status text, priority text,
      claim_type text, created_at timestamptz default now(), resolved_at timestamptz, member_id text, assigned_to text, outcome text);
    CREATE TABLE organization_members (id text primary key, organization_id uuid not null, first_name text, last_name text,
      email text, hire_date date, role text, status text, created_at timestamptz default now());
    CREATE TABLE claim_deadlines (id text primary key, organization_id uuid not null, claim_id text, deadline_type text,
      current_deadline date, status text, priority text, completed_at timestamptz);
    CREATE TABLE dues_assignments (id text primary key, organization_id uuid not null, member_id text, amount numeric,
      frequency text, status text, effective_date date, end_date date);
  `);
});

afterAll(async () => { await pg.close(); });

beforeEach(async () => {
  await pg.exec('TRUNCATE claims, organization_members, claim_deadlines, dues_assignments');
  await pg.query(`INSERT INTO claims (id, organization_id, status, member_id) VALUES ('c-a1', $1, 'open', 'm-a1'), ('c-a2', $1, 'open', 'm-a2')`, [ORG_A]);
  await pg.query(`INSERT INTO claims (id, organization_id, status, member_id) VALUES ('c-b1', $1, 'open', 'm-b1')`, [ORG_B]);
  await pg.query(`INSERT INTO organization_members (id, organization_id, email, status) VALUES ('m-a1', $1, 'a1@a.org', 'active'), ('m-a2', $1, 'a2@a.org', 'active')`, [ORG_A]);
  await pg.query(`INSERT INTO organization_members (id, organization_id, email, status) VALUES ('m-b1', $1, 'b1@b.org', 'active')`, [ORG_B]);
  await pg.query(`INSERT INTO claim_deadlines (id, organization_id, claim_id, status) VALUES ('d-a1', $1, 'c-a1', 'open'), ('d-b1', $2, 'c-b1', 'open')`, [ORG_A, ORG_B]);
  await pg.query(`INSERT INTO dues_assignments (id, organization_id, member_id, amount) VALUES ('du-a1', $1, 'm-a1', 10), ('du-b1', $2, 'm-b1', 99)`, [ORG_A, ORG_B]);
});

const rowsOf = (data: unknown) => ((data as { rows?: unknown[] }).rows ?? data) as Array<Record<string, string>>;
const ids = (data: unknown, key = 'id') => rowsOf(data).map((r) => r[key]).sort();

describe('ReportExecutor — joined tables stay inside the caller organization', () => {
  it('a non-equi join cannot pair the caller\'s claims with another organization\'s members', async () => {
    const result = await new ReportExecutor(ORG_A).execute({
      dataSourceId: 'claims',
      fields: [{ fieldId: 'id', fieldName: 'ID', table: 'claims', alias: 'claim_id' }, { fieldId: 'id', fieldName: 'Member', table: 'organization_members', alias: 'member_id' }],
      joins: [{ table: 'organization_members', type: 'inner', on: { leftField: 'claims.id', rightField: 'organization_members.id', operator: '!=' } }],
    });
    expect(result.success).toBe(true);
    expect(ids(result.data, 'member_id')).not.toContain('m-b1');
    expect(rowsOf(result.data)).toHaveLength(4); // two claims × two members of the caller's own organization
  });

  it('the same join returns the other organization\'s rows only to that organization', async () => {
    const result = await new ReportExecutor(ORG_B).execute({
      dataSourceId: 'claims',
      fields: [{ fieldId: 'id', fieldName: 'Member', table: 'organization_members', alias: 'member_id' }],
      joins: [{ table: 'organization_members', type: 'inner', on: { leftField: 'claims.id', rightField: 'organization_members.id', operator: '!=' } }],
    });
    expect(ids(result.data, 'member_id')).toEqual(['m-b1']);
  });

  it('a LEFT join to deadlines does not attach another organization\'s deadline', async () => {
    const result = await new ReportExecutor(ORG_A).execute({
      dataSourceId: 'claims',
      fields: [{ fieldId: 'id', fieldName: 'Deadline', table: 'claim_deadlines', alias: 'deadline_id' }],
      joins: [{ table: 'claim_deadlines', type: 'left', on: { leftField: 'claims.id', rightField: 'claim_deadlines.id', operator: '!=' } }],
    });
    expect(result.success).toBe(true);
    expect(ids(result.data, 'deadline_id')).not.toContain('d-b1');
  });

  it('RIGHT and FULL joins surface no unmatched row of another organization', async () => {
    for (const type of ['right', 'full'] as const) {
      const result = await new ReportExecutor(ORG_A).execute({
        dataSourceId: 'organization_members',
        fields: [{ fieldId: 'id', fieldName: 'Assignment', table: 'dues_assignments', alias: 'assignment_id' }],
        joins: [{ table: 'dues_assignments', type, on: { leftField: 'organization_members.id', rightField: 'dues_assignments.member_id' } }],
      });
      expect(result.success).toBe(true);
      expect(ids(result.data, 'assignment_id')).not.toContain('du-b1');
    }
  });

  it('refuses a join the base source does not declare, and a field qualified with a table not in the query', async () => {
    const notJoinable = await new ReportExecutor(ORG_A).execute({
      dataSourceId: 'claims',
      fields: [{ fieldId: 'status', fieldName: 'Status', table: 'dues_assignments' }],
      joins: [{ table: 'dues_assignments', type: 'inner', on: { leftField: 'claims.member_id', rightField: 'dues_assignments.member_id' } }],
    });
    expect(notJoinable.success).toBe(false);
    expect(notJoinable.error).toContain('not joinable');

    const unjoined = await new ReportExecutor(ORG_A).execute({
      dataSourceId: 'claims',
      fields: [{ fieldId: 'status', fieldName: 'Status', table: 'organization_members' }],
    });
    expect(unjoined.success).toBe(false);
    expect(unjoined.error).toContain('Invalid field table');
  });

  it('caps the rows a caller can ask for', async () => {
    const result = await new ReportExecutor(ORG_A).execute({
      dataSourceId: 'claims',
      fields: [{ fieldId: 'id', fieldName: 'ID' }],
      limit: 1_000_000_000,
    });
    expect(result.success).toBe(true);
    expect(JSON.stringify(result.sql)).toContain('10000');
  });
});
