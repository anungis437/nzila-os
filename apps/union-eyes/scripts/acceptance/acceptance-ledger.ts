import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { folder } from '../bootstrap-v2/source'
import { buildCallerControlGraph } from './caller-control-graph'

/**
 * Compressed acceptance model (G2 shared controls, G3 caller binding, G4 exception classes,
 * G6 financial authority classes). Controls are proven once; callers are bound to them statically;
 * only exception classes receive representative runtime proof. Evidence paths are relative to
 * apps/union-eyes and are verified to exist by acceptance-ledger.test.ts.
 */
type Graph = ReturnType<typeof buildCallerControlGraph>
type Caller = Graph['callers'][number]

export interface Control {
  controlId: string
  source: string[]
  authority: string
  callerClass: string
  runtimeEvidence: string[]
}

export const CONTROLS: Control[] = [
  {
    controlId: 'CANONICAL_SESSION_INLINE',
    source: ['lib/api-auth-guard.ts', 'lib/organization-utils.ts'],
    authority: 'Canonical auth() session; organization resolved from live canonical membership',
    callerClass: 'Handlers that call auth()/requireUser* directly',
    runtimeEvidence: [
      'lib/__tests__/api-auth-guard-canonical.test.ts',
      'scripts/bootstrap-v2/auth-native.test.ts',
      'scripts/bootstrap-v2/organization-selection-native.test.ts',
    ],
  },
  {
    controlId: 'WITH_API',
    source: ['lib/api/with-api.ts', 'lib/api/authorization-denial.ts'],
    authority: 'Authentication, rate limit, schema validation, tenant RLS transaction, 4xx mapping',
    callerClass: 'Routes wrapped by withApi',
    runtimeEvidence: [
      'lib/api/__tests__/with-api.test.ts',
      'lib/api/__tests__/with-api-canonical.test.ts',
      'lib/api/__tests__/with-api-org-bootstrap.test.ts',
    ],
  },
  {
    controlId: 'TENANT_RLS_TRANSACTION',
    source: [
      'lib/organization-middleware.ts',
      'lib/db/with-rls-context.ts',
      'lib/db/org-owned-context.ts',
    ],
    authority: 'Canonical organization binding then SET LOCAL ROLE union_eyes_runtime with RLS',
    callerClass: 'withOrganizationAuth routes and manual withRLSContext handlers',
    runtimeEvidence: [
      'lib/__tests__/organization-middleware.test.ts',
      'lib/db/__tests__/with-rls-context.test.ts',
      'scripts/bootstrap-v2/runtime-security-native.test.ts',
    ],
  },
  {
    controlId: 'ROLE_AUTHORIZATION',
    source: ['lib/api-auth-guard.ts'],
    authority: 'Minimum-role and admin wrappers over the canonical session; denial is 403',
    callerClass: 'withRoleAuth/withMinRole/withAdminAuth routes',
    runtimeEvidence: [
      'lib/__tests__/api-auth-guard.test.ts',
      'lib/__tests__/api-auth-guard-params.test.ts',
    ],
  },
  {
    controlId: 'SYSTEM_CONTEXT_CONTRACT',
    source: [
      'lib/db/with-rls-context.ts',
      'db/rls-storage-authority',
      'scripts/bootstrap-v2/system-mutation-contracts.ts',
    ],
    authority:
      'Relation-specific SYSTEM privileges derived from source; no generic cross-organization authority',
    callerClass: 'withSystemContext callers (51 mutation relations; D1 SELECT-only cron relations)',
    runtimeEvidence: [
      'scripts/bootstrap-v2/system-mutation-contracts.test.ts',
      'scripts/bootstrap-v2/system-mutation-native.test.ts',
      'scripts/bootstrap-v2/system-component-integration.test.ts',
    ],
  },
  {
    controlId: 'AUTH_TOKEN_FLOW',
    source: ['backend/auth_core', 'app/api/auth'],
    authority:
      'Single-use hashed token or credential possession; AUTH service owns issuance and consumption',
    callerClass: 'forgot-password, reset-password, invite accept, magic-link verify',
    runtimeEvidence: [
      'scripts/bootstrap-v2/auth-native.test.ts',
      'app/api/__tests__/auth-forgot-password.route.test.ts',
      'app/api/__tests__/auth-magic-link-request.route.test.ts',
    ],
  },
  {
    controlId: 'CRON_CREDENTIAL',
    source: ['lib/api/with-api.ts', 'app/api/cron', 'app/api/rewards/cron/route.ts'],
    authority: 'x-cron-secret / bearer secret compared in constant time; no human actor',
    callerClass: 'Scheduled jobs',
    runtimeEvidence: [
      'app/api/__tests__/cron-sla-watchdog.route.test.ts',
      'app/api/__tests__/cron-observability-alerts.route.test.ts',
      'app/api/__tests__/rewards-cron.route.test.ts',
    ],
  },
  {
    controlId: 'MACHINE_CREDENTIAL',
    source: ['lib/api/with-api.ts', 'app/api/scim', 'lib/scim/scim-token.ts'],
    authority:
      'The route declares its credential verifier (withApi auth.machine): a per-organization bearer token, stored only as its SHA-256, bound to one organization and one configuration; no human actor and no session',
    callerClass: 'Identity-provider provisioning (SCIM)',
    runtimeEvidence: [
      'lib/api/__tests__/with-api-machine.test.ts',
      'app/api/__tests__/scim-users.route.test.ts',
      'db/__tests__/scim-provisioning.postgres.test.ts',
    ],
  },
  {
    controlId: 'WEBHOOK_SIGNATURE',
    source: [
      'lib/webhook-security.ts',
      'app/api/payments/webhooks',
      'app/api/communications/webhooks',
    ],
    authority:
      'Provider signature verification; missing configuration is 503, bad signature is 4xx',
    callerClass: 'Stripe, PayPal, Resend, Shopify webhooks',
    runtimeEvidence: [
      'lib/__tests__/webhook-security.test.ts',
      'app/api/__tests__/payments-stripe-webhook.route.test.ts',
      'app/api/__tests__/communications-webhooks-resend.route.test.ts',
    ],
  },
  {
    controlId: 'CAPABILITY_OR_PUBLIC_INTAKE_SYSTEM_CONTRACT',
    source: [
      'app/api/icra',
      'app/api/ocra',
      'app/api/oci',
      'app/api/workbook/start',
      'lib/icra/claim-tokens.ts',
    ],
    authority:
      'Pseudonymous capability token or public intake; writes only through relation-specific SYSTEM contracts',
    callerClass: 'ICRA/OCRA/OCI, workbook start, pilot apply, tracking and unsubscribe',
    runtimeEvidence: [
      'app/api/__tests__/icra-start.route.test.ts',
      'app/api/__tests__/icra-assessmentId-answer.route.test.ts',
      'app/api/__tests__/communications-unsubscribe.route.test.ts',
    ],
  },
  {
    controlId: 'FINANCIAL_AUTHORITY',
    source: ['db/rls-storage-authority/finance.ts', 'app/api/finance', 'app/api/dues'],
    authority:
      'Tenant RLS plus role authorization for every financial mutation; SYSTEM only for platform payments',
    callerClass:
      'Dues, invoice/billing, payment/remittance, expense/budget, donation, reporting, reconciliation',
    runtimeEvidence: [
      'scripts/bootstrap-v2/financial-http-boundary.test.ts',
      'app/api/__tests__/dues-balance.route.test.ts',
      'app/api/__tests__/finance-invoices-id-payments.route.test.ts',
    ],
  },
  {
    controlId: 'AUDIT_CHAIN',
    source: ['lib/audit-logger.ts', 'backend/core/services.py'],
    authority:
      'Canonical public.audit_logs, per-organization sorted-key SHA-256 chain, advisory-locked head',
    callerClass: 'Every audited mutation',
    runtimeEvidence: [
      'lib/__tests__/audit-logger-canonical.test.ts',
      'scripts/bootstrap-v2/audit-chain-native.test.ts',
    ],
  },
]

