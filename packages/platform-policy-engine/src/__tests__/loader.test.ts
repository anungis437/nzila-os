import { describe, it, expect } from 'vitest'
import { loadPolicies, loadPolicyById } from '../loader'
import type { PolicyEnginePorts, PolicyAuditEntry } from '../types'

function makePorts(files: Record<string, string>): PolicyEnginePorts {
  return {
    async listPolicyFiles() {
      return Object.keys(files)
    },
    async loadPolicyFile(path: string) {
      return files[path] ?? ''
    },
    async recordAudit(_entry: PolicyAuditEntry) {},
    async loadAuditEntries() {
      return []
    },
  }
}

describe('loadPolicies', () => {
  it('loads enabled policies and skips disabled ones', async () => {
    const ports = makePorts({
      'policy.yml': `version: "1"
lastUpdated: "2026-01-01"
policies:
  - id: policy-enabled
    name: Enabled policy
    version: "1.0"
    type: approval
    description: enabled
    enabled: true
    scope:
      environments: [prod]
    rules:
      - id: rule-1
        description: r1
        conditions:
          - field: context.amount
            operator: gt
            value: 100
        effect: deny
        severity: warning
    metadata: {}
  - id: policy-disabled
    name: Disabled policy
    version: "1.0"
    type: approval
    description: disabled
    enabled: false
    scope: {}
    rules: []
    metadata: {}
`,
    })

    const policies = await loadPolicies(ports)
    expect(policies).toHaveLength(1)
    expect(policies[0].id).toBe('policy-enabled')
  })

  it('throws when a file is invalid', async () => {
    const ports = makePorts({
      'bad.yml': `version: "1"
lastUpdated: "2026-01-01"
policies:
  - id: bad-policy
    name: Bad policy
`,
    })

    await expect(loadPolicies(ports)).rejects.toThrow("Invalid policy file 'bad.yml'")
  })
})

describe('loadPolicyById', () => {
  it('returns a policy when found and null when missing', async () => {
    const ports = makePorts({
      'single.yml': `version: "1"
lastUpdated: "2026-01-01"
policies:
  - id: policy-1
    name: Policy One
    version: "1.0"
    type: access
    description: one
    enabled: true
    scope: {}
    rules:
      - id: allow-one
        description: allow one
        conditions:
          - field: action
            operator: eq
            value: payout.create
        effect: allow
        severity: info
    metadata: {}
`,
    })

    const found = await loadPolicyById('policy-1', ports)
    const missing = await loadPolicyById('not-found', ports)

    expect(found?.id).toBe('policy-1')
    expect(missing).toBeNull()
  })
})
