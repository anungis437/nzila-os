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

describe('QA case status-duration fixture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://qa-test-only/ue';
    m.query.mockResolvedValue({ rowCount: 1, rows: [{ claim_id: 'qa-case' }] });
  });
  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it('ages the canonical status clock without falsifying last-edit time', async () => {
    await ageQaCase('qa-case', 72);
    const [sql, values] = m.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('status_changed_at = now() - make_interval');
    expect(sql).not.toContain('SET updated_at');
    expect(sql).toContain("organization_id = '11111111-1111-4111-8111-111111111111'");
    expect(sql).toContain('RETURNING claim_id');
    expect(values).toEqual(['qa-case', 72]);
  });

  it.each([0, -1, 1.5, 8761, Number.NaN])('rejects an invalid elapsed-hours value %s before database access', async (hours) => {
    await expect(ageQaCase('qa-case', hours)).rejects.toThrow('Invalid QA case age');
    expect(m.connect).not.toHaveBeenCalled();
  });

  it('refuses to claim that a missing or non-QA case was aged', async () => {
    m.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(ageQaCase('not-in-qa-org', 72)).rejects.toThrow('QA case not found');
    expect(m.end).toHaveBeenCalled();
  });
});
