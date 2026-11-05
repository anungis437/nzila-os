import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/errors', () => ({
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { code: 'VALIDATION_ERROR' }),
    conflict: (msg: string) => Object.assign(new Error(msg), { code: 'CONFLICT' }),
  },
}));

import { lifecycleBeforeUpdate } from '../lifecycle';

const guard = lifecycleBeforeUpdate('survey');
const run = (status: unknown, existing: Record<string, unknown>) => guard({ status }, { existing });

describe('survey and poll lifecycle', () => {
  // DEF-0B5-SURVEY-LIFECYCLE-WRITABLE-DIRECTLY
  it('opens a draft with a server publication time, once', () => {
    const opened = run('published', { status: 'draft', publishedAt: null });
    expect(opened.publishedAt).toBeInstanceOf(Date);
    const again = run('closed', { status: 'published', publishedAt: new Date(0) });
    expect(again).not.toHaveProperty('publishedAt');
  });

  it('closes an open survey and refuses to reopen a closed one or to go backwards', () => {
    expect(run('closed', { status: 'active' })).toMatchObject({ status: 'closed' });
    expect(() => run('active', { status: 'closed' })).toThrow(/cannot become/);
    expect(() => run('draft', { status: 'published' })).toThrow(/cannot become/);
  });

  it('refuses an unknown status, and leaves an update with no status alone', () => {
    expect(() => run('bogus', { status: 'draft' })).toThrow(/Invalid survey status/);
    expect(guard({ title: 'x' }, { existing: { status: 'closed' } })).toEqual({ title: 'x' });
  });
});
