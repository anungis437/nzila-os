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
import { UserRole } from '@/lib/auth/roles';

const handlerRoles = ['steward', 'chief_steward', 'officer', 'president',
  'vice_president', 'secretary_treasurer', 'health_safety_rep', 'bargaining_committee'];
const nonHandlerRoles = Object.values(UserRole).filter(role => !handlerRoles.includes(role));

beforeEach(() => {
  vi.resetAllMocks();
  auth.requireUser.mockResolvedValue({ roles: ['steward'] });
  auth.hasMinRole.mockResolvedValue(true);
});

describe('workbench collection entry audience', () => {
  it.each(['steward', 'chief_steward', 'health_safety_rep', 'bargaining_committee'])('shows the scoped collection to canonical %s', async role => {
    auth.requireUser.mockResolvedValue({ roles: [role] });
    expect((await WorkbenchPage()).props.showGrievanceCases).toBe(true);
  });

  it.each(['officer', 'secretary_treasurer'])(
    'keeps the staff-only entry out of the canonical %s experience', async role => {
      auth.requireUser.mockResolvedValue({ roles: [role] });
      expect((await WorkbenchPage()).props.showGrievanceCases).toBe(false);
    },
  );

  it.each([...nonHandlerRoles, 'unknown'])(
    'refuses the case staff surface for %s without handler eligibility', async role => {
      auth.requireUser.mockResolvedValue({ roles: [role] });
      await expect(WorkbenchPage()).rejects.toThrow('REDIRECT:/dashboard');
    },
  );

  it('preserves the login redirect before resolving the entry audience', async () => {
    auth.requireUser.mockRejectedValue(new Error('Unauthorized'));
    await expect(WorkbenchPage()).rejects.toThrow('REDIRECT:/login');
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
  });
});
