import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ connect: vi.fn(), query: vi.fn(), end: vi.fn() }));
vi.mock('pg', () => ({
  default: { Client: class {
    connect = m.connect;
    query = m.query;
    end = m.end;
  } },
}));

import { ageQaCase } from '../db-inspect';

const originalDatabaseUrl = process.env.DATABASE_URL;

// What the database reports back for a case that really was aged: the clock, and the row the history is keyed by.
const agedRow = (hours = 72) => ({ claim_id: 'qa-case', id: 'row-id', status_changed_at: new Date(Date.now() - hours * 60 * 60 * 1000) });

describe('QA case status-duration fixture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://qa-test-only/ue';
    m.query.mockResolvedValue({ rowCount: 1, rows: [agedRow()] });
  });
  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it('ages the canonical status clock, with triggers off in one transaction, without falsifying last-edit time', async () => {
    await ageQaCase('qa-case', 72);
    const calls = m.query.mock.calls as Array<[string, unknown[]?]>;
    // The claims trigger ignores a write to the clock that comes with no change of status, so the fixture writes it with triggers off, atomically.
    expect(calls[0][0]).toBe('BEGIN');
    expect(calls[1][0]).toBe('SET LOCAL session_replication_role = replica');
    const [sql, values] = calls[2] as [string, unknown[]];
    expect(sql).toContain('status_changed_at = now() - make_interval');
    expect(sql).not.toContain('SET updated_at');
    expect(sql).toContain("organization_id = '11111111-1111-4111-8111-111111111111'");
    expect(sql).toContain('RETURNING claim_id, id, status_changed_at');
    expect(values).toEqual(['qa-case', 72]);
    // The latest recorded transition moves with the clock, so the history and the clock agree.
    const [historySql, historyValues] = calls[3] as [string, unknown[]];
    expect(historySql).toContain('UPDATE claim_status_transitions SET changed_at = now() - make_interval');
    expect(historyValues).toEqual(['row-id', 72]);
    expect(calls[4][0]).toBe('COMMIT');
  });

  it('ages a case the journey filed itself, not only the seeded ones: the boundary is the QA organization', async () => {
    await expect(ageQaCase('f3b1a1c2-0d4e-4f5a-9b6c-7d8e9f0a1b2c', 72)).resolves.toBeUndefined();
    expect((m.query.mock.calls[2] as [string, unknown[]])[1]).toEqual(['f3b1a1c2-0d4e-4f5a-9b6c-7d8e9f0a1b2c', 72]);
  });

  it.each([0, -1, 1.5, 8761, Number.NaN])('rejects an invalid elapsed-hours value %s before database access', async (hours) => {
    await expect(ageQaCase('qa-case', hours)).rejects.toThrow('Invalid QA case age');
    expect(m.connect).not.toHaveBeenCalled();
  });

  it('does not report a successful backdate when the persisted clock was left unchanged, and rolls the transaction back', async () => {
    m.query.mockResolvedValue({ rowCount: 1, rows: [{ claim_id: 'qa-case', id: 'row-id', status_changed_at: new Date() }] });
    await expect(ageQaCase('qa-case', 72)).rejects.toThrow('database trigger preserved');
    const sqls = (m.query.mock.calls as Array<[string]>).map(([sql]) => sql);
    expect(sqls).toContain('ROLLBACK');
    expect(sqls).not.toContain('COMMIT');
    expect(sqls.some((sql) => sql.includes('claim_status_transitions'))).toBe(false);
    expect(m.end).toHaveBeenCalledTimes(1);
  });

  it('does not report a successful backdate when the database returns no readable clock', async () => {
    m.query.mockResolvedValue({ rowCount: 1, rows: [{ claim_id: 'qa-case', id: 'row-id', status_changed_at: null }] });
    await expect(ageQaCase('qa-case', 72)).rejects.toThrow('QA status clock was not backdated');
  });

  it('refuses to claim that a missing or non-QA case was aged, and rolls the whole transaction back', async () => {
    m.query.mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(ageQaCase('not-in-qa-org', 72)).rejects.toThrow('QA case not found');
    const sqls = (m.query.mock.calls as Array<[string]>).map(([sql]) => sql);
    expect(sqls).toContain('ROLLBACK');
    expect(sqls).not.toContain('COMMIT');
    // Nothing is written to the history for a case that was not aged.
    expect(sqls.some((sql) => sql.includes('claim_status_transitions'))).toBe(false);
    expect(m.end).toHaveBeenCalled();
  });
});
