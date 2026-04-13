/**
 * AI Registry — Test Suite
 */

import { describe, it, expect } from 'vitest';
import { createModelCard } from '../model-card.js';
import { classifyRisk, RISK_THRESHOLDS } from '../risk-classification.js';
import { GovernanceLifecycle } from '../governance-lifecycle.js';
import { evaluateNistRmf } from '../nist-rmf.js';

// ── Model Card Tests ─────────────────────────────────────────────────────────

describe('createModelCard', () => {
  const baseCard = {
    modelId: 'gpt-4o-nzila',
    displayName: 'GPT-4o (Nzila Gateway)',
    version: '1.0.0',
    provider: 'azure-openai' as const,
    modality: 'text' as const,
    purpose: 'General-purpose text generation for Nzila platform',
    intendedUse: 'Procurement analysis, document summarization, trade compliance',
    outOfScopeUse: ['Medical advice', 'Legal decisions', 'Autonomous financial transactions'],
    riskTier: 'medium' as const,
    dataClassification: 'internal' as const,
    inputFormat: 'text/plain or JSON',
    outputFormat: 'text/plain or JSON',
    limitations: [
      {
        category: 'accuracy' as const,
        description: 'May hallucinate procurement regulations',
        severity: 'medium' as const,
        mitigation: 'RAG with verified regulation database',
      },
    ],
    safetyMeasures: [
      {
        measure: 'PII redaction on all inputs/outputs',
        type: 'pii-redaction' as const,
        enforced: true,
        enforcementLayer: 'gateway' as const,
      },
    ],
    governance: {
      humanOversight: true,
      auditLogging: true,
      appealAvailable: false,
      dataRetentionDays: 90,
      complianceFrameworks: ['NIST AI RMF', 'SOC 2 Type II'],
    },
    owner: 'ai-platform-team',
    team: 'platform',
    status: 'approved' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('creates a valid model card', () => {
    const card = createModelCard(baseCard);
    expect(card.modelId).toBe('gpt-4o-nzila');
    expect(card.riskTier).toBe('medium');
  });

  it('creates a valid high-risk model card with proper governance', () => {
    const card = createModelCard({
      ...baseCard,
      riskTier: 'high',
      dataClassification: 'sensitive',
    });
    expect(card.riskTier).toBe('high');
    expect(card.governance.humanOversight).toBe(true);
    expect(card.governance.auditLogging).toBe(true);
  });

  it('rejects high-risk model without human oversight', () => {
    expect(() =>
      createModelCard({
        ...baseCard,
        riskTier: 'high',
        governance: { ...baseCard.governance, humanOversight: false },
      }),
    ).toThrow('humanOversight=true');
  });

  it('rejects sensitive data model without PII redaction', () => {
    expect(() =>
      createModelCard({
        ...baseCard,
        dataClassification: 'sensitive',
        safetyMeasures: [],
      }),
    ).toThrow('PII redaction');
  });

  it('rejects high-risk model without audit logging', () => {
    expect(() =>
      createModelCard({
        ...baseCard,
        riskTier: 'high',
        governance: { ...baseCard.governance, humanOversight: true, auditLogging: false },
      }),
    ).toThrow('auditLogging=true');
  });

  it('rejects critical-risk model without audit logging', () => {
    expect(() =>
      createModelCard({
        ...baseCard,
        riskTier: 'critical',
        governance: { ...baseCard.governance, humanOversight: true, auditLogging: false },
      }),
    ).toThrow('auditLogging=true');
  });

  it('rejects regulated data with non-PII safety measures only', () => {
    expect(() =>
      createModelCard({
        ...baseCard,
        dataClassification: 'regulated',
        safetyMeasures: [
          { measure: 'Rate limit', type: 'rate-limiting', enforced: true, enforcementLayer: 'gateway' },
        ],
      }),
    ).toThrow('PII redaction');
  });

  it('allows sensitive data model with enforced PII redaction', () => {
    const card = createModelCard({
      ...baseCard,
      dataClassification: 'sensitive',
      safetyMeasures: [
        { measure: 'PII redaction', type: 'pii-redaction', enforced: true, enforcementLayer: 'gateway' },
      ],
    });
    expect(card.dataClassification).toBe('sensitive');
  });
});

// ── Risk Classification Tests ────────────────────────────────────────────────

describe('classifyRisk', () => {
  it('classifies low-risk model correctly', () => {
    const result = classifyRisk({
      modelId: 'embeddings-v1',
      classifiedBy: 'test',
      autonomyLevel: 5,
      dataClassification: 0,
      impactScope: 10,
      reversibility: 0,
      transparency: 10,
      biasRisk: 5,
      safetyImpact: 0,
    });

    expect(result.riskLevel).toBe('low');
    expect(result.overallScore).toBeLessThan(RISK_THRESHOLDS.medium.min);
    expect(result.requiredControls).toContain('audit-logging');
  });

  it('classifies high-risk model correctly', () => {
    const result = classifyRisk({
      modelId: 'trade-compliance-v1',
      classifiedBy: 'test',
      autonomyLevel: 80,
      dataClassification: 66,
      impactScope: 70,
      reversibility: 60,
      transparency: 50,
      biasRisk: 40,
      safetyImpact: 60,
    });

    expect(result.riskLevel).toBe('high');
    expect(result.requiredControls).toContain('human-review');
    expect(result.requiredControls).toContain('model-card-required');
  });

  it('includes all required factors', () => {
    const result = classifyRisk({
      modelId: 'test',
      classifiedBy: 'test',
      autonomyLevel: 50,
      dataClassification: 50,
      impactScope: 50,
      reversibility: 50,
      transparency: 50,
      biasRisk: 50,
      safetyImpact: 50,
    });

    expect(result.factors).toHaveLength(7);
    const totalWeight = result.factors.reduce((sum, f) => sum + f.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0);
  });

  it('classifies critical-risk model correctly', () => {
    const result = classifyRisk({
      modelId: 'autonomous-v1',
      classifiedBy: 'test',
      autonomyLevel: 100,
      dataClassification: 100,
      impactScope: 100,
      reversibility: 100,
      transparency: 100,
      biasRisk: 100,
      safetyImpact: 100,
    });

    expect(result.riskLevel).toBe('critical');
    expect(result.overallScore).toBeGreaterThanOrEqual(75);
    expect(result.requiredControls).toContain('red-team-testing');
  });

  it('classifies medium-risk model correctly', () => {
    const result = classifyRisk({
      modelId: 'assist-v1',
      classifiedBy: 'test',
      autonomyLevel: 30,
      dataClassification: 33,
      impactScope: 25,
      reversibility: 30,
      transparency: 30,
      biasRisk: 25,
      safetyImpact: 25,
    });

    expect(result.riskLevel).toBe('medium');
    expect(result.overallScore).toBeGreaterThanOrEqual(25);
    expect(result.overallScore).toBeLessThan(50);
    expect(result.requiredControls).toContain('pii-redaction');
  });
});

// ── Governance Lifecycle Tests ───────────────────────────────────────────────

describe('GovernanceLifecycle', () => {
  it('allows valid transition draft → review', () => {
    const lifecycle = new GovernanceLifecycle();
    const event = lifecycle.transition({
      modelId: 'test-model',
      fromState: 'draft',
      toState: 'review',
      actor: 'dev@nzila.io',
      actorRole: 'ai_developer',
      reason: 'Ready for review',
      riskTier: 'medium',
      approvers: [],
    });

    expect(event.toState).toBe('review');
    expect(lifecycle.getCurrentState('test-model')).toBe('review');
  });

  it('rejects invalid transition draft → deployed', () => {
    const lifecycle = new GovernanceLifecycle();
    expect(() =>
      lifecycle.transition({
        modelId: 'test-model',
        fromState: 'draft',
        toState: 'deployed',
        actor: 'dev@nzila.io',
        actorRole: 'ai_developer',
        reason: 'Skip review',
        riskTier: 'low',
        approvers: [],
      }),
    ).toThrow('Invalid transition');
  });

  it('enforces approval requirements for high-risk models', () => {
    const lifecycle = new GovernanceLifecycle();
    expect(() =>
      lifecycle.transition({
        modelId: 'test-model',
        fromState: 'review',
        toState: 'approved',
        actor: 'admin@nzila.io',
        actorRole: 'org_admin',
        reason: 'Approved',
        riskTier: 'high',
        approvers: ['admin@nzila.io'], // Only 1, needs 2
      }),
    ).toThrow('requires 2 approver(s)');
  });

  it('allows approval with sufficient approvers for high-risk models', () => {
    const lifecycle = new GovernanceLifecycle();
    const event = lifecycle.transition({
      modelId: 'test-model',
      fromState: 'review',
      toState: 'approved',
      actor: 'admin@nzila.io',
      actorRole: 'org_admin',
      reason: 'Approved after review',
      riskTier: 'high',
      approvers: ['admin@nzila.io', 'platform@nzila.io'],
    });

    expect(event.toState).toBe('approved');
  });

  it('tracks full audit trail', () => {
    const lifecycle = new GovernanceLifecycle();

    lifecycle.transition({
      modelId: 'audit-model',
      fromState: 'draft',
      toState: 'review',
      actor: 'dev@nzila.io',
      actorRole: 'ai_developer',
      reason: 'Submit for review',
      riskTier: 'low',
    });

    lifecycle.transition({
      modelId: 'audit-model',
      fromState: 'review',
      toState: 'approved',
      actor: 'admin@nzila.io',
      actorRole: 'org_admin',
      reason: 'Approved',
      riskTier: 'low',
      approvers: ['admin@nzila.io'],
    });

    const history = lifecycle.getHistory('audit-model');
    expect(history).toHaveLength(2);
    expect(history[0]!.toState).toBe('review');
    expect(history[1]!.toState).toBe('approved');
  });

  it('returns undefined for model with no events', () => {
    const lifecycle = new GovernanceLifecycle();
    expect(lifecycle.getCurrentState('nonexistent')).toBeUndefined();
  });

  it('returns available transitions from a given state', () => {
    const lifecycle = new GovernanceLifecycle();
    const transitions = lifecycle.getAvailableTransitions('deployed');
    expect(transitions.length).toBeGreaterThan(0);
    expect(transitions.map(t => t.to)).toContain('deprecated');
    expect(transitions.map(t => t.to)).toContain('approved');
  });
});

// ── NIST AI RMF Tests ────────────────────────────────────────────────────────

describe('evaluateNistRmf', () => {
  it('produces assessment with maturity score', () => {
    const card = createModelCard({
      modelId: 'nist-test',
      displayName: 'NIST Test Model',
      version: '1.0.0',
      provider: 'azure-openai',
      modality: 'text',
      purpose: 'Testing',
      intendedUse: 'Unit tests',
      outOfScopeUse: [],
      riskTier: 'low',
      dataClassification: 'public',
      inputFormat: 'text',
      outputFormat: 'text',
      limitations: [
        { category: 'accuracy', description: 'Test', severity: 'low' },
      ],
      safetyMeasures: [
        { measure: 'Input filter', type: 'input-filtering', enforced: true, enforcementLayer: 'gateway' },
      ],
      governance: {
        humanOversight: false,
        auditLogging: true,
        appealAvailable: false,
        dataRetentionDays: 30,
        complianceFrameworks: ['NIST AI RMF'],
      },
      owner: 'test',
      team: 'test',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const assessment = evaluateNistRmf(card, 'test@nzila.io');
    expect(assessment.overallMaturity).toBeGreaterThan(0);
    expect(assessment.categories.length).toBeGreaterThan(10);
    expect(assessment.modelId).toBe('nist-test');
  });

  it('identifies gaps for models missing metrics', () => {
    const card = createModelCard({
      modelId: 'gap-test',
      displayName: 'Gap Test',
      version: '1.0.0',
      provider: 'internal',
      modality: 'classification',
      purpose: 'Test',
      intendedUse: 'Test',
      outOfScopeUse: [],
      riskTier: 'low',
      dataClassification: 'public',
      inputFormat: 'JSON',
      outputFormat: 'JSON',
      limitations: [],
      safetyMeasures: [],
      governance: {
        humanOversight: false,
        auditLogging: false,
        appealAvailable: false,
        dataRetentionDays: 7,
        complianceFrameworks: [],
      },
      owner: 'test',
      team: 'test',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const assessment = evaluateNistRmf(card, 'test@nzila.io');
    expect(assessment.gaps.length).toBeGreaterThan(0);
    expect(assessment.recommendations.length).toBeGreaterThan(0);
  });

  it('flags humanOversight gap for non-low-risk model', () => {
    const card = createModelCard({
      modelId: 'nist-medium',
      displayName: 'NIST Medium Test',
      version: '1.0.0',
      provider: 'internal',
      modality: 'text',
      purpose: 'Test',
      intendedUse: 'Test',
      outOfScopeUse: [],
      riskTier: 'medium',
      dataClassification: 'internal',
      inputFormat: 'text',
      outputFormat: 'text',
      limitations: [
        { category: 'accuracy', description: 'Test', severity: 'low' },
      ],
      safetyMeasures: [
        { measure: 'Filter', type: 'input-filtering', enforced: true, enforcementLayer: 'gateway' },
      ],
      governance: {
        humanOversight: false,
        auditLogging: true,
        appealAvailable: false,
        dataRetentionDays: 30,
        complianceFrameworks: ['NIST AI RMF'],
      },
      owner: 'test',
      team: 'test',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const assessment = evaluateNistRmf(card, 'test@nzila.io');
    expect(assessment.gaps).toContain('GOVERN-2: No human oversight for non-low-risk model');
    expect(assessment.recommendations).toContain('Enable humanOversight in model governance settings');
  });

  it('produces clean assessment when model has metrics and full governance', () => {
    const card = createModelCard({
      modelId: 'nist-full',
      displayName: 'Full Model',
      version: '1.0.0',
      provider: 'azure-openai',
      modality: 'text',
      purpose: 'Test',
      intendedUse: 'Test',
      outOfScopeUse: [],
      riskTier: 'low',
      dataClassification: 'public',
      inputFormat: 'text',
      outputFormat: 'text',
      metrics: {
        accuracy: 0.95,
        latencyP50Ms: 200,
        lastEvaluated: new Date().toISOString(),
      },
      limitations: [
        { category: 'accuracy', description: 'Test', severity: 'low' },
      ],
      safetyMeasures: [
        { measure: 'Filter', type: 'input-filtering', enforced: true, enforcementLayer: 'gateway' },
      ],
      governance: {
        humanOversight: true,
        auditLogging: true,
        appealAvailable: false,
        dataRetentionDays: 30,
        complianceFrameworks: ['NIST AI RMF'],
      },
      owner: 'test',
      team: 'test',
      status: 'deployed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const assessment = evaluateNistRmf(card, 'test@nzila.io');
    expect(assessment.gaps).toHaveLength(0);
    expect(assessment.recommendations).toHaveLength(0);
  });
});
