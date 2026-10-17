import type {
  InstitutionalWorkflowRun,
  WorkflowStateData,
  VersionRef,
} from '../institutional-workflow/contracts'
import type { ResolutionResult } from '../evidence-resolution/contracts'
import type { FreshnessState, RightsSnapshot, SafeJsonValue } from '../source-continuity/contracts'
import type { ReuseQualification } from '../evidence-reuse/contracts'
import { evaluateRights } from '../source-continuity/rights'
import { workflowMetrics } from '../institutional-workflow/ledger'

export const resolutionLanguage: Record<ResolutionResult['state'], string> = {
  MATCHED:
    'The evidence meets the technical requirements checked by Cora. This is not institutional approval.',
  PARTIAL: 'Some required evidence is available, but additional information is needed.',
  UNKNOWN: 'Cora cannot establish whether the evidence meets this requirement.',
  CONFLICT: 'Source assertions disagree. Cora has not selected a winner.',
  EXPIRED: 'The evidence or authorization is outside its stated validity period.',
  NOT_AUTHORIZED:
    'Cora does not currently have permission to use this evidence for this institution.',
  NOT_SATISFIED: 'The evidence does not meet this institution’s specific technical requirement.',
}
export const freshnessLanguage: Record<FreshnessState, string> = {
  CURRENT:
    'Currentness was explicitly verified at the recorded time; this is not a guarantee of later source state.',
  STALE: 'The evidence is stale. Do not treat it as current.',
  NOT_VERIFIED: 'Evidence currentness has not been verified.',
  UNKNOWN: 'Evidence currentness is unknown.',
}
const lifecycleLanguage: Record<InstitutionalWorkflowRun['state'], string> = {
  REQUESTED: 'Workflow requested',
  AUTHORIZED: 'Use authorized for this context',
  EVIDENCE_BOUND: 'Evidence linked to this requirement',
  RESOLVED: 'Technical check recorded',
  REUSE_EVALUATED: 'Reuse check recorded',
  AWAITING_RECIPIENT_DISPOSITION: 'Awaiting the recipient’s decision reference',
  DISPOSITION_RECORDED: 'Recipient decision reference recorded',
  SUPERSEDED: 'Replaced by a newer workflow',
  REVOKED: 'Authorization revoked',
  FAILED: 'Workflow stopped',
}
export interface OperatorWorkflowAvailableView {
  access: 'ALLOWED'
  workflowId: string
  runId: string
  lifecycle: InstitutionalWorkflowRun['state']
  lifecycleMessage: string
  status: 'CURRENT_CONTEXT' | 'HISTORICAL_ONLY'
  statusReason: string
  actionable: boolean
  currentCheckState: ResolutionResult['state']
  institution: string
  recipient: string
  purpose: string
  evidence: {
    reference: VersionRef
    provider: string
    issuer: string
    class: string
    provenanceRef: string
    provenanceDigest: string
    capsuleRef: string
    observedAt: string | null
    validFrom: string | null
    validUntil: string | null
    limitations: string[]
  }
  freshness: { state: FreshnessState; message: string; verifiedAt: string | null }
  permissions: {
    status: 'ALLOWED' | 'NOT_AUTHORIZED'
    recipient: string
    purpose: string
    expiresAt: string | null
    revokedAt: string | null
    reasons: string[]
    actions: { label: string; allowed: boolean }[]
    viewingAuthorizationRef: string
    rawRecipient: RightsSnapshot
    rawSource: RightsSnapshot
  }
  requirement: { reference: VersionRef; owner: string; interpretation: VersionRef }
  technical: {
    state: ResolutionResult['state']
    message: string
    evaluatedAt: string | null
    historical: boolean
    criteria: {
      ref: string
      state: 'MATCHED' | 'MISSING' | 'CONFLICT' | 'NOT_MET' | 'UNRESOLVED'
    }[]
    unresolvedSemantics: string[]
    conflicts: {
      criterion: string
      assertions: {
        evidenceId: string
        version: string
        issuer: string
        provider: string
        value: SafeJsonValue
      }[]
    }[]
  }
  reuse: {
    qualification: ReuseQualification | 'NOT_EVALUATED'
    originRunId: string | null
    originContext: string | null
    consumingContext: string
    reconstructionAvoided: boolean
    reasons: string[]
    historical: boolean
    noNewRetrieval: boolean
  }
  decision: {
    status: 'REFERENCE_RECORDED' | 'AWAITING_RECIPIENT' | 'NO_REFERENCE'
    owner: string
    reference: string | null
    at: string | null
  }
  lineage: {
    auditId: string
    prior: string | null
    next: string
    at: string
    evidence: VersionRef
    requirement: VersionRef
    reason: string
  }[]
  successorRunIds: string[]
  metrics: ReturnType<typeof workflowMetrics>
}
export type OperatorInstitutionalWorkflowView =
  | OperatorWorkflowAvailableView
  | { access: 'DENIED'; message: string }

