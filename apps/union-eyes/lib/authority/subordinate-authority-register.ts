/**
 * Register of every place where authority is derived from a record that OUTLIVES the principal's session or membership
 * (UE-CONV-A "revoked sessions or memberships cannot retain subordinate authority"). The register is data, and
 * lib/authority/__tests__/subordinate-authority-register.test.ts holds it to the code: every proof and consumer file
 * must exist, every authority-bearing kernel table must be listed (or explicitly declared non-conferring), and a status
 * of ENFORCED or FIXED must name a proof.
 *
 * Statuses are deliberately narrow. Nothing here claims a deployed or staging result.
 *   ENFORCED       a gate already denies after revocation; the proof file demonstrates it.
 *   FIXED          the gate did not exist; added in this pass; the proof file demonstrates it.
 *   LAYERED        denied for the authenticated actor by the route guard, but the record's own query does not join
 *                  membership; the guard is the only gate. Stated, not hidden.
 *   NO_LIVE_CONSUMER  no code authenticates or authorises from this record; nothing to revoke.
 *   OPEN           not closed; `residual` says why and what closes it.
 *   OTHER_LANE     owned by another delivery lane and not reviewed here.
 */
export type SubordinateStatus = 'ENFORCED' | 'FIXED' | 'LAYERED' | 'NO_LIVE_CONSUMER' | 'OPEN' | 'OTHER_LANE'

export interface SubordinateAuthorityRecord {
  id: string
  record: string
  /** Tables (or stores) the authority is read from. Kernel tables are matched against migration 0013 by the test. */
  storage: readonly string[]
  /** Repo-root-relative files that derive authority from the record. */
  consumers: readonly string[]
  /** What stops the record conferring authority once the session / membership / lifecycle is gone. */
  gate: string
  status: SubordinateStatus
  /** Repo-root-relative test files proving the gate. Required for ENFORCED and FIXED. */
  proof: readonly string[]
  residual?: string
}

const KERNEL_PROOF = [
  'apps/union-eyes/db/__tests__/authority-kernel-revocation.pglite.test.ts',
  'apps/union-eyes/lib/authority/__tests__/kernel-revocation-sweep.test.ts',
] as const
const BINDING_PROOF = ['apps/union-eyes/lib/auth/__tests__/session-membership-revocation.pglite.test.ts'] as const

