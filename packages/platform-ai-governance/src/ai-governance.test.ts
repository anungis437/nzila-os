import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerModel,
  approveModel,
  getModel,
  listModels,
  clearRegistry,
} from '../src/modelRegistry'
import {
  createPromptVersion,
  getActivePrompt,
  getPromptHistory,
  clearPromptVersions,
} from '../src/promptVersioning'
import {
  logAIDecision,
  getDecisionsPendingReview,
  reviewDecision,
  getDecisionLog,
  clearDecisionLog,
} from '../src/decisionLog'
import {
  flagForReview,
  resolveReviewFlag,
  getPendingReviewFlags,
  clearReviewFlags,
} from '../src/humanReview'
import {
  modelRegistryEntrySchema,
  promptVersionSchema,
  aiDecisionLogEntrySchema,
  humanReviewFlagSchema,
} from '../src/types'
import * as governanceIndex from '../src'

describe('platform-ai-governance', () => {
  beforeEach(() => {
    clearRegistry()
    clearPromptVersions()
    clearDecisionLog()
    clearReviewFlags()
  })

  describe('modelRegistry', () => {
    it('registers a model', () => {
      const model = registerModel({
        name: 'gpt-4o',
        version: '2025-01',
        provider: 'azure-openai',
        capabilities: ['text-generation', 'summarization'],
        riskLevel: 'medium',
      })
      expect(model.id).toBeTruthy()
      expect(model.approvedForProduction).toBe(false)
    })

    it('approves a model for production', () => {
      const model = registerModel({
        name: 'gpt-4o-mini',
        version: '2025-01',
        provider: 'azure-openai',
        capabilities: ['text-generation'],
        riskLevel: 'low',
      })
      const approved = approveModel(model.id)
      expect(approved?.approvedForProduction).toBe(true)
      expect(approved?.lastAuditedAt).toBeTruthy()
    })

    it('filters approved models', () => {
      const m1 = registerModel({ name: 'a', version: '1', provider: 'p', capabilities: [], riskLevel: 'low' })
      registerModel({ name: 'b', version: '1', provider: 'p', capabilities: [], riskLevel: 'low' })
      approveModel(m1.id)

      const approved = listModels({ approvedOnly: true })
      expect(approved).toHaveLength(1)
    })

    it('returns undefined for unknown model approval and supports provider/getModel filters', () => {
      expect(approveModel('missing-model')).toBeUndefined()

      const model = registerModel({ name: 'c', version: '2', provider: 'azure', capabilities: ['chat'], riskLevel: 'medium' })
      registerModel({ name: 'd', version: '1', provider: 'openai', capabilities: ['chat'], riskLevel: 'low' })

      expect(getModel(model.id)?.name).toBe('c')
      expect(getModel('missing-model')).toBeUndefined()
      expect(listModels({ provider: 'azure' })).toHaveLength(1)
      expect(listModels({ approvedOnly: false })).toHaveLength(2)
    })
  })

  describe('promptVersioning', () => {
    it('creates versioned prompts', () => {
      const v1 = createPromptVersion({
        promptName: 'quote-summary',
        template: 'Summarize: {{input}}',
        author: 'admin',
        changeReason: 'Initial version',
      })
      expect(v1.version).toBe(1)
      expect(v1.active).toBe(true)
    })

    it('deactivates previous version on new creation', () => {
      createPromptVersion({
        promptName: 'quote-summary',
        template: 'v1',
        author: 'admin',
        changeReason: 'v1',
      })
      const v2 = createPromptVersion({
        promptName: 'quote-summary',
        template: 'v2',
        author: 'admin',
        changeReason: 'v2',
      })

      expect(v2.version).toBe(2)
      const active = getActivePrompt('quote-summary')
      expect(active?.version).toBe(2)
    })

    it('returns prompt history', () => {
      createPromptVersion({ promptName: 'x', template: 'a', author: 'a', changeReason: 'a' })
      createPromptVersion({ promptName: 'x', template: 'b', author: 'a', changeReason: 'b' })
      const history = getPromptHistory('x')
      expect(history).toHaveLength(2)
      expect(history[0].version).toBe(2) // newest first
    })

    it('does not deactivate unrelated prompt names', () => {
      const x = createPromptVersion({ promptName: 'x', template: 'x1', author: 'a', changeReason: 'x1' })
      const y = createPromptVersion({ promptName: 'y', template: 'y1', author: 'a', changeReason: 'y1' })
      expect(getActivePrompt('x')?.id).toBe(x.id)
      expect(getActivePrompt('y')?.id).toBe(y.id)
    })
  })

  describe('decisionLog', () => {
    it('flags low-confidence decisions for review', () => {
      const decision = logAIDecision({
        modelId: 'm1',
        promptId: 'p1',
        app: 'cfo',
        orgId: 'org-1',
        inputSummary: 'Analyze Q4',
        outputSummary: 'Revenue increased',
        confidence: 0.5,
      })
      expect(decision.requiresHumanReview).toBe(true)
      expect(decision.reviewStatus).toBe('pending')
    })

    it('does not flag high-confidence decisions for immediate review but still requires human review', () => {
      const decision = logAIDecision({
        modelId: 'm1',
        promptId: 'p1',
        app: 'web',
        orgId: 'org-1',
        inputSummary: 'Test',
        outputSummary: 'Result',
        confidence: 0.95,
      })
      expect(decision.requiresHumanReview).toBe(true)
      expect(decision.reviewStatus).toBeUndefined()
    })

    it('reviews a decision', () => {
      const decision = logAIDecision({
        modelId: 'm1',
        promptId: 'p1',
        app: 'cfo',
        orgId: 'org-1',
        inputSummary: 'Test',
        outputSummary: 'Result',
        confidence: 0.4,
      })
      const reviewed = reviewDecision(decision.id, {
        status: 'approved',
        reviewedBy: 'analyst',
      })
      expect(reviewed?.reviewStatus).toBe('approved')
      expect(reviewed?.reviewedBy).toBe('analyst')
    })

    it('returns undefined when reviewing unknown decision', () => {
      const reviewed = reviewDecision('missing', {
        status: 'rejected',
        reviewedBy: 'auditor',
      })
      expect(reviewed).toBeUndefined()
    })

    it('stores modelVersion, engineVersion, and evidenceRefs', () => {
      const decision = logAIDecision({
        modelId: 'm1',
        promptId: 'p1',
        app: 'cfo',
        orgId: 'org-1',
        inputSummary: 'Test',
        outputSummary: 'Result',
        confidence: 0.9,
        modelVersion: 'gpt-4o-2025-01',
        engineVersion: '1.2.0',
        evidenceRefs: ['evidence-pack-001', 'audit-trail-002'],
      })
      expect(decision.modelVersion).toBe('gpt-4o-2025-01')
      expect(decision.engineVersion).toBe('1.2.0')
      expect(decision.evidenceRefs).toHaveLength(2)
    })

    it('filters decision log and pending reviews', () => {
      logAIDecision({
        modelId: 'm1',
        promptId: 'p1',
        app: 'cfo',
        orgId: 'org-1',
        inputSummary: 'Low confidence',
        outputSummary: 'Needs check',
        confidence: 0.2,
      })
      logAIDecision({
        modelId: 'm2',
        promptId: 'p2',
        app: 'web',
        orgId: 'org-1',
        inputSummary: 'High confidence',
        outputSummary: 'Looks good',
        confidence: 0.95,
      })

      expect(getDecisionsPendingReview()).toHaveLength(1)
      expect(getDecisionLog({ app: 'cfo' })).toHaveLength(1)
      expect(getDecisionLog({ modelId: 'm2' })).toHaveLength(1)
      expect(getDecisionLog({ app: 'none' })).toHaveLength(0)
    })
  })

  describe('humanReview', () => {
    it('flags a decision for review', () => {
      const flag = flagForReview({
        decisionId: 'd1',
        reason: 'Unexpected output',
        flaggedBy: 'admin',
        priority: 'high',
      })
      expect(flag.resolved).toBe(false)
      expect(getPendingReviewFlags()).toHaveLength(1)
    })

    it('resolves a review flag', () => {
      const flag = flagForReview({
        decisionId: 'd1',
        reason: 'Test',
        flaggedBy: 'admin',
        priority: 'medium',
      })
      const resolved = resolveReviewFlag(flag.id, 'Output verified as correct')
      expect(resolved?.resolved).toBe(true)
      expect(getPendingReviewFlags()).toHaveLength(0)
    })

    it('returns undefined when resolving an unknown review flag', () => {
      expect(resolveReviewFlag('missing-flag', 'n/a')).toBeUndefined()
    })
  })

  describe('types and barrel exports', () => {
    it('validates runtime schemas', () => {
      const modelId = crypto.randomUUID()
      const promptId = crypto.randomUUID()
      const decisionId = crypto.randomUUID()

      const model = modelRegistryEntrySchema.parse({
        id: modelId,
        name: 'gpt-4o',
        version: '2025-01',
        provider: 'azure-openai',
        capabilities: ['chat'],
        riskLevel: 'low',
        approvedForProduction: true,
        registeredAt: new Date().toISOString(),
      })

      const prompt = promptVersionSchema.parse({
        id: promptId,
        promptName: 'quote-summary',
        version: 1,
        template: 'Summarize {{input}}',
        author: 'admin',
        createdAt: new Date().toISOString(),
        active: true,
        changeReason: 'init',
      })

      const decision = aiDecisionLogEntrySchema.parse({
        id: decisionId,
        timestamp: new Date().toISOString(),
        modelId,
        promptId,
        app: 'web',
        orgId: 'org-1',
        inputSummary: 'input',
        outputSummary: 'output',
        confidence: 0.9,
        requiresHumanReview: true,
      })

      const flag = humanReviewFlagSchema.parse({
        id: crypto.randomUUID(),
        decisionId,
        reason: 'check output',
        flaggedAt: new Date().toISOString(),
        flaggedBy: 'admin',
        priority: 'high',
        resolved: false,
      })

      expect(model.name).toBe('gpt-4o')
      expect(prompt.version).toBe(1)
      expect(decision.modelId).toBe(modelId)
      expect(flag.priority).toBe('high')
    })

    it('exposes governance functions from barrel index', () => {
      expect(typeof governanceIndex.registerModel).toBe('function')
      expect(typeof governanceIndex.logAIDecision).toBe('function')
      expect(typeof governanceIndex.flagForReview).toBe('function')
    })
  })
})
