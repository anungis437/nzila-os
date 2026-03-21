# How-To: Create a Model Card

Every AI/ML model deployed on Nzila **must** have a Model Card before it can
transition from `review` → `approved` in the governance lifecycle.

## Step 1: Assess Risk

```typescript
import { classifyRisk } from '@nzila/ai-registry/risk-classification';

const risk = classifyRisk({
  modelId: 'my-model-v1',
  classifiedBy: 'you@nzila.io',
  autonomyLevel: 30,       // 0-100: how much autonomous decision-making
  dataClassification: 33,  // 0=public, 33=internal, 66=sensitive, 100=regulated
  impactScope: 40,         // number of affected users/orgs
  reversibility: 20,       // 0=fully reversible, 100=irreversible
  transparency: 30,        // 0=interpretable, 100=black box
  biasRisk: 20,            // demographic bias potential
  safetyImpact: 10,        // physical/financial safety impact
});

console.log(risk.riskLevel);       // 'medium'
console.log(risk.requiredControls); // ['audit-logging', 'pii-redaction', ...]
```

## Step 2: Create the Model Card

```typescript
import { createModelCard } from '@nzila/ai-registry/model-card';

const card = createModelCard({
  modelId: 'my-model-v1',
  displayName: 'My Model v1',
  version: '1.0.0',
  provider: 'azure-openai',
  modality: 'text',
  purpose: 'Summarize procurement documents',
  intendedUse: 'Procurement analysis within trade app',
  outOfScopeUse: ['Legal advice', 'Financial recommendations'],
  riskTier: risk.riskLevel,
  dataClassification: 'internal',
  inputFormat: 'text/plain (max 4000 tokens)',
  outputFormat: 'text/plain summary',
  metrics: {
    accuracy: 0.92,
    latencyP50Ms: 800,
    latencyP99Ms: 3200,
    costPerRequest: 0.003,
  },
  limitations: [
    {
      category: 'accuracy',
      description: 'May miss context in documents over 10 pages',
      severity: 'medium',
      mitigation: 'RAG chunking with overlap',
    },
  ],
  safetyMeasures: [
    {
      measure: 'PII redacted from inputs and outputs',
      type: 'pii-redaction',
      enforced: true,
      enforcementLayer: 'gateway',
    },
    {
      measure: 'Budget cap of $50/month per org',
      type: 'budget-cap',
      enforced: true,
      enforcementLayer: 'gateway',
    },
  ],
  governance: {
    humanOversight: true,
    auditLogging: true,
    appealAvailable: false,
    dataRetentionDays: 90,
    complianceFrameworks: ['NIST AI RMF', 'SOC 2 Type II'],
  },
  owner: 'your-team',
  team: 'platform',
  status: 'draft',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
```

## Step 3: Run NIST AI RMF Assessment

```typescript
import { evaluateNistRmf } from '@nzila/ai-registry/nist-rmf';

const assessment = evaluateNistRmf(card, 'you@nzila.io');
console.log(`Maturity: ${assessment.overallMaturity}%`);
console.log('Gaps:', assessment.gaps);
console.log('Recommendations:', assessment.recommendations);
```

## Step 4: Submit for Governance Review

```typescript
import { GovernanceLifecycle } from '@nzila/ai-registry/governance-lifecycle';

const lifecycle = new GovernanceLifecycle();

// Submit for review
lifecycle.transition({
  modelId: 'my-model-v1',
  fromState: 'draft',
  toState: 'review',
  actor: 'you@nzila.io',
  actorRole: 'ai_developer',
  reason: 'Model card complete, NIST assessment passed',
  riskTier: risk.riskLevel,
});
```

## Governance Rules

| Risk Tier | Approvers Required | Required Roles |
|-----------|-------------------|----------------|
| Low | 1 | `org_admin` |
| Medium | 1 | `org_admin` |
| High | 2 | `org_admin` + `platform_admin` |
| Critical | 3 | `org_admin` + `platform_admin` + `compliance_officer` |