export const SUBORDINATE_AUTHORITY_REGISTER: readonly SubordinateAuthorityRecord[] = [
  {
    id: 'mandates',
    record: 'Mandates: supervisory, emergency access, executive office, financial, governance review',
    storage: ['ue_authority_mandates', 'ue_authority_acceptances'],
    consumers: ['apps/union-eyes/lib/authority/store/facts.ts', 'apps/union-eyes/lib/authority/policies/case.ts', 'apps/union-eyes/lib/authority/policies/governance.ts', 'apps/union-eyes/lib/authority/policies/finance.ts'],
    gate: 'Every policy family opens with activeMembership(); the membership source reads canonical lifecycle and active flags at decision time.',
    status: 'ENFORCED',
    proof: KERNEL_PROOF,
  },
  {
    id: 'delegations',
    record: 'Executive delegations',
    storage: ['ue_authority_delegations'],
    consumers: ['apps/union-eyes/lib/authority/store/facts.ts', 'apps/union-eyes/lib/authority/policies/case.ts', 'apps/union-eyes/lib/authority/policies/governance.ts'],
    gate: 'The delegate needs an active membership and the DELEGATOR must still hold one (DELEGATION_INVALID); loadAuthorityFacts loads the delegator’s membership with the delegate’s.',
    status: 'ENFORCED',
    proof: KERNEL_PROOF,
  },
  {
    id: 'resource-relationships',
    record: 'Case assignments, collaborator grants and the creator / represented-member relationships',
    storage: ['ue_authority_resource_relationships'],
    consumers: ['apps/union-eyes/lib/authority/store/facts.ts', 'apps/union-eyes/lib/authority/store/resources.ts', 'apps/union-eyes/lib/authority/policies/case.ts'],
    gate: 'The case policy checks the principal’s active membership before it reads any relationship; offboarding relies on exactly this (member-access-revocation-service).',
    status: 'ENFORCED',
    proof: KERNEL_PROOF,
  },
  {
    id: 'issuance-approvals',
    record: 'Approval decisions counted toward issuing a mandate, delegation, assignment or emergency grant',
    storage: ['ue_authority_approval_requests', 'ue_authority_approval_decisions'],
    consumers: ['apps/union-eyes/lib/authority/store/lifecycle.ts', 'apps/union-eyes/lib/authority/issuance.ts'],
    gate: 'liveApprovalLines(): an approval counts only while its approver is STILL an active member when the instrument is issued; an emergency grant cannot name an approver who has since left.',
    status: 'FIXED',
    proof: ['apps/union-eyes/db/__tests__/authority-kernel-revocation.pglite.test.ts'],
  },
  {
    id: 'rule-adoption-approvals',
    record: 'Approvals that activate an issuance rule',
    storage: ['ue_authority_issuance_rules', 'ue_authority_approval_decisions'],
    consumers: ['apps/union-eyes/lib/authority/store/lifecycle.ts'],
    gate: 'activateIssuanceRule() re-checks every approver with requireAdopter() (an active member holding an adoption capacity).',
    status: 'ENFORCED',
    proof: ['apps/union-eyes/db/__tests__/authority-kernel-revocation.pglite.test.ts'],
  },
  {
    id: 'counsel-engagements',
    record: 'Counsel engagements: member-counsel capacity',
    storage: ['ue_authority_counsel_engagements', 'ue_authority_workaid_matters'],
    consumers: ['apps/union-eyes/lib/authority/store/enforce.ts', 'apps/union-eyes/lib/authority/store/counsel.ts'],
    gate: 'requireCounselSession() refuses a union member whose membership is not active (COUNSEL_MEMBERSHIP_NOT_ACTIVE); the engagement is an appointment, not a membership.',
    status: 'FIXED',
    proof: ['apps/union-eyes/db/__tests__/authority-kernel-revocation.pglite.test.ts'],
  },
  {
    id: 'external-counsel',
    record: 'Counsel engagements: external counsel (no union membership)',
    storage: ['ue_authority_counsel_engagements', 'ue_authority_counsel_nonces'],
    consumers: ['apps/union-eyes/lib/authority/store/enforce.ts', 'apps/union-eyes/lib/authority/store/counsel.ts'],
    gate: 'No implementation ships: every counsel-attributed act is refused unless a deployment supplies a verifier, and an engagement is revocable at once. Counsel has no membership to revoke.',
    status: 'OPEN',
    proof: [],
    residual:
      'Counsel-side authentication is not built. When it is, the verifier must fail closed on the counsel principal’s own lifecycle and session; this cannot be proven without that component and a deployed kernel storage.',
  },
  {
    id: 'workaid-referral',
    record: 'WorkAid referral authority (relationship to the underlying case plus member consent)',
    storage: ['ue_authority_workaid_matters', 'ue_authority_disclosure_consents', 'ue_authority_resource_relationships'],
    consumers: ['apps/union-eyes/lib/authority/policies/workaid.ts', 'apps/union-eyes/lib/authority/store/enforce.ts'],
    gate: 'decideWorkAid() opens with activeMembership(); the relationship it relies on is the case relationship above.',
    status: 'ENFORCED',
    proof: ['apps/union-eyes/lib/authority/__tests__/kernel-revocation-sweep.test.ts'],
  },
  {
    id: 'workaid-union-side-disclosure',
    record: 'WorkAid consent grants, document authorisations, shares and the counsel-access log',
    storage: ['ue_authority_workaid_consent_texts', 'ue_authority_workaid_consent_grants', 'ue_authority_workaid_document_auths', 'ue_authority_workaid_shares', 'ue_authority_workaid_counsel_access'],
    consumers: [],
    gate: 'Owned by the WorkAid lane (platform migration 0027).',
    status: 'OTHER_LANE',
    proof: [],
    residual: 'Not reviewed for revocation here. The counsel-access table is an append-only record of served manifests, not an authority source.',
  },
  {
    id: 'triage-designations',
    record: 'Triage designations (messages and cases)',
    storage: ['triage_designations'],
    consumers: ['apps/union-eyes/lib/triage/designations.ts', 'apps/union-eyes/lib/messaging/thread-assignment.ts', 'apps/union-eyes/lib/cases/case-authorization.ts'],
    gate: 'A designation is only ever consulted for the AUTHENTICATED actor (td.user_id = actor.userId), and that actor exists only if the route guard produced a binding (live session + active membership + active lifecycle). The designation predicates themselves also require the holder\'s live eligible staff membership (Canonical V2: public.ue_case_assignee_authorized; legacy lineage: the organization_members compatibility projection with the assignment-eligible roles), so a removed, suspended, deleted or demoted holder loses the queue and the notifications at once.',
    status: 'LAYERED',
    proof: BINDING_PROOF,
    residual:
      'Proved on PGlite for both membership lineages (lib/cases/kernel-claims.pglite.test.ts, with a labelled test double of the V2 predicate) and on native PostgreSQL 15 and 16 for the legacy lineage as the runtime role (thread-assignment, message-lifecycle). The V2 predicate itself is not proved natively against a designation here: the combined test database does not install the Canonical V2 topology.',
  },
  {
    id: 'external-representation',
    record: 'Representation authorities and external matter / document access grants',
    storage: ['representation_authorities', 'external_matter_access_grants', 'external_document_access_grants'],
    consumers: ['apps/union-eyes/lib/services/external-resource-authorization-service.ts', 'apps/union-eyes/lib/external-resource-middleware.ts'],
    gate: 'The authorisation evaluator judges the records only; it is reachable only through withRLSContext({ organizationId }) in the middleware, whose V2 binder requires a live session AND an active membership in the matter’s organization.',
    status: 'LAYERED',
    proof: BINDING_PROOF,
    residual:
      'In V2 an external representative therefore needs an active membership in the matter organization (the feature is as narrow as the guard). The evaluator does not check the representative’s own lifecycle; the legacy lineage relies on session revocation.',
  },
  {
    id: 'document-grants',
    record: 'Internal document access (case-linked documents)',
    storage: ['documents', 'document_links'],
    consumers: ['apps/union-eyes/lib/authority/store/enforce.ts', 'apps/union-eyes/lib/authority/store/resources.ts'],
    gate: 'enforceDocumentRead() delegates to the kernel case decision for the linked case; there is no separate document grant record.',
    status: 'ENFORCED',
    proof: KERNEL_PROOF,
  },
  {
    id: 'legacy-case-access-assignments',
    record: 'grievance_case_access_assignments (secondary LRO / reviewer / read-only)',
    storage: ['grievance_case_access_assignments'],
    consumers: [],
    gate: 'No reader remains: the kernel deliberately does not read the pre-kernel collaborator table, and revokeMemberAccess no longer rewrites it.',
    status: 'NO_LIVE_CONSUMER',
    proof: [],
  },
  {
    id: 'api-keys',
    record: 'integration_api_keys and service tokens',
    storage: ['integration_api_keys'],
    consumers: ['apps/union-eyes/lib/api/crud-governance.ts', 'apps/union-eyes/lib/api/with-api.ts'],
    gate: 'Nothing authenticates from key_hash: the CRUD route for the table is DENIED by governance and the only machine credential is the shared CRON secret, which is not derived from any principal.',
    status: 'NO_LIVE_CONSUMER',
    proof: [],
    residual: 'If a key authenticator is ever added it must resolve to a principal and be bound through the same binder; this register entry must then be re-opened.',
  },
  {
    id: 'sessions',
    record: 'Sessions (cookie / bearer) and the 30-second bridge row minted from them',
    storage: ['user_management.user_sessions'],
    consumers: ['packages/platform-auth/src/org-binding.ts', 'packages/platform-auth/src/password/session.ts', 'packages/platform-auth/src/lifecycle/service.ts'],
    gate: 'validateSession() requires an active, unexpired row; the binder additionally requires an active user, lifecycle active and an active membership on every call; deprovisioning and offboarding revoke every session.',
    status: 'ENFORCED',
    proof: BINDING_PROOF,
    residual:
      'A bridge outlives revocation of its parent session by at most 30 seconds (the definer predicates check the bridge row, not its parent); closing that needs a parent link and a predicate migration. Suspension does not revoke sessions; the binder refuses them regardless.',
  },
  {
    id: 'invite-tokens',
    record: 'Admin-issued invite tokens',
    storage: ['user_management.invites'],
    consumers: ['packages/platform-auth/src/invites/service.ts'],
    gate: 'Single use, 7 days, hashed, role fixed by the row and capped to the tenant-assignable roles; the new session is minted only for an active, lifecycle-active user.',
    status: 'OPEN',
    proof: [],
    residual:
      'An invite survives the INVITER’s removal: acceptance does not re-check that the inviter is still an active administrator of the organization. Under the deployed auth policies the redemption role cannot read the inviter’s membership, so the check cannot be added in application code; it needs the `inviteLive` predicate in packages/db/src/auth-storage-authority/bootstrap-sql.ts to join the inviter’s live admin membership (governed migration, proven on the native auth suite). The role an invite can confer is a plain tenant role, never a kernel authority.',
  },
  {
    id: 'mfa-challenges',
    record: 'MFA challenge tokens',
    storage: ['user_management.mfa_challenges'],
    consumers: ['packages/platform-auth/src/mfa/service.ts'],
    gate: 'consumeMfaChallenge() re-checks the account (active and lifecycle active) before any code is verified or session minted.',
    status: 'FIXED',
    proof: ['packages/platform-auth/src/mfa/consume-lifecycle.test.ts'],
  },
  {
    id: 'first-factor-tokens',
    record: 'Magic links, invite acceptance and password-reset follow-on sessions',
    storage: ['user_management.magic_links', 'user_management.invites', 'user_management.password_reset_tokens'],
    consumers: ['packages/platform-auth/src/complete-auth.ts', 'packages/platform-auth/src/magic-link/service.ts'],
    gate: 'completeAuthFirstFactor() refuses an account that is not active or whose lifecycle is not active before issuing a session.',
    status: 'ENFORCED',
    proof: ['packages/platform-auth/src/complete-auth.test.ts'],
  },
  {
    id: 'legacy-lineage-route-guard',
    record: 'Legacy-lineage ordinary context (UE_CANONICAL_BOOTSTRAP_V2 != 1): token / metadata organization selectors',
    storage: ['public.organization_members'],
    consumers: ['apps/union-eyes/lib/db/with-rls-context.ts', 'apps/union-eyes/lib/api-auth-guard.ts'],
    gate: 'Password sessions are validated and offboarding revokes all sessions; the legacy path does not re-verify membership per request.',
    status: 'OPEN',
    proof: [],
    residual:
      'Production is specified as V2 only. The legacy path trusts the organization from the session or token and falls back to a default role; it is not closed and must not be described as closed. Retiring the legacy lineage closes it.',
  },
]

/**
 * Kernel tables (platform migration 0013) that hold no principal authority of their own: audit trails, restrictions,
 * counters and structure. The register test requires every 0013 table to be either listed in an entry's `storage` or here.
 */
export const NON_CONFERRING_KERNEL_TABLES: Readonly<Record<string, string>> = {
  ue_authority_events: 'append-only record of mutations',
  ue_authority_requests: 'idempotency / request register',
  ue_authority_recusals: 'only ever REMOVES authority',
  ue_authority_financial_steps: 'record of acts already performed; authority comes from the principal’s financial mandate',
  ue_authority_reviews: 'resource facts for governance reviews, not a grant',
}
