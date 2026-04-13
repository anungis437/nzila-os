import { describe, it, expect, beforeEach } from 'vitest'
import {
  requestTelemetry,
  workflowTelemetry,
  integrationTelemetry,
  aiRunTelemetry,
  governanceTelemetry,
  dataFabricTelemetry,
  requestContextMiddleware,
  apiRequestCount,
  apiErrorRate,
  apiAuthFailures,
  apiRequestLatency,
  workflowRuns,
  workflowFailures,
  workflowRetryCount,
  workflowRunDuration,
  workflowQueueDepth,
  integrationWebhookVolume,
  integrationApiFailures,
  integrationRetryAttempts,
  integrationSyncDuration,
  integrationProviderLatency,
  aiReasoningRuns,
  aiReasoningLatency,
  aiCitationCoverage,
  aiApprovalRequired,
  aiUnsafeOutputFlags,
  govPolicyViolations,
  govApprovalBacklog,
  govAuditEvents,
  govSensitiveActionFreq,
  dataFabricIngestionRate,
  dataFabricMappingConflicts,
  dataFabricSyncLag,
  dataFabricReconciliationFailures,
} from '../telemetry-contracts'
import { traceContextSchema, healthCheckResultSchema } from '../types'
import * as observabilityIndex from '../index'

describe('telemetry-contracts', () => {
  beforeEach(() => {
    apiRequestCount.reset()
    apiErrorRate.reset()
    workflowRuns.reset()
    workflowFailures.reset()
    integrationWebhookVolume.reset()
    aiReasoningRuns.reset()
    aiReasoningLatency.reset()
    aiCitationCoverage.reset()
    aiApprovalRequired.reset()
    aiUnsafeOutputFlags.reset()
    govPolicyViolations.reset()
    govApprovalBacklog.reset()
    govAuditEvents.reset()
    govSensitiveActionFreq.reset()
    dataFabricIngestionRate.reset()
    dataFabricMappingConflicts.reset()
    dataFabricSyncLag.reset()
    dataFabricReconciliationFailures.reset()
    apiAuthFailures.reset()
    workflowRetryCount.reset()
    workflowRunDuration.reset()
    workflowQueueDepth.reset()
    integrationApiFailures.reset()
    integrationRetryAttempts.reset()
    integrationSyncDuration.reset()
    integrationProviderLatency.reset()
    apiRequestLatency.reset()
  })

  describe('requestTelemetry', () => {
    it('increments request count on received', () => {
      const tel = requestTelemetry({ service: 'console', method: 'GET', path: '/api/test' })
      tel.received()
      expect(apiRequestCount.get()).toBe(1)
    })

    it('increments error count on 5xx response', () => {
      const tel = requestTelemetry({ service: 'console', method: 'POST', path: '/api/test' })
      tel.received()
      tel.authChecked(false)
      tel.validationPassed()
      tel.handlerStarted()
      tel.handlerCompleted(500)
      tel.responseSent(500)
      expect(apiErrorRate.get()).toBe(1)
      expect(apiAuthFailures.get()).toBe(1)
      expect(apiRequestLatency.count()).toBe(1)
    })

    it('does not increment error count on 2xx response', () => {
      const tel = requestTelemetry({ service: 'console', method: 'GET', path: '/api/test' })
      tel.received()
      tel.authChecked(true)
      tel.handlerCompleted(200)
      expect(apiErrorRate.get()).toBe(0)
      expect(apiAuthFailures.get()).toBe(0)
    })
  })

  describe('workflowTelemetry', () => {
    it('tracks workflow lifecycle', () => {
      const tel = workflowTelemetry('wf-1', 'procurement')
      tel.registered()
      tel.jobQueued('job-1')
      tel.jobStarted('job-1')
      expect(workflowRuns.get()).toBe(1)

      tel.stepCompleted('job-1', 'validate', 0)
      tel.jobSucceeded('job-1')
      tel.resultPersisted('job-1')
      expect(workflowFailures.get()).toBe(0)
      expect(workflowQueueDepth.get()).toBe(0)
      expect(workflowRunDuration.count()).toBe(1)
    })

    it('tracks workflow failure', () => {
      const tel = workflowTelemetry('wf-2', 'onboarding')
      tel.jobStarted('job-2')
      tel.retryTriggered('job-2', 2, 'dependency timeout')
      tel.jobFailed('job-2', 'timeout')
      expect(workflowFailures.get()).toBe(1)
      expect(workflowRetryCount.get()).toBe(1)
    })
  })

  describe('integrationTelemetry', () => {
    it('tracks webhook reception', () => {
      const tel = integrationTelemetry('hubspot', 'crm')
      tel.webhookReceived('contact.created')
      tel.payloadValidated(true)
      tel.adapterExecuted()
      tel.providerRequest()
      tel.providerResponse(503, 320)
      tel.retryInvoked(1, 'provider unavailable')
      tel.mappingApplied('map-1')
      tel.auditEmitted('integration.event')
      expect(integrationWebhookVolume.get()).toBe(1)
      expect(integrationApiFailures.get()).toBe(1)
      expect(integrationRetryAttempts.get()).toBe(1)
      expect(integrationProviderLatency.count()).toBe(1)
    })

    it('tracks sync completion', () => {
      const tel = integrationTelemetry('stripe', 'webhooks')
      tel.syncCompleted(true)
      expect(integrationSyncDuration.count()).toBe(1)
    })
  })

  describe('aiRunTelemetry', () => {
    it('tracks AI reasoning lifecycle', () => {
      const tel = aiRunTelemetry('run-1', 'procurement-analysis')
      tel.contextBuilt(5)
      tel.retrievalPerformed(10)
      tel.modelInvoked('gpt-4o')
      expect(aiReasoningRuns.get()).toBe(1)

      tel.citationsAttached(3, 85.0)
      tel.policyChecked(true, 0)
      tel.approvalRequired('manual override policy')
      tel.resultPersisted()

      expect(aiCitationCoverage.get()).toBe(85)
      expect(aiApprovalRequired.get()).toBe(1)
      expect(aiReasoningLatency.count()).toBe(1)
    })

    it('flags unsafe output', () => {
      const tel = aiRunTelemetry('run-2', 'risk-assessment')
      tel.modelInvoked('gpt-4o')
      tel.unsafeOutputDetected('PII detected in output')
      tel.policyChecked(false, 1)

      expect(aiUnsafeOutputFlags.get()).toBe(1)
      expect(govPolicyViolations.get()).toBe(1)
    })
  })

  describe('governanceTelemetry', () => {
    it('tracks policy evaluation', () => {
      const tel = governanceTelemetry('org-1')
      tel.policyEvaluated('policy-1', false)
      expect(govPolicyViolations.get()).toBe(1)
    })

    it('tracks approval lifecycle', () => {
      const tel = governanceTelemetry('org-1')
      tel.approvalRequested('appr-1', 'user-1')
      tel.approvalGranted('appr-1', 'admin-1')
      tel.approvalRequested('appr-2', 'user-2')
      tel.approvalDenied('appr-2', 'admin-1', 'missing evidence')
      tel.decisionRecorded('decision-1', 'approved')
      tel.auditEmitted('approval.audit', { source: 'ui' })
      tel.sensitiveAction('manual_override', 'admin-1')

      expect(govApprovalBacklog.get()).toBe(0)
      expect(govAuditEvents.get()).toBeGreaterThanOrEqual(2)
      expect(govSensitiveActionFreq.get()).toBe(1)
    })
  })

  describe('dataFabricTelemetry', () => {
    it('tracks data ingestion', () => {
      const tel = dataFabricTelemetry('hubspot')
      tel.recordIngested('contact')
      expect(dataFabricIngestionRate.get()).toBe(1)
    })

    it('tracks conflict detection', () => {
      const tel = dataFabricTelemetry('qbo')
      tel.conflictDetected('entity-1', 'amount')
      tel.mappingApplied('map-42', 'invoice')
      tel.reconciliationPerformed('rec-1', false)
      tel.reconciliationPerformed('rec-2', true)
      tel.lineageUpdated('rec-1')
      tel.syncLagUpdated(250)

      expect(dataFabricMappingConflicts.get()).toBe(1)
      expect(dataFabricReconciliationFailures.get()).toBe(1)
      expect(dataFabricSyncLag.get()).toBe(250)
    })
  })

  describe('requestContextMiddleware', () => {
    it('extracts context from headers', () => {
      const mw = requestContextMiddleware('console')
      const ctx = mw.extractContext({
        'x-request-id': 'req-123',
        'x-org-id': 'org-456',
        'x-trace-id': 'trace-789',
      })

      expect(ctx.requestId).toBe('req-123')
      expect(ctx.orgId).toBe('org-456')
      expect(ctx.traceId).toBe('trace-789')
      expect(ctx.service).toBe('console')
    })

    it('generates request ID when missing', () => {
      const mw = requestContextMiddleware('partners')
      const ctx = mw.extractContext({})
      expect(ctx.requestId).toBeTruthy()
      expect(ctx.service).toBe('partners')
    })

    it('extracts full optional context and handles array headers', () => {
      const mw = requestContextMiddleware('cfo')
      const ctx = mw.extractContext({
        'x-request-id': ['req-a', 'req-b'],
        'x-correlation-id': ['corr-a', 'corr-b'],
        'x-trace-id': ['trace-a'],
        'x-span-id': ['span-a'],
        'x-actor-id': 'actor-1',
        'x-org-id': 'org-1',
      })

      expect(ctx.requestId).toBe('req-a')
      expect(ctx.correlationId).toBe('corr-a')
      expect(ctx.traceId).toBe('trace-a')
      expect(ctx.spanId).toBe('span-a')
      expect(ctx.actorId).toBe('actor-1')
      expect(ctx.orgId).toBe('org-1')
      expect(ctx.environment).toBeDefined()
    })
  })

  describe('types and barrel exports', () => {
    it('validates core schemas and index exports', () => {
      const trace = traceContextSchema.parse({
        traceId: 'a'.repeat(32),
        spanId: 'b'.repeat(16),
        parentSpanId: null,
        traceFlags: 1,
      })

      const health = healthCheckResultSchema.parse({
        name: 'db',
        status: 'healthy',
        latencyMs: 5,
      })

      expect(trace.traceId.length).toBe(32)
      expect(health.status).toBe('healthy')
      expect(typeof observabilityIndex.trace).toBe('function')
      expect(typeof observabilityIndex.fireAlert).toBe('function')
      expect(typeof observabilityIndex.requestTelemetry).toBe('function')
    })
  })
})