export function projectOperatorWorkflowView(input: {
  run: InstitutionalWorkflowRun
  checked: ResolutionResult
  rights: RightsSnapshot
  sourceRights: RightsSnapshot
  at: string
  viewingAuthorizationRef: string
  currentlyVerifiedAt?: string
  successors: string[]
  data: WorkflowStateData
}): OperatorWorkflowAvailableView {
  const { run, rights, sourceRights, at, data } = input
  const context = { purpose: run.purpose, recipientId: run.recipientId, at }
  const disclosure = evaluateRights(rights, 'DISCLOSE', context)
  const sourceDisclosure = evaluateRights(sourceRights, 'DISCLOSE', context)
  const historical = ['FAILED', 'REVOKED', 'SUPERSEDED'].includes(run.state)
  const result = run.resolution?.result ?? input.checked
  const validVerification =
    input.currentlyVerifiedAt &&
    Number.isFinite(Date.parse(input.currentlyVerifiedAt)) &&
    Date.parse(input.currentlyVerifiedAt) <= Date.parse(at)
  let freshness = run.use.assertion.evidence.freshness ?? 'UNKNOWN'
  if (freshness === 'CURRENT' && (!validVerification || historical)) freshness = 'NOT_VERIFIED'
  const assertions = [run.use.assertion, ...run.use.supplementalAssertions]
  const unresolved = new Set(result.unresolvedCriterionRefs)
  const criteria = run.use.requirement.requiredCriterionRefs.map((ref) => {
    const reason = result.reasonRefs.find((item) => item.endsWith(`:${ref}`))
    const state = reason?.startsWith('CRITERION_CONFLICT:')
      ? ('CONFLICT' as const)
      : reason?.startsWith('CRITERION_NOT_MET:')
        ? ('NOT_MET' as const)
        : reason?.startsWith('CRITERION_UNKNOWN:')
          ? ('MISSING' as const)
          : !unresolved.has(ref)
            ? ('MATCHED' as const)
            : ('UNRESOLVED' as const)
    return { ref, state }
  })
  const conflicts = criteria
    .filter((criterion) => criterion.state === 'CONFLICT')
    .map((criterion) => {
      const concept = run.use.interpretation.rules.find(
        (rule) => rule.criterionRef === criterion.ref,
      )?.conceptRef
      return {
        criterion: criterion.ref,
        assertions: assertions.flatMap((assertion) =>
          assertion.support.claims
            .filter((claim) => claim.conceptRef === concept)
            .map((claim) => ({
              evidenceId: assertion.evidence.evidenceId,
              version: assertion.evidence.version,
              issuer: assertion.evidence.sourceAuthorityId,
              provider: assertion.support.sourceRef.providerId,
              value: claim.value,
            })),
        ),
      }
    })
  const permissionReasons = [...disclosure.reasons, ...sourceDisclosure.reasons]
  const event = run.reuse?.event
  return {
    access: 'ALLOWED',
    workflowId: run.workflowId,
    runId: run.runId,
    lifecycle: run.state,
    lifecycleMessage: lifecycleLanguage[run.state],
    status: historical ? 'HISTORICAL_ONLY' : 'CURRENT_CONTEXT',
    statusReason: historical
      ? 'Historical record only. This result is not currently actionable.'
      : 'Authorized workflow context; evidence currentness is reported separately.',
    actionable: !historical && disclosure.allowed && sourceDisclosure.allowed,
    currentCheckState: input.checked.state,
    institution: run.recipientInstitutionId,
    recipient: run.recipientId,
    purpose: run.purpose,
    evidence: {
      reference: run.evidence.reference,
      provider: run.use.assertion.support.sourceRef.providerId,
      issuer: run.use.assertion.evidence.sourceAuthorityId,
      class: run.use.assertion.evidenceClass,
      provenanceRef: run.use.assertion.evidence.provenanceRef,
      provenanceDigest: run.evidence.sourceProvenanceSha256,
      capsuleRef: run.evidence.capsuleRef,
      observedAt: run.use.assertion.evidence.observedAt ?? null,
      validFrom: run.use.assertion.evidence.validFrom ?? null,
      validUntil: run.use.assertion.evidence.validUntil ?? null,
      limitations: run.use.assertion.support.limitations,
    },
    freshness: {
      state: freshness,
      message: freshnessLanguage[freshness],
      verifiedAt: freshness === 'CURRENT' ? input.currentlyVerifiedAt! : null,
    },
    permissions: {
      status: disclosure.allowed && sourceDisclosure.allowed ? 'ALLOWED' : 'NOT_AUTHORIZED',
      recipient: run.recipientId,
      purpose: run.purpose,
      expiresAt:
        [rights.expiresAt, sourceRights.expiresAt]
          .filter((time): time is string => !!time)
          .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null,
      revokedAt:
        [rights.revokedAt, sourceRights.revokedAt]
          .filter((time): time is string => !!time)
          .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null,
      reasons: permissionReasons,
      actions: (
        [
          ['Use for this institution', 'DISCLOSE'],
          ['Keep a copy', 'PERSIST'],
          ['Transform source content', 'TRANSFORM'],
          ['Export', 'EXPORT'],
          ['Restore offline', 'REHYDRATE'],
        ] as const
      ).map(([label, action]) => ({
        label,
        allowed:
          !historical &&
          evaluateRights(rights, action, context).allowed &&
          evaluateRights(sourceRights, action, context).allowed,
      })),
      viewingAuthorizationRef: input.viewingAuthorizationRef,
      rawRecipient: rights,
      rawSource: sourceRights,
    },
    requirement: {
      reference: run.requirement.reference,
      owner: run.recipientInstitutionId,
      interpretation: run.requirement.interpretation,
    },
    technical: {
      state: result.state,
      message:
        historical && result.state === 'MATCHED'
          ? 'At the recorded check, the evidence met the technical requirements checked by Cora. This historical result is not current permission or institutional approval.'
          : resolutionLanguage[result.state],
      evaluatedAt: run.resolution?.at ?? null,
      historical,
      criteria,
      conflicts,
      unresolvedSemantics: result.reasonRefs.filter((reason) => !reason.startsWith('CRITERION_')),
    },
    reuse: {
      qualification: event?.qualification ?? 'NOT_EVALUATED',
      originRunId: run.originatingRunId ?? null,
      originContext: event?.originating.contextId ?? null,
      consumingContext: run.use.contextId,
      reconstructionAvoided:
        event?.qualification === 'QUALIFIED_REUSE' && event.reconstructionAvoided === 'ESTABLISHED',
      reasons: event?.rejectionReasons ?? [],
      historical,
      noNewRetrieval:
        event?.qualification === 'QUALIFIED_REUSE' &&
        event.reconstructionEvidence.sourceRetrieval === 0,
    },
    decision: {
      status: run.disposition
        ? 'REFERENCE_RECORDED'
        : run.state === 'AWAITING_RECIPIENT_DISPOSITION'
          ? 'AWAITING_RECIPIENT'
          : 'NO_REFERENCE',
      owner: run.use.decisionAuthorityRef,
      reference: run.disposition?.externalDispositionRef ?? null,
      at: run.disposition?.recordedAt ?? null,
    },
    lineage: data.audit
      .filter((entry) => entry.runId === run.runId)
      .map((entry) => ({
        auditId: entry.auditId,
        prior: entry.priorState,
        next: entry.nextState,
        at: entry.at,
        evidence: entry.evidence,
        requirement: entry.requirement,
        reason: entry.reason,
      })),
    successorRunIds: input.successors,
    metrics: workflowMetrics(data, run),
  }
}
