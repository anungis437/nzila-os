/**
 * Control Plane — Canonical Capability Ownership Map
 *
 * This is the single source of truth for which app owns each platform
 * capability. Import this map to enforce boundaries, generate docs, or
 * validate that an operation is flowing through the correct app.
 *
 * Governance rule: This map may ONLY be changed via a PR reviewed by a
 * Control Plane maintainer. Any change here is an architectural decision.
 */

/** The four authorized apps in the Nzila OS platform */
export type AuthorizedApp =
  | 'control-plane'   // authority layer — policy, governance, contracts, entitlements
  | 'orchestrator'    // execution engine — workflows, job state, event dispatch
  | 'console'         // operator interface — visibility, monitoring, triggering
  | 'platform-admin'  // org-scoped admin — users, settings, org configuration

export type CapabilityRecord = {
  owner: AuthorizedApp
  description: string
  /** If true, other apps may READ this capability but not write */
  readableByOthers?: boolean
}

/**
 * The complete capability ownership map for Nzila OS.
 * Keys are capability names used in code comments, API docs, and tests.
 */
export const CapabilityOwnership = {
  // ── Org lifecycle (owned by Control Plane) ────────────────────────────
  orgLifecycle: {
    owner: 'control-plane',
    description: 'Creating, suspending, and retiring organizations',
  },
  contracts: {
    owner: 'control-plane',
    description: 'Contract definitions, versioning, and activation',
    readableByOthers: true,
  },
  entitlements: {
    owner: 'control-plane',
    description: 'Feature entitlements and org capability grants',
    readableByOthers: true,
  },
  featureFlags: {
    owner: 'control-plane',
    description: 'Platform-wide and org-scoped feature flags',
    readableByOthers: true,
  },
  policyEnforcement: {
    owner: 'control-plane',
    description: 'Evaluating YAML policy definitions against actor+action+resource',
  },
  governanceActions: {
    owner: 'control-plane',
    description: 'Governance action lifecycle: draft → submit → approve → execute',
  },
  auditPolicy: {
    owner: 'control-plane',
    description: 'Audit chain recording and verification policy',
    readableByOthers: true,
  },
  workflowDefinitions: {
    owner: 'control-plane',
    description: 'Canonical workflow definitions and registry',
    readableByOthers: true,
  },
  approvalPolicy: {
    owner: 'control-plane',
    description: 'Approval workflow requirements, thresholds, and quorum rules',
  },
  integrationRegistry: {
    owner: 'control-plane',
    description: 'External integration registry and lifecycle',
    readableByOthers: true,
  },

  // ── Execution engine (owned by Orchestrator) ─────────────────────────
  workflowExecution: {
    owner: 'orchestrator',
    description: 'Dispatching and running workflow instances',
  },
  jobState: {
    owner: 'orchestrator',
    description: 'Job lifecycle state (queued → running → completed/failed)',
    readableByOthers: true,
  },
  commandDispatch: {
    owner: 'orchestrator',
    description: 'Dispatching automation commands to execution workers',
  },
  eventFabric: {
    owner: 'orchestrator',
    description: 'Event bus publishing and subscription',
  },

  // ── Operator interface (owned by Console) ─────────────────────────────
  systemMonitoring: {
    owner: 'console',
    description: 'Cross-org system health visibility and alerting',
    readableByOthers: true,
  },
  auditVisualization: {
    owner: 'console',
    description: 'Rendering audit trails and timeline UI for operators',
  },
  breakGlass: {
    owner: 'console',
    description: 'Emergency access override initiation (routes through Control Plane policy)',
  },
  operatorDashboard: {
    owner: 'console',
    description: 'Operator-facing dashboards and aggregate metrics',
  },

  // ── Org-scoped admin (owned by Platform Admin) ────────────────────────
  orgUsers: {
    owner: 'platform-admin',
    description: 'Managing users within a single organization',
  },
  orgSettings: {
    owner: 'platform-admin',
    description: 'Org-level configuration (branding, notifications, etc.)',
  },
  memberRoles: {
    owner: 'platform-admin',
    description: 'Assigning and revoking roles within an org (not cross-org)',
  },
} as const satisfies Record<string, CapabilityRecord>

export type CapabilityName = keyof typeof CapabilityOwnership

/**
 * Assert that a given app owns the specified capability.
 * Throws at runtime if the assertion fails — use in tests to enforce boundaries.
 */
export function assertCapabilityOwner(
  capability: CapabilityName,
  expectedOwner: AuthorizedApp,
): void {
  const actual = CapabilityOwnership[capability].owner
  if (actual !== expectedOwner) {
    throw new Error(
      `Capability boundary violation: "${capability}" is owned by "${actual}", ` +
        `not "${expectedOwner}". Route this operation through the "${actual}" app.`,
    )
  }
}

/**
 * Get all capabilities owned by a specific app.
 */
export function getCapabilitiesFor(app: AuthorizedApp): CapabilityName[] {
  return (Object.keys(CapabilityOwnership) as CapabilityName[]).filter(
    (cap) => CapabilityOwnership[cap].owner === app,
  )
}
