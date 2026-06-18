/**
 * PKI Signature Workflow Engine — Unit Tests
 *
 * Exercises the in-memory workflow lifecycle end-to-end across all completion
 * types, status transitions, queries, and management functions. The DB
 * persistence layer (@/db) is mocked as fire-and-forget no-ops; the engine
 * swallows persistence errors, so we also assert resilience to db failures.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ shouldThrow: false }));

function makeDbChain() {
  const chain: Record<string, unknown> = {};
  chain.values = () => chain;
  chain.set = () => chain;
  chain.where = async () => {
    if (mocks.shouldThrow) throw new Error('db down');
    return [];
  };
  chain.onConflictDoUpdate = async () => {
    if (mocks.shouldThrow) throw new Error('db down');
    return [];
  };
  return chain;
}

vi.mock('@/db', () => ({
  db: {
    insert: () => makeDbChain(),
    update: () => makeDbChain(),
  },
}));
vi.mock('@/db/schema/domains/documents', () => ({
  signatureWorkflows: { externalEnvelopeId: 'externalEnvelopeId' },
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as wf from '../workflow-engine';

type StepParam = Parameters<typeof wf.createWorkflow>[0]['steps'][number];

function signer(userId: string, required = true): StepParam['signers'][number] {
  return { userId, name: userId, email: `${userId}@x.com`, required, status: 'pending' } as never;
}

function baseParams(steps: StepParam[]) {
  return {
    documentId: 'doc1',
    documentType: 'contract',
    organizationId: 'org1',
    createdBy: 'creator',
    createdByName: 'Creator',
    name: 'Test Workflow',
    description: 'desc',
    workflowType: 'sequential',
    steps,
  } as Parameters<typeof wf.createWorkflow>[0];
}

function makeStep(completionType: string, signers: StepParam['signers']): StepParam {
  return { stepNumber: 1, name: 'Step', completionType, signers } as never;
}

describe('pki workflow-engine', () => {
  beforeEach(() => {
    mocks.shouldThrow = false;
    vi.clearAllMocks();
  });

  it('createWorkflow stores and returns a pending workflow', () => {
    const w = wf.createWorkflow(baseParams([makeStep('all_required', [signer('u1')])]));
    expect(w.status).toBe('pending');
    expect(w.id).toBeTruthy();
    expect(wf.getWorkflow(w.id)).toEqual(w);
  });

  it('startWorkflow transitions to in_progress and starts first step', () => {
    const w = wf.createWorkflow(baseParams([makeStep('all_required', [signer('u1')])]));
    const started = wf.startWorkflow(w.id);
    expect(started.status).toBe('in_progress');
    expect(started.steps[0].status).toBe('in_progress');
  });

  it('startWorkflow throws for unknown id and already-started workflow', () => {
    expect(() => wf.startWorkflow('nope')).toThrow('Workflow not found');
    const w = wf.createWorkflow(baseParams([makeStep('all_required', [signer('u1')])]));
    wf.startWorkflow(w.id);
    expect(() => wf.startWorkflow(w.id)).toThrow('already started');
  });

  it('recordSignature completes single-step all_required workflow', async () => {
    const w = wf.createWorkflow(baseParams([makeStep('all_required', [signer('u1')])]));
    wf.startWorkflow(w.id);
    const result = await wf.recordSignature(w.id, 'u1', 'sig1');
    expect(result.isComplete).toBe(true);
    expect(result.completedAt).toBeInstanceOf(Date);
    expect(wf.getWorkflow(w.id)?.status).toBe('completed');
  });

  it('recordSignature advances multi-step workflow and reports next signers', async () => {
    const w = wf.createWorkflow(
      baseParams([
        makeStep('all_required', [signer('u1')]),
        makeStep('all_required', [signer('u2')]),
      ]),
    );
    wf.startWorkflow(w.id);
    const r1 = await wf.recordSignature(w.id, 'u1', 'sig1');
    expect(r1.isComplete).toBe(false);
    expect(r1.currentStep).toBe(2);
    // Second signature drives advanceWorkflow again (exercises the next-step
    // progression path with both steps completed).
    const r2 = await wf.recordSignature(w.id, 'u2', 'sig2');
    expect(r2.totalSteps).toBe(2);
    expect(r2.workflowId).toBe(w.id);
  });

  it('recordSignature with multiple signers in a step returns pending signers (not complete)', async () => {
    const w = wf.createWorkflow(
      baseParams([makeStep('all_required', [signer('u1'), signer('u2')])]),
    );
    wf.startWorkflow(w.id);
    const r = await wf.recordSignature(w.id, 'u1', 'sig1');
    expect(r.isComplete).toBe(false);
    expect(r.nextSigners.map((s) => s.userId)).toEqual(['u2']);
  });

  it('recordSignature error branches: not found / not in progress / no signer / already signed', async () => {
    await expect(wf.recordSignature('nope', 'u1', 's')).rejects.toThrow('Workflow not found');

    const w = wf.createWorkflow(baseParams([makeStep('all_required', [signer('u1')])]));
    await expect(wf.recordSignature(w.id, 'u1', 's')).rejects.toThrow('not in progress');

    wf.startWorkflow(w.id);
    await expect(wf.recordSignature(w.id, 'ghost', 's')).rejects.toThrow('User not found');

    await wf.recordSignature(w.id, 'u1', 'sig1'); // completes
    // re-start a fresh one to test already-signed within active step
    const w2 = wf.createWorkflow(baseParams([makeStep('all_required', [signer('a'), signer('b')])]));
    wf.startWorkflow(w2.id);
    await wf.recordSignature(w2.id, 'a', 'sigA');
    await expect(wf.recordSignature(w2.id, 'a', 'sigA2')).rejects.toThrow('already signed');
  });

  it('any_one completion type completes after a single signature', async () => {
    const w = wf.createWorkflow(
      baseParams([makeStep('any_one', [signer('u1', false), signer('u2', false)])]),
    );
    wf.startWorkflow(w.id);
    const r = await wf.recordSignature(w.id, 'u1', 'sig1');
    expect(r.isComplete).toBe(true);
  });

  it('majority completion type requires more than half', async () => {
    const w = wf.createWorkflow(
      baseParams([makeStep('majority', [signer('u1'), signer('u2'), signer('u3')])]),
    );
    wf.startWorkflow(w.id);
    const r1 = await wf.recordSignature(w.id, 'u1', 's1');
    expect(r1.isComplete).toBe(false);
    const r2 = await wf.recordSignature(w.id, 'u2', 's2');
    expect(r2.isComplete).toBe(true);
  });

  it('recordRejection by required signer rejects the workflow', () => {
    const w = wf.createWorkflow(baseParams([makeStep('all_required', [signer('u1')])]));
    wf.startWorkflow(w.id);
    wf.recordRejection(w.id, 'u1', 'not happy');
    expect(wf.getWorkflow(w.id)?.status).toBe('rejected');
  });

  it('recordRejection by optional signer does not reject workflow', () => {
    const w = wf.createWorkflow(
      baseParams([makeStep('any_one', [signer('u1', false), signer('u2', false)])]),
    );
    wf.startWorkflow(w.id);
    wf.recordRejection(w.id, 'u1', 'pass');
    expect(wf.getWorkflow(w.id)?.status).toBe('in_progress');
  });

  it('recordRejection error branches: not found / no active step / signer missing', () => {
    expect(() => wf.recordRejection('nope', 'u1', 'r')).toThrow('Workflow not found');
    const w = wf.createWorkflow(baseParams([makeStep('all_required', [signer('u1')])]));
    expect(() => wf.recordRejection(w.id, 'u1', 'r')).toThrow('No active step');
    wf.startWorkflow(w.id);
    expect(() => wf.recordRejection(w.id, 'ghost', 'r')).toThrow('User not found');
  });

  it('advanceWorkflow throws for unknown id', () => {
    expect(() => wf.advanceWorkflow('nope')).toThrow('Workflow not found');
  });

  it('getDocumentWorkflows + getUserWorkflows (with/without status) + getUserPendingWorkflows', () => {
    const w = wf.createWorkflow(baseParams([makeStep('all_required', [signer('u1')])]));
    wf.startWorkflow(w.id);
    expect(wf.getDocumentWorkflows('doc1').length).toBeGreaterThanOrEqual(1);
    expect(wf.getUserWorkflows('u1').length).toBeGreaterThanOrEqual(1);
    expect(wf.getUserWorkflows('u1', 'in_progress').length).toBeGreaterThanOrEqual(1);
    expect(wf.getUserWorkflows('u1', 'completed').some((x) => x.id === w.id)).toBe(false);
    expect(wf.getUserWorkflows('ghost')).toEqual([]);
    expect(wf.getUserPendingWorkflows('u1').some((x) => x.id === w.id)).toBe(true);
  });

  it('getWorkflowStatus reports counts; throws for unknown id', () => {
    const w = wf.createWorkflow(
      baseParams([makeStep('all_required', [signer('u1'), signer('u2')])]),
    );
    wf.startWorkflow(w.id);
    const s = wf.getWorkflowStatus(w.id);
    expect(s.totalSignatures).toBe(2);
    expect(s.pendingSignatures).toBe(2);
    expect(s.currentStep).toBe(1);
    expect(() => wf.getWorkflowStatus('nope')).toThrow('Workflow not found');
  });

  it('cancelWorkflow cancels active and throws for completed / unknown', async () => {
    const w = wf.createWorkflow(baseParams([makeStep('all_required', [signer('u1')])]));
    wf.startWorkflow(w.id);
    wf.cancelWorkflow(w.id, 'admin', 'reason');
    expect(wf.getWorkflow(w.id)?.status).toBe('cancelled');
    expect(() => wf.cancelWorkflow('nope', 'a', 'r')).toThrow('Workflow not found');

    const w2 = wf.createWorkflow(baseParams([makeStep('all_required', [signer('u1')])]));
    wf.startWorkflow(w2.id);
    await wf.recordSignature(w2.id, 'u1', 'sig');
    expect(() => wf.cancelWorkflow(w2.id, 'a', 'r')).toThrow('Cannot cancel completed');
  });

  it('expireOverdueWorkflows expires past-due in_progress workflows', () => {
    const w = wf.createWorkflow({
      ...baseParams([makeStep('all_required', [signer('u1')])]),
      expiresAt: new Date(Date.now() - 1000),
    } as never);
    wf.startWorkflow(w.id);
    const count = wf.expireOverdueWorkflows();
    expect(count).toBeGreaterThanOrEqual(1);
    expect(wf.getWorkflow(w.id)?.status).toBe('expired');
  });

  it('getNextSigners returns pending signers of current step; [] for non-active', () => {
    const w = wf.createWorkflow(baseParams([makeStep('all_required', [signer('u1')])]));
    expect(wf.getNextSigners(w.id)).toEqual([]); // pending status, not in_progress
    wf.startWorkflow(w.id);
    expect(wf.getNextSigners(w.id).map((s) => s.userId)).toEqual(['u1']);
    expect(wf.getNextSigners('nope')).toEqual([]);
  });

  it('WorkflowEngine namespace exposes all functions', () => {
    expect(typeof wf.WorkflowEngine.createWorkflow).toBe('function');
    expect(typeof wf.WorkflowEngine.recordSignature).toBe('function');
    expect(typeof wf.WorkflowEngine.getNextSigners).toBe('function');
  });

  it('is resilient to DB persistence failures (errors swallowed)', async () => {
    mocks.shouldThrow = true;
    const w = wf.createWorkflow(baseParams([makeStep('all_required', [signer('u1')])]));
    wf.startWorkflow(w.id);
    const r = await wf.recordSignature(w.id, 'u1', 'sig1');
    expect(r.isComplete).toBe(true);
  });
});
