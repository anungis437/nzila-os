// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RoleExperienceGuard from './role-experience-guard';

const navigation = vi.hoisted(() => ({ pathname: '/en-CA/dashboard/workbench', replace: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname, useRouter: () => ({ replace: navigation.replace }) }));
vi.mock('next-intl', () => ({ useLocale: () => 'en-CA' }));
vi.mock('@/contexts/pilot-mode-context', () => ({ usePilotMode: () => ({ isPilotMode: true }) }));
const row = { claimId: '11111111-1111-4111-8111-111111111111', organizationId: '22222222-2222-4222-8222-222222222222', access: 'case', canAssign: true };
const answer = (claims: unknown[]) => ({ success: true, data: { claims } });

beforeEach(() => { navigation.pathname = '/en-CA/dashboard/workbench'; navigation.replace.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('explicit executive casework standing', () => {
  it.each(['case', 'triage'])('keeps the workbench open for a live %s queue', async access => {
    let resolve!: (value: Response) => void;
    const fetcher = vi.fn((_url: RequestInfo | URL, _options?: RequestInit) => new Promise<Response>(done => { resolve = done; }));
    vi.stubGlobal('fetch', fetcher);
    render(<RoleExperienceGuard userRole="secretary_treasurer" />);
    expect(navigation.replace).not.toHaveBeenCalled();
    await act(async () => { resolve(Response.json(answer([{ ...row, access }]))); });
    expect(fetcher).toHaveBeenCalledWith('/api/workbench/assigned', expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }));
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it.each([
    [200, answer([])],
    [403, { error: 'Forbidden' }],
    [503, { error: 'Unavailable' }],
    [200, { success: false, data: { claims: [row] } }],
    [200, answer([{ ...row, access: 'role_title' }])],
    [200, answer([row, { claimId: 'malformed' }])],
  ])('returns to the normal home when scoped access is unverified (%s)', async (status, body) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(body, { status })));
    render(<RoleExperienceGuard userRole="secretary_treasurer" />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/en-CA/dashboard/executive'));
  });

  it.each([
    ['member', '/en-CA/dashboard/workbench', '/en-CA/dashboard'],
    ['secretary_treasurer', '/en-CA/dashboard/workbench/administration', '/en-CA/dashboard/executive'],
    ['secretary_treasurer', '/en-CA/dashboard/security', '/en-CA/dashboard/executive'],
  ])('keeps the existing restriction for %s at %s', (role, path, landing) => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); navigation.pathname = path;
    render(<RoleExperienceGuard userRole={role} />);
    expect(navigation.replace).toHaveBeenCalledWith(landing);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not add a queue request to an ordinary representative route', () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    render(<RoleExperienceGuard userRole="steward" />);
    expect(fetcher).not.toHaveBeenCalled(); expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('cancels an old decision when navigation changes', async () => {
    let resolve!: (value: Response) => void;
    const fetcher = vi.fn((_url: RequestInfo | URL, _options?: RequestInit) => new Promise<Response>(done => { resolve = done; })); vi.stubGlobal('fetch', fetcher);
    const view = render(<RoleExperienceGuard userRole="secretary_treasurer" />);
    const signal = fetcher.mock.calls[0]?.[1]?.signal;
    navigation.pathname = '/en-CA/dashboard/executive'; view.rerender(<RoleExperienceGuard userRole="secretary_treasurer" />);
    await act(async () => { resolve(Response.json(answer([]))); });
    expect(signal?.aborted).toBe(true); expect(navigation.replace).not.toHaveBeenCalled();
  });
});
