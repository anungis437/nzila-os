import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ queue: [] as unknown[], audit: vi.fn(), values: vi.fn() }));

function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'from', 'limit', 'insert', 'where', 'returning']) c[m] = () => c;
  c.values = (...args: unknown[]) => {
    h.values(...args);
    return c;
  };
  c.then = (resolve: (v: unknown) => void) => resolve(h.queue.shift());
  return c;
}
const tx = chain();

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_scope: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.audit }));
vi.mock('@/db/schema', () => ({
  bargainingNotes: new Proxy({}, { get: (_t, p) => `notes.${String(p)}` }),
  collectiveAgreements: new Proxy({}, { get: (_t, p) => `agreements.${String(p)}` }),
  arbitrationDecisions: new Proxy({}, { get: (_t, p) => `decisions.${String(p)}` }),
}));
vi.mock('drizzle-orm', () => ({
  and: (...a: unknown[]) => ({ and: a }),
  eq: (c: unknown, v: unknown) => ({ eq: [c, v] }),
}));

import { createBargainingNoteAudited, ForeignAgreementError } from '../bargaining-notes-audited-service';
import { createPrecedentAudited } from '../precedent-audited-service';

const scope = { organizationId: 'org-1', userId: 'user-1' };

beforeEach(() => {
  h.queue.length = 0;
  h.audit.mockReset().mockResolvedValue(undefined);
  h.values.mockReset();
});

describe('bargaining-notes-audited-service', () => {
  it('stores the note under the caller\'s organization and user and audits it on the same transaction', async () => {
    h.queue.push([{ id: 'n1', confidentialityLevel: 'internal' }]);
    const note = await createBargainingNoteAudited(scope, { title: 'T', content: 'C', sessionType: 'negotiation', sessionDate: new Date() } as never);
    expect(note.id).toBe('n1');
    expect(h.values).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', createdBy: 'user-1', lastModifiedBy: 'user-1' }));
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'bargaining_note.create', resourceId: 'n1', userId: 'user-1' }));
  });

  it('refuses an agreement of another organization before writing anything', async () => {
    h.queue.push([]);
    await expect(
      createBargainingNoteAudited(scope, { cbaId: 'cba-x', title: 'T', content: 'C', sessionType: 's', sessionDate: new Date() } as never),
    ).rejects.toBeInstanceOf(ForeignAgreementError);
    expect(h.values).not.toHaveBeenCalled();
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('does not keep a note whose audit record cannot be written', async () => {
    h.queue.push([{ id: 'n1' }]);
    h.audit.mockRejectedValueOnce(new Error('audit down'));
    await expect(createBargainingNoteAudited(scope, { title: 'T' } as never)).rejects.toThrow('audit down');
  });
});

describe('precedent-audited-service', () => {
  it('creates the precedent and audits it to the acting organization on the same transaction', async () => {
    h.queue.push([{ id: 'p1', caseNumber: 'CN-1', tribunal: 'other' }]);
    const created = await createPrecedentAudited(scope, { caseNumber: 'CN-1' } as never);
    expect(created.id).toBe('p1');
    expect(h.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ organizationId: 'org-1', userId: 'user-1', action: 'precedent.create', resourceId: 'p1' }),
    );
  });

  it('does not keep a precedent whose audit record cannot be written', async () => {
    h.queue.push([{ id: 'p1' }]);
    h.audit.mockRejectedValueOnce(new Error('audit down'));
    await expect(createPrecedentAudited(scope, {} as never)).rejects.toThrow('audit down');
  });
});
