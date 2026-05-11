/**
 * CUPE Pilot Setup Checklist — PR-061
 *
 * Logic layer for the first-run setup checklist that guides
 * administrators through pilot onboarding.
 *
 * The UI component consumes this; the logic is separated
 * for testability.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  category: 'organization' | 'users' | 'configuration' | 'validation';
  required: boolean;
  checkFn: (ctx: SetupContext) => boolean;
}

export interface SetupContext {
  orgCreated: boolean;
  orgName: string | null;
  worksitesCount: number;
  usersInvited: number;
  vocabularyLoaded: boolean;
  slaConfigured: boolean;
  testCaseFiled: boolean;
  testCaseResolved: boolean;
  auditTrailVerified: boolean;
  exportTested: boolean;
}

export interface SetupProgress {
  completedCount: number;
  totalCount: number;
  requiredCompletedCount: number;
  requiredTotalCount: number;
  percentage: number;
  isReady: boolean;
  steps: { step: SetupStep; completed: boolean }[];
}

// ---------------------------------------------------------------------------
// Steps Definition
// ---------------------------------------------------------------------------

export const SETUP_STEPS: SetupStep[] = [
  {
    id: 'create-org',
    title: 'Create pilot organization',
    description: 'Create the CUPE Local organization in the admin console.',
    category: 'organization',
    required: true,
    checkFn: (ctx) => ctx.orgCreated,
  },
  {
    id: 'add-worksites',
    title: 'Add at least one worksite',
    description: 'Configure the worksites where grievances may originate.',
    category: 'organization',
    required: true,
    checkFn: (ctx) => ctx.worksitesCount >= 1,
  },
  {
    id: 'load-vocabulary',
    title: 'Load CUPE vocabulary',
    description: 'Seed the CUPE taxonomy (case types, priorities, severities, roles, statuses).',
    category: 'configuration',
    required: true,
    checkFn: (ctx) => ctx.vocabularyLoaded,
  },
  {
    id: 'invite-steward',
    title: 'Invite at least one representative',
    description: 'Invite a union representative who will triage and manage cases.',
    category: 'users',
    required: true,
    checkFn: (ctx) => ctx.usersInvited >= 1,
  },
  {
    id: 'invite-member',
    title: 'Invite at least one member',
    description: 'Invite a union member who will file grievances.',
    category: 'users',
    required: true,
    checkFn: (ctx) => ctx.usersInvited >= 2,
  },
  {
    id: 'configure-sla',
    title: 'Review SLA thresholds',
    description: 'Verify that acknowledgement (2 days) and resolution (3/7/14/30 days by priority) thresholds are appropriate.',
    category: 'configuration',
    required: false,
    checkFn: (ctx) => ctx.slaConfigured,
  },
  {
    id: 'file-test-case',
    title: 'File a test case',
    description: 'Create a test grievance to verify the intake form works.',
    category: 'validation',
    required: true,
    checkFn: (ctx) => ctx.testCaseFiled,
  },
  {
    id: 'resolve-test-case',
    title: 'Resolve the test case',
    description: 'Walk the test case through the full workflow to resolution.',
    category: 'validation',
    required: true,
    checkFn: (ctx) => ctx.testCaseResolved,
  },
  {
    id: 'verify-audit',
    title: 'Verify audit trail',
    description: 'Check the case timeline to confirm all actions were logged.',
    category: 'validation',
    required: true,
    checkFn: (ctx) => ctx.auditTrailVerified,
  },
  {
    id: 'test-export',
    title: 'Test evidence export',
    description: 'Export a case evidence pack and verify the seal is valid.',
    category: 'validation',
    required: false,
    checkFn: (ctx) => ctx.exportTested,
  },
];

// ---------------------------------------------------------------------------
// Progress Computation
// ---------------------------------------------------------------------------

/**
 * Compute setup progress from the current context.
 */
export function computeSetupProgress(ctx: SetupContext): SetupProgress {
  const steps = SETUP_STEPS.map((step) => ({
    step,
    completed: step.checkFn(ctx),
  }));

  const completedCount = steps.filter((s) => s.completed).length;
  const requiredSteps = steps.filter((s) => s.step.required);
  const requiredCompletedCount = requiredSteps.filter((s) => s.completed).length;

  return {
    completedCount,
    totalCount: steps.length,
    requiredCompletedCount,
    requiredTotalCount: requiredSteps.length,
    percentage: steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0,
    isReady: requiredSteps.every((s) => s.completed),
    steps,
  };
}

/**
 * Get the next incomplete required step (for guided flow).
 */
export function getNextStep(ctx: SetupContext): SetupStep | null {
  for (const step of SETUP_STEPS) {
    if (step.required && !step.checkFn(ctx)) {
      return step;
    }
  }
  return null;
}

/**
 * Create a fresh (empty) setup context.
 */
export function createEmptyContext(): SetupContext {
  return {
    orgCreated: false,
    orgName: null,
    worksitesCount: 0,
    usersInvited: 0,
    vocabularyLoaded: false,
    slaConfigured: false,
    testCaseFiled: false,
    testCaseResolved: false,
    auditTrailVerified: false,
    exportTested: false,
  };
}
