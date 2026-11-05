import { describe, expect, it, vi } from 'vitest';
import { fetchPrecedentComparison } from '../precedent-comparison';

const row = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  caseNumber: `N-${id}`,
  caseTitle: `Case ${id}`,
  outcome: 'grievance_upheld',
  precedentValue: 'high',
  issueTypes: ['discharge'],
  summary: 'The grievance was upheld.',
  keyFindings: ['One', 'Two'],
  viewCount: 0,
  // What the route withholds is never read, even if a body carried it.
  grievor: 'A. Worker',
  fullText: 'The full text',
  ...overrides,
});

/** An item route's answer: the crud factory returns { data: row } and withApi wraps it again. */
const itemAnswer = (record: Record<string, unknown>) => Response.json({ success: true, data: { data: record } });

describe('fetchPrecedentComparison', () => {
  it('reads each selected decision from the item route, in the order they were selected', async () => {
    const read = vi.fn(async (url: string) => itemAnswer(row(decodeURIComponent(url.split('/').pop()!))));

    const precedents = await fetchPrecedentComparison(['b', 'a', 'c'], read);

    expect(read.mock.calls.map(([url]) => url)).toEqual([
      '/api/arbitration/precedents/b',
      '/api/arbitration/precedents/a',
      '/api/arbitration/precedents/c',
    ]);
    expect(precedents.map((precedent) => precedent.id)).toEqual(['b', 'a', 'c']);
  });

  it('shows a decision as it is stored, under its own names, and leaves out what it lacks and what the database has not counted', async () => {
    const [precedent] = await fetchPrecedentComparison(['a'], async () => itemAnswer(row('a')));

    // toEqual ignores a field that is undefined: the fields the decision lacks are left empty, not filled in.
    expect(precedent).toEqual({
      id: 'a',
      caseNumber: 'N-a',
      caseTitle: 'Case a',
      outcome: 'grievance_upheld',
      precedentValue: 'high',
      issueTypes: ['discharge'],
      summary: 'The grievance was upheld.',
      keyFindings: 'One\nTwo',
    });
    expect(precedent.viewCount).toBeUndefined();
  });

  it('never carries a withheld column to a screen', async () => {
    const [precedent] = await fetchPrecedentComparison(['a'], async () => itemAnswer(row('a')));

    expect(precedent).not.toHaveProperty('grievor');
    expect(precedent).not.toHaveProperty('fullText');
  });

  it('percent-encodes an id, so it cannot change the path it is read from', async () => {
    const read = vi.fn(async () => itemAnswer(row('a/b')));

    await fetchPrecedentComparison(['a/b?x=1'], read);

    expect(read).toHaveBeenCalledWith('/api/arbitration/precedents/a%2Fb%3Fx%3D1');
  });

  it('rejects with what the server said when any decision cannot be read, so no partial comparison is shown', async () => {
    const read = async (url: string) =>
      url.endsWith('/b') ? Response.json({ code: 'NOT_FOUND', message: 'arbitration_decisions not found' }, { status: 404 }) : itemAnswer(row('a'));

    await expect(fetchPrecedentComparison(['a', 'b'], read)).rejects.toThrow('arbitration_decisions not found');
  });

  it('falls back to the status when the failure carries no message', async () => {
    await expect(fetchPrecedentComparison(['a'], async () => new Response('', { status: 500 }))).rejects.toThrow('HTTP 500');
  });

  it('rejects an answer that has no decision in it, instead of comparing a blank record', async () => {
    await expect(fetchPrecedentComparison(['a'], async () => Response.json({ success: true, data: { id: 'a' } }))).rejects.toThrow(
      'Unexpected API response: no record',
    );
    await expect(fetchPrecedentComparison(['a'], async () => Response.json({ success: true, data: { data: { caseTitle: 'No id' } } }))).rejects.toThrow(
      'a precedent without an id',
    );
  });
});
