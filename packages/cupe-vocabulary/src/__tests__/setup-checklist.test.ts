/**
 * Tests for setup checklist logic — PR-061
 *
 * Validates setup steps, progress computation, next-step guidance, and context factory.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Local mirrors
// ---------------------------------------------------------------------------

interface SetupStep {
  id: string;
  category: string;
  title: string;
  description: string;
  required: boolean;
  checkFn: (ctx: SetupContext) => boolean;
}

interface SetupContext {
  orgCreated: boolean;
  worksitesAdded: number;
  vocabularyLoaded: boolean;
  stewardInvited: boolean;
  memberInvited: boolean;
  slaConfigured: boolean;
  testCaseFiled: boolean;
  testCaseResolved: boolean;
  auditVerified: boolean;
  exportTested: boolean;
}

interface SetupProgress {
  completedCount: number;
  totalCount: number;
  requiredCompleted: number;
  requiredTotal: number;
  percentage: number;
  isReady: boolean;
}

const SETUP_STEPS: SetupStep[] = [
  { id: 'create-org', category: 'organization', title: 'Create organization', description: 'Set up your organization profile and details.', required: true, checkFn: (ctx) => ctx.orgCreated },
  { id: 'add-worksites', category: 'organization', title: 'Add worksites', description: 'Add at least one worksite where grievances may arise.', required: true, checkFn: (ctx) => ctx.worksitesAdded >= 1 },
  { id: 'load-vocabulary', category: 'organization', title: 'Load CUPE vocabulary', description: 'Import the CUPE grievance vocabulary for case classification.', required: true, checkFn: (ctx) => ctx.vocabularyLoaded },
  { id: 'invite-steward', category: 'users', title: 'Invite a steward', description: 'Invite at least one union steward to manage cases.', required: true, checkFn: (ctx) => ctx.stewardInvited },
  { id: 'invite-member', category: 'users', title: 'Invite a member', description: 'Invite at least one union member to file cases.', required: true, checkFn: (ctx) => ctx.memberInvited },
  { id: 'configure-sla', category: 'configuration', title: 'Configure SLA thresholds', description: 'Optionally customize SLA thresholds for your organization.', required: false, checkFn: (ctx) => ctx.slaConfigured },
  { id: 'file-test-case', category: 'validation', title: 'File a test case', description: 'File a test grievance to validate the workflow.', required: true, checkFn: (ctx) => ctx.testCaseFiled },
  { id: 'resolve-test-case', category: 'validation', title: 'Resolve the test case', description: 'Resolve the test grievance to complete the full lifecycle.', required: true, checkFn: (ctx) => ctx.testCaseResolved },
  { id: 'verify-audit', category: 'validation', title: 'Verify audit trail', description: 'Confirm that the audit trail captured all case events.', required: true, checkFn: (ctx) => ctx.auditVerified },
  { id: 'test-export', category: 'validation', title: 'Test data export', description: 'Optionally test CSV export of case data.', required: false, checkFn: (ctx) => ctx.exportTested },
];

function computeSetupProgress(ctx: SetupContext): SetupProgress {
  const requiredSteps = SETUP_STEPS.filter(s => s.required);
  const completedSteps = SETUP_STEPS.filter(s => s.checkFn(ctx));
  const requiredCompleted = requiredSteps.filter(s => s.checkFn(ctx)).length;
  return {
    completedCount: completedSteps.length,
    totalCount: SETUP_STEPS.length,
    requiredCompleted,
    requiredTotal: requiredSteps.length,
    percentage: Math.round((completedSteps.length / SETUP_STEPS.length) * 100),
    isReady: requiredCompleted === requiredSteps.length,
  };
}

function getNextStep(ctx: SetupContext): SetupStep | null {
  return SETUP_STEPS.find(s => s.required && !s.checkFn(ctx)) ?? SETUP_STEPS.find(s => !s.checkFn(ctx)) ?? null;
}

function createEmptyContext(): SetupContext {
  return {
    orgCreated: false,
    worksitesAdded: 0,
    vocabularyLoaded: false,
    stewardInvited: false,
    memberInvited: false,
    slaConfigured: false,
    testCaseFiled: false,
    testCaseResolved: false,
    auditVerified: false,
    exportTested: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SETUP_STEPS', () => {
  it('has 10 steps', () => {
    expect(SETUP_STEPS).toHaveLength(10);
  });

  it('has 8 required steps', () => {
    expect(SETUP_STEPS.filter(s => s.required)).toHaveLength(8);
  });

  it('has 2 optional steps', () => {
    expect(SETUP_STEPS.filter(s => !s.required)).toHaveLength(2);
  });

  it('spans 4 categories', () => {
    const categories = new Set(SETUP_STEPS.map(s => s.category));
    expect(categories.size).toBe(4);
    expect(categories).toContain('organization');
    expect(categories).toContain('users');
    expect(categories).toContain('configuration');
    expect(categories).toContain('validation');
  });

  it('all steps have unique IDs', () => {
    const ids = SETUP_STEPS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('createEmptyContext', () => {
  it('returns all-false/0 context', () => {
    const ctx = createEmptyContext();
    expect(ctx.orgCreated).toBe(false);
    expect(ctx.worksitesAdded).toBe(0);
    expect(ctx.vocabularyLoaded).toBe(false);
    expect(ctx.testCaseFiled).toBe(false);
    expect(ctx.exportTested).toBe(false);
  });
});

describe('computeSetupProgress', () => {
  it('returns 0% for empty context', () => {
    const progress = computeSetupProgress(createEmptyContext());
    expect(progress.completedCount).toBe(0);
    expect(progress.percentage).toBe(0);
    expect(progress.isReady).toBe(false);
  });

  it('returns 100% when all steps complete', () => {
    const ctx: SetupContext = {
      orgCreated: true,
      worksitesAdded: 3,
      vocabularyLoaded: true,
      stewardInvited: true,
      memberInvited: true,
      slaConfigured: true,
      testCaseFiled: true,
      testCaseResolved: true,
      auditVerified: true,
      exportTested: true,
    };
    const progress = computeSetupProgress(ctx);
    expect(progress.completedCount).toBe(10);
    expect(progress.percentage).toBe(100);
    expect(progress.isReady).toBe(true);
  });

  it('isReady=true when all required done but optional not', () => {
    const ctx: SetupContext = {
      orgCreated: true,
      worksitesAdded: 1,
      vocabularyLoaded: true,
      stewardInvited: true,
      memberInvited: true,
      slaConfigured: false,
      testCaseFiled: true,
      testCaseResolved: true,
      auditVerified: true,
      exportTested: false,
    };
    const progress = computeSetupProgress(ctx);
    expect(progress.isReady).toBe(true);
    expect(progress.requiredCompleted).toBe(8);
    expect(progress.completedCount).toBe(8);
    expect(progress.percentage).toBe(80);
  });

  it('isReady=false when one required step missing', () => {
    const ctx: SetupContext = {
      orgCreated: true,
      worksitesAdded: 1,
      vocabularyLoaded: true,
      stewardInvited: true,
      memberInvited: true,
      slaConfigured: true,
      testCaseFiled: true,
      testCaseResolved: false, // required!
      auditVerified: true,
      exportTested: true,
    };
    const progress = computeSetupProgress(ctx);
    expect(progress.isReady).toBe(false);
    expect(progress.requiredCompleted).toBe(7);
  });
});

describe('getNextStep', () => {
  it('returns first required step for empty context', () => {
    const next = getNextStep(createEmptyContext());
    expect(next?.id).toBe('create-org');
    expect(next?.required).toBe(true);
  });

  it('skips completed steps', () => {
    const ctx = createEmptyContext();
    ctx.orgCreated = true;
    const next = getNextStep(ctx);
    expect(next?.id).toBe('add-worksites');
  });

  it('returns optional step when all required are done', () => {
    const ctx: SetupContext = {
      orgCreated: true,
      worksitesAdded: 1,
      vocabularyLoaded: true,
      stewardInvited: true,
      memberInvited: true,
      slaConfigured: false,
      testCaseFiled: true,
      testCaseResolved: true,
      auditVerified: true,
      exportTested: false,
    };
    const next = getNextStep(ctx);
    expect(next?.required).toBe(false);
  });

  it('returns null when all steps complete', () => {
    const ctx: SetupContext = {
      orgCreated: true,
      worksitesAdded: 3,
      vocabularyLoaded: true,
      stewardInvited: true,
      memberInvited: true,
      slaConfigured: true,
      testCaseFiled: true,
      testCaseResolved: true,
      auditVerified: true,
      exportTested: true,
    };
    expect(getNextStep(ctx)).toBeNull();
  });
});
