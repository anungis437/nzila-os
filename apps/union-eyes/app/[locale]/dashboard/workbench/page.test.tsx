import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  requireUser: vi.fn(),
  hasMinRole: vi.fn(),
  getCurrentUser: vi.fn(),
}));
vi.mock('@/lib/api-auth-guard', () => auth);
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));
vi.mock('@/components/workbench/workbench-console', () => ({ default: () => null }));

import WorkbenchPage from './page';

beforeEach(() => {
  vi.resetAllMocks();
  auth.requireUser.mockResolvedValue({});
  auth.hasMinRole.mockResolvedValue(true);
});

describe('workbench collection entry audience', () => {
  it.each(['steward', 'chief_steward'])('shows the scoped collection to canonical %s', async role => {
    auth.getCurrentUser.mockResolvedValue({ role });
    expect((await WorkbenchPage()).props.showGrievanceCases).toBe(true);
  });

  it.each(['officer', 'secretary_treasurer', 'admin', 'app_owner', 'member'])(
    'keeps the staff-only entry out of the canonical %s experience', async role => {
      auth.getCurrentUser.mockResolvedValue({ role });
      expect((await WorkbenchPage()).props.showGrievanceCases).toBe(false);
    },
  );

  it('defaults to no advertised collection when the current role is unavailable', async () => {
    auth.getCurrentUser.mockResolvedValue(null);
    expect((await WorkbenchPage()).props.showGrievanceCases).toBe(false);
  });

  it('preserves the existing minimum-role gate before resolving the entry audience', async () => {
    auth.hasMinRole.mockResolvedValue(false);
    await expect(WorkbenchPage()).rejects.toThrow('REDIRECT:/dashboard');
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
  });

  it('preserves the login redirect before resolving the entry audience', async () => {
    auth.requireUser.mockRejectedValue(new Error('Unauthorized'));
    await expect(WorkbenchPage()).rejects.toThrow('REDIRECT:/login');
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
  });
});
