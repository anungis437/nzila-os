import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn(), end: vi.fn() }));
vi.mock('pg', () => ({ default: { Client: class {
  query = m.query;
  connect = m.connect;
  end = m.end;
} } }));
import { ageQaCase } from '../db-inspect';

const QA_CASE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

describe('QA status-clock inspection fails closed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DATABASE_URL', 'postgres://qa-only');
    m.connect.mockResolvedValue(undefined);
    m.end.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('refuses arbitrary cases and invalid ages before opening a database connection', async () => {
    await expect(ageQaCase('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 72)).rejects.toThrow('seeded QA cases');
    await expect(ageQaCase(QA_CASE, -1)).rejects.toThrow('Invalid QA case age');
    expect(m.connect).not.toHaveBeenCalled();
  });

  it('does not report a successful backdate when the production trigger keeps the clock unchanged', async () => {
    m.query.mockResolvedValue({ rowCount: 1, rows: [{ status_changed_at: new Date() }] });
    await expect(ageQaCase(QA_CASE, 72)).rejects.toThrow('database trigger preserved');
    expect(m.query).toHaveBeenCalledWith(expect.stringContaining('RETURNING claim_id, status_changed_at'), [QA_CASE, 72]);
    expect(m.end).toHaveBeenCalledTimes(1);
  });

  it('accepts only a verified persisted clock for the designated QA fixture', async () => {
    const backdated = new Date(Date.now() - 72 * 60 * 60 * 1000);
    m.query.mockResolvedValue({ rowCount: 1, rows: [{ status_changed_at: backdated }] });
    await expect(ageQaCase(QA_CASE, 72)).resolves.toBeUndefined();
    expect(m.query.mock.calls[0][0]).toContain("organization_id = '11111111-1111-4111-8111-111111111111'");
  });

  it('refuses a missing QA row instead of claiming the fixture was aged', async () => {
    m.query.mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(ageQaCase(QA_CASE, 72)).rejects.toThrow('QA case not found');
  });
});
