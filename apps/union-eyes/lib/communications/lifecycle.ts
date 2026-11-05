import { ApiError } from '@/lib/api/errors';

/**
 * A survey or poll moves forward only: draft, then open (active or published), then closed. The factory's PATCH used to accept any
 * status at any time, so a closed survey could be reopened with its responses intact and a draft could be marked published without a
 * publication time. The server stamps the publication time; the counters are never client-written.
 */
const OPEN = ['active', 'published'] as const;
const TRANSITIONS: Record<string, readonly string[]> = {
  draft: [...OPEN, 'closed'],
  active: ['closed'],
  published: ['closed'],
  closed: [],
};

export function lifecycleBeforeUpdate(kind: string) {
  return (updates: Record<string, unknown>, ctx: { existing: Record<string, unknown> }): Record<string, unknown> => {
    if (updates.status === undefined) return updates;
    const next = updates.status;
    const current = typeof ctx.existing.status === 'string' ? ctx.existing.status : 'draft';
    if (typeof next !== 'string' || !(next in TRANSITIONS)) throw ApiError.badRequest(`Invalid ${kind} status`);
    if (next === current) return updates;
    if (!(TRANSITIONS[current] ?? []).includes(next)) {
      throw ApiError.conflict(`A ${kind} that is ${current} cannot become ${next}`);
    }
    const opening = (OPEN as readonly string[]).includes(next);
    return opening && !ctx.existing.publishedAt ? { ...updates, publishedAt: new Date() } : updates;
  };
}