const EXCEPTION_CLASSES = [
  {
    id: 'E1_CRON_SYSTEM',
    test: (c: Caller) => c.boundControl === 'CRON_CREDENTIAL',
    proof: [
      'app/api/__tests__/cron-sla-watchdog.route.test.ts',
      'app/api/__tests__/rewards-cron.route.test.ts',
    ],
  },
  {
    id: 'E11_MACHINE_CREDENTIAL',
    test: (c: Caller) => c.boundControl === 'MACHINE_CREDENTIAL',
    proof: [
      'lib/api/__tests__/with-api-machine.test.ts',
      'db/__tests__/scim-provisioning.postgres.test.ts',
    ],
  },
  {
    id: 'E2_SIGNED_WEBHOOK',
    test: (c: Caller) => c.boundControl === 'WEBHOOK_SIGNATURE',
    proof: [
      'app/api/__tests__/payments-stripe-webhook.route.test.ts',
      'lib/__tests__/webhook-security.test.ts',
    ],
  },
  {
    id: 'E3_TOKEN_FLOW',
    test: (c: Caller) => c.boundControl === 'AUTH_TOKEN_FLOW',
    proof: [
      'scripts/bootstrap-v2/auth-native.test.ts',
      'app/api/__tests__/auth-forgot-password.route.test.ts',
    ],
  },
  {
    id: 'E4_CAPABILITY_OR_PUBLIC_INTAKE',
    test: (c: Caller) => c.boundControl === 'CAPABILITY_OR_PUBLIC_INTAKE_SYSTEM_CONTRACT',
    proof: [
      'app/api/__tests__/icra-start.route.test.ts',
      'app/api/__tests__/communications-unsubscribe.route.test.ts',
    ],
  },
  {
    id: 'E5_DELEGATED_WRAPPER',
    test: (c: Caller) => c.boundControl === 'DELEGATED_TO_GUARDED_ROUTE',
    proof: ['lib/api/__tests__/with-api.test.ts'],
  },
  {
    id: 'E6_ENVIRONMENT_OR_SERVICE_BOUNDARY',
    test: (c: Caller) =>
      ['ENVIRONMENT_GATE', 'SEPARATE_SERVICE_BOUNDARY'].includes(c.boundControl ?? ''),
    proof: ['scripts/bootstrap-v2/connection-environment-surface.test.ts'],
  },
  {
    id: 'E7_IDENTITY_OR_MEMBERSHIP_MUTATION',
    test: (c: Caller) => c.exceptionReasons.includes('IDENTITY_OR_MEMBERSHIP_MUTATION'),
    proof: [
      'scripts/bootstrap-v2/organization-selection-native.test.ts',
      'lib/__tests__/api-auth-guard-canonical.test.ts',
    ],
  },
  {
    id: 'E8_TENANT_ACTOR_SYSTEM_CONTEXT',
    test: (c: Caller) => c.exceptionReasons.includes('PRIVILEGED_SYSTEM_AUTHORITY'),
    proof: [
      'scripts/bootstrap-v2/system-mutation-native.test.ts',
      'scripts/bootstrap-v2/system-component-integration.test.ts',
    ],
  },
  {
    id: 'E9_INLINE_SESSION_HANDLER',
    test: (c: Caller) =>
      c.exceptionReasons.includes('BYPASSES_SHARED_AUTHORIZATION_GUARD') &&
      !c.exceptionReasons.includes('FINANCIAL_MUTATION'),
    proof: [
      'lib/__tests__/api-auth-guard-canonical.test.ts',
      'scripts/bootstrap-v2/auth-native.test.ts',
    ],
  },
  {
    id: 'E10_FINANCIAL_MUTATION',
    test: (c: Caller) => c.exceptionReasons.includes('FINANCIAL_MUTATION'),
    proof: ['scripts/bootstrap-v2/financial-http-boundary.test.ts'],
  },
]

