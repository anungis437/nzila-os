'use client'

import { useState } from 'react'
import { AIOperationTypes, AIRunStatuses } from '@nzila/platform-governed-ai/types'

const operationTypes = Object.entries(AIOperationTypes)
const runStatuses = Object.entries(AIRunStatuses)

export default function AIRunAuditViewer() {
  const [entityFilter, setEntityFilter] = useState('')

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">AI Run Audit Viewer</h1>
      <p className="mb-6 text-gray-500">
        Audit every AI operation — policy-checked, evidence-grounded, fully
        traceable. {operationTypes.length} operation types tracked.
      </p>

      {/* Filters */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase text-gray-400">
          Filters
        </h2>
        <div className="flex gap-4">
          <input
            type="text"
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            placeholder="Filter by entity ID or model..."
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Search Runs
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Operation Types */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-400">
            Operation Types
          </h2>
          <ul className="space-y-2">
            {operationTypes.map(([key, value]) => (
              <li
                key={key}
                className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-700"
              >
                <span className="font-mono text-xs text-blue-600">{value}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Run Status Reference */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-400">
            Run Statuses
          </h2>
          <div className="mb-4 flex flex-wrap gap-2">
            {runStatuses.map(([key, value]) => (
              <span
                key={key}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
              >
                {value}
              </span>
            ))}
          </div>

          <h2 className="mb-3 mt-6 text-sm font-semibold uppercase text-gray-400">
            Audit Record Fields
          </h2>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>orgId, entityType, entityId</li>
            <li>operationType, modelId, prompt</li>
            <li>result, confidence, reasoning</li>
            <li>evidence (citations with source type)</li>
            <li>policyConstraints (pre/post checks)</li>
            <li>tokenUsage (input/output/total)</li>
            <li>latencyMs, startedAt, completedAt</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
