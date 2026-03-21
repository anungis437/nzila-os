'use client'

import { useState } from 'react'
import {
  createWorkflowRegistry,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_SLO_TARGETS,
  type WorkflowDefinition,
  type DangerLevel,
} from '@nzila/platform-ops/workflow-registry'

/**
 * Orchestrator Ops Dashboard
 *
 * Operational view into the orchestration layer: workflow registry,
 * retry configuration, SLO targets, and failure classification.
 * In production, connected to live ops-score and health-digest.
 */

const registry = createWorkflowRegistry()

function seedWf(name: string, tags: string[], dangerLevel: DangerLevel, requiresApproval: boolean): WorkflowDefinition {
  return {
    name,
    description: name.replace(/-/g, ' '),
    version: '1.0.0',
    status: 'active',
    dangerLevel,
    requiresApproval,
    defaultDryRun: false,
    estimatedDurationSeconds: 60,
    requiredPermissions: [],
    retry: DEFAULT_RETRY_CONFIG,
    slo: DEFAULT_SLO_TARGETS,
    tags,
    owner: tags[0] ?? 'platform',
    registeredAt: new Date().toISOString(),
  }
}

// Seed the registry with known workflows for display purposes
const seedWorkflows: WorkflowDefinition[] = [
  seedWf('org-onboarding', ['platform'], 'destructive', true),
  seedWf('invoice-generation', ['commerce'], 'destructive', true),
  seedWf('notification-dispatch', ['integrations'], 'safe', false),
  seedWf('document-processing', ['automation'], 'moderate', true),
  seedWf('ai-model-inference', ['ai'], 'moderate', false),
  seedWf('data-sync', ['integrations'], 'moderate', true),
  seedWf('report-generation', ['analytics'], 'safe', false),
  seedWf('kyc-verification', ['compliance'], 'destructive', true),
]

for (const wf of seedWorkflows) {
  registry.register(wf)
}

function dangerBadge(level: string) {
  const colors: Record<string, string> = {
    safe: 'bg-green-100 text-green-700',
    moderate: 'bg-yellow-100 text-yellow-700',
    destructive: 'bg-red-100 text-red-700',
  }
  return colors[level] ?? 'bg-gray-100 text-gray-600'
}

export default function OrchestratorOpsPage() {
  const [tab, setTab] = useState<'workflows' | 'retry' | 'slo'>('workflows')
  const [domainFilter, setDomainFilter] = useState('')

  const allWorkflows = registry.list()
  const workflows = domainFilter
    ? allWorkflows.filter((w) => w.tags.some(t => t.toLowerCase().includes(domainFilter.toLowerCase())))
    : allWorkflows

  const domains = [...new Set(allWorkflows.flatMap((w) => w.tags))].sort()

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Orchestrator Ops</h1>
      <p className="mb-6 text-gray-500">
        {allWorkflows.length} registered workflows · {domains.length} domains ·
        max {DEFAULT_RETRY_CONFIG.maxAttempts} retries
      </p>

      {/* Tab bar */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {(['workflows', 'retry', 'slo'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'workflows'
              ? 'Workflow Registry'
              : t === 'retry'
                ? 'Retry Config'
                : 'SLO Targets'}
          </button>
        ))}
      </div>

      {/* Workflow registry */}
      {tab === 'workflows' && (
        <>
          <div className="mb-3">
            <input
              type="text"
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              placeholder="Filter by domain..."
              className="w-full max-w-md rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 font-medium text-gray-500">Workflow</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Tags</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Danger</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Approval</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((wf) => (
                  <tr key={wf.name} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-800">{wf.name}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                        {wf.tags.join(', ')}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${dangerBadge(wf.dangerLevel)}`}>
                        {wf.dangerLevel}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {wf.requiresApproval ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
                        {wf.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Retry configuration */}
      {tab === 'retry' && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold">Platform Retry Configuration</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded border border-gray-100 p-4">
              <div className="text-xs font-medium text-gray-400">Max Attempts</div>
              <div className="mt-1 text-2xl font-bold text-gray-800">
                {DEFAULT_RETRY_CONFIG.maxAttempts}
              </div>
            </div>
            <div className="rounded border border-gray-100 p-4">
              <div className="text-xs font-medium text-gray-400">Initial Delay</div>
              <div className="mt-1 text-2xl font-bold text-gray-800">
                {DEFAULT_RETRY_CONFIG.initialDelayMs}ms
              </div>
            </div>
            <div className="rounded border border-gray-100 p-4">
              <div className="text-xs font-medium text-gray-400">Max Delay</div>
              <div className="mt-1 text-2xl font-bold text-gray-800">
                {(DEFAULT_RETRY_CONFIG.maxDelayMs / 1000).toFixed(0)}s
              </div>
            </div>
            <div className="rounded border border-gray-100 p-4">
              <div className="text-xs font-medium text-gray-400">Backoff Multiplier</div>
              <div className="mt-1 text-2xl font-bold text-gray-800">
                {DEFAULT_RETRY_CONFIG.backoffMultiplier}×
              </div>
            </div>
          </div>
          <div className="mt-4 rounded bg-yellow-50 p-3 text-xs text-yellow-700">
            High-danger workflows use circuit breakers to prevent cascade failures.
            Retry budgets are enforced per-workflow to limit blast radius.
          </div>
        </div>
      )}

      {/* SLO targets */}
      {tab === 'slo' && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold">Workflow SLO Targets</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded border border-gray-100 p-4">
              <div className="text-xs font-medium text-gray-400">Success Rate Target</div>
              <div className="mt-1 text-3xl font-bold text-green-600">
                {DEFAULT_SLO_TARGETS.successRatePercent.toFixed(1)}%
              </div>
              <div className="mt-1 text-xs text-gray-400">
                Error budget: {(100 - DEFAULT_SLO_TARGETS.successRatePercent).toFixed(2)}%
              </div>
            </div>
            <div className="rounded border border-gray-100 p-4">
              <div className="text-xs font-medium text-gray-400">Max Duration Target</div>
              <div className="mt-1 text-3xl font-bold text-blue-600">
                {(DEFAULT_SLO_TARGETS.maxDurationMs / 1000).toFixed(1)}s
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {DEFAULT_SLO_TARGETS.maxDurationMs.toLocaleString()}ms
              </div>
            </div>
          </div>
          <div className="mt-4 rounded bg-blue-50 p-3 text-xs text-blue-700">
            SLO targets apply across all registered workflows. Breaches trigger ops-score
            degradation and alert dispatch via the health-alerts subsystem.
          </div>
        </div>
      )}
    </div>
  )
}