const FINANCIAL_CLASSES: { id: string; table: RegExp; proof: string[] }[] = [
  {
    id: 'F1_DUES',
    table: /dues|arrears/i,
    proof: ['app/api/__tests__/dues-balance.route.test.ts'],
  },
  {
    id: 'F2_INVOICE_BILLING',
    table: /invoice|billing|subscription/i,
    proof: ['app/api/__tests__/billing-send-invoice.route.test.ts'],
  },
  {
    id: 'F3_PAYMENT_REMITTANCE',
    table: /payment|remittance|per_capita|stipend/i,
    proof: ['app/api/__tests__/finance-invoices-id-payments.route.test.ts'],
  },
  {
    id: 'F4_EXPENSE_BUDGET',
    table: /expense|budget|reward|wallet|payroll/i,
    proof: ['app/api/__tests__/rewards-cron.route.test.ts'],
  },
  {
    id: 'F5_DONATION',
    table: /donation/i,
    proof: ['scripts/bootstrap-v2/financial-http-boundary.test.ts'],
  },
  {
    id: 'F6_RECONCILIATION_LEDGER_SYSTEM',
    table: /ledger|reconcil|fee|tax|transaction/i,
    proof: ['scripts/bootstrap-v2/system-mutation-native.test.ts'],
  },
]

