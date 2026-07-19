import { describe, it, expect, vi } from 'vitest';

vi.mock('@/db', () => ({
  db: { __fake: true },
  someTable: { __table: true },
}));

import * as libDb from '../db';

describe('lib/db', () => {
  it('re-exports the db surface from @/db', () => {
    expect((libDb as Record<string, unknown>).db).toEqual({ __fake: true });
  });

  it('re-exports the drizzle sql helper', () => {
    expect(typeof libDb.sql).toBe('function');
  });
});
