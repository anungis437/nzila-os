import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  loggerError: vi.fn(),
  q: {
    createMemberEmployment: vi.fn(),
    getMemberEmploymentById: vi.fn(),
    getActiveMemberEmployment: vi.fn(),
    getAllMemberEmployment: vi.fn(),
    getEmploymentByOrganization: vi.fn(),
    updateMemberEmployment: vi.fn(),
    deleteMemberEmployment: vi.fn(),
    getEmploymentForDuesCalculation: vi.fn(),
    createEmploymentHistory: vi.fn(),
    getEmploymentHistoryByMember: vi.fn(),
    createMemberLeave: vi.fn(),
    getActiveMemberLeaves: vi.fn(),
    getAllMemberLeaves: vi.fn(),
    updateMemberLeave: vi.fn(),
    createJobClassification: vi.fn(),
    getJobClassificationByCode: vi.fn(),
    getJobClassificationsByOrganization: vi.fn(),
    updateJobClassification: vi.fn(),
    calculateSeniorityYears: vi.fn(),
  },
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: mocks.auth }));
vi.mock('@/db/queries/member-employment-queries', () => mocks.q);
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.loggerError } }));

import * as actions from '../member-employment-actions';

describe('member-employment-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: 'user-1' });
    for (const fn of Object.values(mocks.q)) fn.mockResolvedValue('OK');
    mocks.q.calculateSeniorityYears.mockResolvedValue(5);
  });

  afterEach(() => vi.restoreAllMocks());

  describe('read actions (no auth gate)', () => {
    const cases: Array<[string, () => Promise<unknown>, () => void]> = [
      ['getMemberEmploymentByIdAction', () => actions.getMemberEmploymentByIdAction('id'), () => mocks.q.getMemberEmploymentById.mockRejectedValueOnce(new Error('x'))],
      ['getActiveMemberEmploymentAction', () => actions.getActiveMemberEmploymentAction('m'), () => mocks.q.getActiveMemberEmployment.mockRejectedValueOnce(new Error('x'))],
      ['getAllMemberEmploymentAction', () => actions.getAllMemberEmploymentAction('m'), () => mocks.q.getAllMemberEmployment.mockRejectedValueOnce(new Error('x'))],
      ['getEmploymentByOrganizationAction', () => actions.getEmploymentByOrganizationAction('o', 'active'), () => mocks.q.getEmploymentByOrganization.mockRejectedValueOnce(new Error('x'))],
      ['getEmploymentForDuesCalculationAction', () => actions.getEmploymentForDuesCalculationAction('m'), () => mocks.q.getEmploymentForDuesCalculation.mockRejectedValueOnce(new Error('x'))],
      ['getEmploymentHistoryByMemberAction', () => actions.getEmploymentHistoryByMemberAction('m'), () => mocks.q.getEmploymentHistoryByMember.mockRejectedValueOnce(new Error('x'))],
      ['getActiveMemberLeavesAction', () => actions.getActiveMemberLeavesAction('m'), () => mocks.q.getActiveMemberLeaves.mockRejectedValueOnce(new Error('x'))],
      ['getAllMemberLeavesAction', () => actions.getAllMemberLeavesAction('m'), () => mocks.q.getAllMemberLeaves.mockRejectedValueOnce(new Error('x'))],
      ['getJobClassificationByCodeAction', () => actions.getJobClassificationByCodeAction('o', 'code'), () => mocks.q.getJobClassificationByCode.mockRejectedValueOnce(new Error('x'))],
      ['getJobClassificationsByOrganizationAction', () => actions.getJobClassificationsByOrganizationAction('o'), () => mocks.q.getJobClassificationsByOrganization.mockRejectedValueOnce(new Error('x'))],
      ['calculateSeniorityYearsAction', () => actions.calculateSeniorityYearsAction('2020-01-01'), () => mocks.q.calculateSeniorityYears.mockRejectedValueOnce(new Error('x'))],
    ];

    it.each(cases)('%s succeeds and handles errors', async (_name, call, makeFail) => {
      const ok = (await call()) as { isSuccess: boolean };
      expect(ok.isSuccess).toBe(true);

      makeFail();
      const fail = (await call()) as { isSuccess: boolean };
      expect(fail.isSuccess).toBe(false);
    });
  });

  describe('write actions (auth gated)', () => {
    const cases: Array<[string, () => Promise<unknown>, () => void]> = [
      ['createMemberEmploymentAction', () => actions.createMemberEmploymentAction({} as never), () => mocks.q.createMemberEmployment.mockRejectedValueOnce(new Error('x'))],
      ['updateMemberEmploymentAction', () => actions.updateMemberEmploymentAction('id', {}), () => mocks.q.updateMemberEmployment.mockRejectedValueOnce(new Error('x'))],
      ['deleteMemberEmploymentAction', () => actions.deleteMemberEmploymentAction('id'), () => mocks.q.deleteMemberEmployment.mockRejectedValueOnce(new Error('x'))],
      ['createEmploymentHistoryAction', () => actions.createEmploymentHistoryAction({} as never), () => mocks.q.createEmploymentHistory.mockRejectedValueOnce(new Error('x'))],
      ['createMemberLeaveAction', () => actions.createMemberLeaveAction({} as never), () => mocks.q.createMemberLeave.mockRejectedValueOnce(new Error('x'))],
      ['updateMemberLeaveAction', () => actions.updateMemberLeaveAction('id', {}), () => mocks.q.updateMemberLeave.mockRejectedValueOnce(new Error('x'))],
      ['approveMemberLeaveAction', () => actions.approveMemberLeaveAction('id'), () => mocks.q.updateMemberLeave.mockRejectedValueOnce(new Error('x'))],
      ['createJobClassificationAction', () => actions.createJobClassificationAction({} as never), () => mocks.q.createJobClassification.mockRejectedValueOnce(new Error('x'))],
      ['updateJobClassificationAction', () => actions.updateJobClassificationAction('id', {}), () => mocks.q.updateJobClassification.mockRejectedValueOnce(new Error('x'))],
    ];

    it.each(cases)('%s succeeds, rejects unauth, and handles errors', async (_name, call, makeFail) => {
      const ok = (await call()) as { isSuccess: boolean };
      expect(ok.isSuccess).toBe(true);

      mocks.auth.mockResolvedValueOnce({ userId: null });
      const unauth = (await call()) as { isSuccess: boolean; message: string };
      expect(unauth.isSuccess).toBe(false);
      expect(unauth.message).toContain('Unauthorized');

      makeFail();
      const fail = (await call()) as { isSuccess: boolean };
      expect(fail.isSuccess).toBe(false);
    });
  });
});