export function buildAcceptanceControls() {
  const graph = buildCallerControlGraph()
  const mutating = graph.callers.filter((caller) => caller.mutating)
  const controlIds = new Set(CONTROLS.map((control) => control.controlId))
  const baseline = new Set([
    'WITH_API_PUBLIC',
    'ENVIRONMENT_GATE',
    'SEPARATE_SERVICE_BOUNDARY',
    'DELEGATED_TO_GUARDED_ROUTE',
    'EXTERNAL_MATTER_GRANT',
  ])
  const callerBindings = new Map<string, number>()
  for (const caller of mutating) {
    const control = caller.boundControl!
    callerBindings.set(control, (callerBindings.get(control) ?? 0) + 1)
  }
  const unresolvedControls = [...callerBindings.keys()].filter(
    (control) => !controlIds.has(control) && !baseline.has(control),
  )

  const exceptions = mutating.filter((caller) => caller.exceptionReasons.length)
  const classCounts = EXCEPTION_CLASSES.map((entry) => {
    const members = exceptions.filter((caller) => entry.test(caller))
    return { entry, members }
  })
  const assigned = new Map<string, string>()
  const exceptionClasses = classCounts.map(({ entry, members }) => {
    const owned = members.filter((caller) => {
      const key = `${caller.sourcePath}#${caller.id}`
      if (assigned.has(key)) return false
      assigned.set(key, entry.id)
      return true
    })
    return {
      classId: entry.id,
      callerCount: owned.length,
      representativeCaller: owned[0]?.sourcePath ?? null,
      representativeProof: entry.proof,
    }
  })
  const unclassifiedExceptions = exceptions.filter(
    (caller) => !assigned.has(`${caller.sourcePath}#${caller.id}`),
  )

  const financialCallers = mutating.filter((caller) =>
    caller.exceptionReasons.includes('FINANCIAL_MUTATION'),
  )
  const financialClasses = FINANCIAL_CLASSES.map((entry) => ({
    classId: entry.id,
    callerCount: financialCallers.filter((caller) =>
      caller.mutatedTables.some((table) => entry.table.test(table)),
    ).length,
    representativeProof: entry.proof,
  }))
  const unclassifiedFinancial = financialCallers.filter(
    (caller) =>
      !FINANCIAL_CLASSES.some((entry) =>
        caller.mutatedTables.some((table) => entry.table.test(table)),
      ),
  )

  return {
    summary: {
      rootCallers: graph.summary.rootCallers,
      mutatingCallers: mutating.length,
      mutatingBound: mutating.filter((caller) => caller.boundControl).length,
      mutatingUnmapped: mutating.filter((caller) => !caller.boundControl).length,
      mutatingExceptionCallers: exceptions.length,
      exceptionClassCount: exceptionClasses.filter((entry) => entry.callerCount).length,
      unclassifiedExceptionCallers: unclassifiedExceptions.length,
      financialMutatingCallers: financialCallers.length,
      financialClassCount: financialClasses.filter((entry) => entry.callerCount).length,
      unclassifiedFinancialCallers: unclassifiedFinancial.map((caller) => caller.sourcePath),
      unresolvedControls,
    },
    controlTable: CONTROLS.map((control) => ({
      ...control,
      callerCount: callerBindings.get(control.controlId) ?? 0,
      status: 'EVIDENCE_BOUND_PENDING_FINAL_RUN',
    })),
    callerBindingCounts: Object.fromEntries([...callerBindings.entries()].sort()),
    exceptionClasses,
    financialClasses,
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const controls = buildAcceptanceControls()
  const body = `${JSON.stringify(controls, null, 2)}\n`
  if (process.argv.includes('--write'))
    writeFileSync(path.join(folder, 'UE_V2_ACCEPTANCE_CONTROLS.json'), body)
  process.stdout.write(
    `${JSON.stringify({ ...controls.summary, digest: createHash('sha256').update(body).digest('hex') })}\n`,
  )
}
