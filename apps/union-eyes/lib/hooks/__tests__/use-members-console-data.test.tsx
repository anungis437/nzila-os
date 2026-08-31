/**
 * @vitest-environment jsdom
 *
 * Truth-scoping contract for the Member Management console's data hook:
 * a failed fetch for the CURRENTLY selected organization must never leave
 * a PREVIOUS organization's members/stats rendered as if they belong to
 * the new selection, and a partial "All Organizations" failure must remain
 * a visible partial result rather than silently exporting as complete.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useMembersConsoleData } from '../use-members-console-data';

const mockFetch = vi.fn();

type RespInit = { ok?: boolean; status?: number; json?: () => unknown | Promise<unknown> };
function resp(init: RespInit) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: init.json ?? (async () => ({})),
  };
}

/** Configure fetch to route by URL substring, in order (first match wins). */
function routeFetch(routes: Array<[string, () => unknown]>) {
  mockFetch.mockImplementation(async (url: string) => {
    for (const [pattern, factory] of routes) {
      if (url.includes(pattern)) return factory();
    }
    return resp({ json: async () => ({}) });
  });
}

const ORG_A = { id: 'org-a', name: 'Local 100' };
const ORG_B = { id: 'org-b', name: 'Local 200' };
// Stable reference across re-renders — useMembersConsoleData depends on
// `organizations` by identity (like the real caller's useState-held array),
// so recreating this array inline in a render callback would change its
// identity every render and cause an effect/render loop.
const ORGS = [ORG_A, ORG_B];

const MEMBER_A = { id: 'm-a', user_id: 'u-a', organization_id: 'org-a', role: 'member', status: 'active', name: 'Alice', email: 'alice@example.com', phone: null, department: null, membership_number: null, created_at: null };

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
});

describe('useMembersConsoleData — stale-scope invalidation', () => {
  it('Org A success then switch to Org B with a Org B failure: Org A members are NOT displayed under Org B', async () => {
    routeFetch([
      ['/api/organizations/org-a/members', () => resp({ json: async () => ({ data: [MEMBER_A] }) })],
      ['/api/organizations/org-b/members', () => resp({ ok: false, status: 500 })],
      ['organizationId=org-a', () => resp({ json: async () => ({ total: 1, active: 1, stewards: 0, officers: 0 }) })],
      ['organizationId=org-b', () => resp({ ok: false, status: 500 })],
    ]);

    const { result, rerender } = renderHook(
      (props: { selectedOrg: string }) => useMembersConsoleData(props.selectedOrg, ORGS, false),
      { initialProps: { selectedOrg: 'org-a' } },
    );

    await waitFor(() => expect(result.current.members).toEqual([MEMBER_A]));
    await waitFor(() => expect(result.current.stats).toEqual({ total: 1, active: 1, stewards: 0, officers: 0 }));

    rerender({ selectedOrg: 'org-b' });

    await waitFor(() => expect(result.current.membersError).toBeTruthy());
    // The defect this fixes: Org A's rows must never linger once Org B is
    // selected and its fetch fails — not "still Alice", but genuinely empty.
    expect(result.current.members).toEqual([]);

    await waitFor(() => expect(result.current.statsError).toBeTruthy());
    // Same contract for stats: never Org A's numbers presented as Org B's.
    expect(result.current.stats).toBeNull();
  });

  it('a genuinely empty Org B result is distinguishable from a failed Org B result', async () => {
    routeFetch([
      ['/api/organizations/org-b/members', () => resp({ json: async () => ({ data: [] }) })],
      ['organizationId=org-b', () => resp({ json: async () => ({ total: 0, active: 0, stewards: 0, officers: 0 }) })],
    ]);

    const { result } = renderHook(() => useMembersConsoleData('org-b', ORGS, false));

    await waitFor(() => expect(result.current.isLoadingMembers).toBe(false));
    expect(result.current.members).toEqual([]);
    expect(result.current.membersError).toBeNull(); // empty, not unavailable

    await waitFor(() => expect(result.current.isLoadingStats).toBe(false));
    expect(result.current.stats).toEqual({ total: 0, active: 0, stewards: 0, officers: 0 }); // genuine zero
    expect(result.current.statsError).toBeNull();
  });

  it('"All Organizations" with one org failing keeps the successful org\'s members visible alongside a visible error (partial result)', async () => {
    routeFetch([
      ['/api/organizations/org-a/members', () => resp({ json: async () => ({ data: [MEMBER_A] }) })],
      ['/api/organizations/org-b/members', () => resp({ ok: false, status: 500 })],
    ]);

    const { result } = renderHook(() => useMembersConsoleData('all', ORGS, false));

    await waitFor(() => expect(result.current.membersError).toBeTruthy());
    expect(result.current.membersError).toContain(ORG_B.name);
    // Partial success is a visible, not a silently-blanked, result.
    expect(result.current.members).toEqual([MEMBER_A]);
  });
});
