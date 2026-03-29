import { describe, it, expect } from 'vitest';
import {
  computeSetupProgress,
  getNextStep,
  createEmptyContext,
  SETUP_STEPS,
  type SetupContext,
} from '../setup-checklist';

describe('setup-checklist', () => {
  describe('createEmptyContext', () => {
    it('returns context with all flags false/zero', () => {
      const ctx = createEmptyContext();
      expect(ctx.orgCreated).toBe(false);
      expect(ctx.worksitesCount).toBe(0);
      expect(ctx.usersInvited).toBe(0);
    });
  });

  describe('SETUP_STEPS', () => {
    it('has at least 8 required steps', () => {
      const required = SETUP_STEPS.filter((s) => s.required);
      expect(required.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('computeSetupProgress', () => {
    it('returns 0% for empty context', () => {
      const ctx = createEmptyContext();
      const progress = computeSetupProgress(ctx);
      expect(progress.percentage).toBe(0);
      expect(progress.isReady).toBe(false);
      expect(progress.completedCount).toBe(0);
    });

    it('returns 100% when all steps complete', () => {
      const ctx: SetupContext = {
        orgCreated: true,
        orgName: 'CUPE Local 123',
        worksitesCount: 2,
        usersInvited: 5,
        vocabularyLoaded: true,
        slaConfigured: true,
        testCaseFiled: true,
        testCaseResolved: true,
        auditTrailVerified: true,
        exportTested: true,
      };
      const progress = computeSetupProgress(ctx);
      expect(progress.percentage).toBe(100);
      expect(progress.isReady).toBe(true);
    });

    it('isReady when only required steps done', () => {
      const ctx: SetupContext = {
        orgCreated: true,
        orgName: 'Test',
        worksitesCount: 1,
        usersInvited: 2,
        vocabularyLoaded: true,
        slaConfigured: false, // optional
        testCaseFiled: true,
        testCaseResolved: true,
        auditTrailVerified: true,
        exportTested: false, // optional
      };
      const progress = computeSetupProgress(ctx);
      expect(progress.isReady).toBe(true);
    });
  });

  describe('getNextStep', () => {
    it('returns first required step for empty context', () => {
      const next = getNextStep(createEmptyContext());
      expect(next).not.toBeNull();
      expect(next!.id).toBe('create-org');
    });

    it('returns null when all required steps done', () => {
      const ctx: SetupContext = {
        orgCreated: true,
        orgName: 'Done',
        worksitesCount: 1,
        usersInvited: 2,
        vocabularyLoaded: true,
        slaConfigured: false,
        testCaseFiled: true,
        testCaseResolved: true,
        auditTrailVerified: true,
        exportTested: false,
      };
      expect(getNextStep(ctx)).toBeNull();
    });
  });
});
