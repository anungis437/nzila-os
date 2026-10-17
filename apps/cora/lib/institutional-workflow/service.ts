import type { CoraAuthorizationContext } from '../resolve-org'
import { rightsSnapshotSchema } from '../source-continuity/contracts'
import { evaluateRights } from '../source-continuity/rights'
import { governedAssertionSchema, institutionalUseSchema } from '../evidence-reuse/contracts'
import { resolveInstitutionalUse } from '../evidence-reuse/resolve-use'
import { qualifyEvidenceReuse } from '../evidence-reuse/reuse'
import {
  projectOperatorWorkflowView,
  type OperatorInstitutionalWorkflowView,
} from '../operator-workflow/view'
import {
  WORKFLOW_PERMISSION,
  DISPOSITION_PERMISSION,
  WorkflowDenied,
  workflowRequestSchema,
  dispositionRequestSchema,
  type WorkflowPorts,
  type WorkflowStateData,
  type InstitutionalWorkflowRun,
  type WorkflowRequest,
  type RequirementDefinition,
} from './contracts'
import {
  appendTransition,
  appendFriction,
  frictionCounts,
  workflowDigest,
  workflowMetrics,
} from './ledger'

function exactRequirement(
  definition: RequirementDefinition,
  orgId: string,
  request: WorkflowRequest,
): void {
  const requirement = definition.use.requirement
  if (
    definition.orgId !== orgId ||
    requirement.requirementRef !== request.requirement.id ||
    requirement.requirementVersion !== request.requirement.version
  ) {
    throw new WorkflowDenied('Requirement organization or immutable version mismatch')
  }
}
function ownedRun(
  data: WorkflowStateData,
  id: string,
  context: CoraAuthorizationContext,
  disposition = false,
): InstitutionalWorkflowRun {
  const run = data.runs.find((item) => item.runId === id && item.orgId === context.orgId)
  if (!run || (!disposition && run.actorId !== context.actorId))
    throw new WorkflowDenied('Workflow tenant or actor mismatch')
  return run
}

export function createInstitutionalWorkflowService(ports: WorkflowPorts) {
  async function trusted(permission: string) {
    const context = await ports.resolveContext(permission)
    if (
      context.appId !== 'cora' ||
      !context.orgId ||
      !context.actorId ||
      context.identityBindingState !== 'active' ||
      context.membershipState !== 'active' ||
      !context.permissions.includes(permission)
    ) {
      await ports.recordDenial(context, 'CANONICAL_ACTOR_AUTHORITY_REQUIRED')
      throw new WorkflowDenied('Canonical actor authority required')
    }
    return context
  }
  function now() {
    const at = ports.now()
    if (!Number.isFinite(Date.parse(at))) throw new WorkflowDenied('Invalid server clock')
    return at
  }
  async function guarded<T>(
    context: CoraAuthorizationContext,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof WorkflowDenied) await ports.recordDenial(context, error.message)
      throw error
    }
  }
  async function currentRights(
    context: CoraAuthorizationContext,
    run: InstitutionalWorkflowRun,
    at: string,
  ) {
    return rightsSnapshotSchema.parse(await ports.authorize(context, structuredClone(run.use), at))
  }
  async function boundary(
    data: WorkflowStateData,
    run: InstitutionalWorkflowRun,
    context: CoraAuthorizationContext,
    at: string,
  ): Promise<boolean> {
    const definition = await ports.loadRequirement(context.orgId, run.requirement.reference)
    exactRequirement(definition, context.orgId, {
      requirement: run.requirement.reference,
      evidence: run.evidence.reference,
    })
    const rights = await currentRights(context, run, at)
    const decision = evaluateRights(rights, 'DISCLOSE', {
      purpose: run.purpose,
      recipientId: run.recipientId,
      at,
    })
    const sourceRights = rightsSnapshotSchema.parse(
      await ports.authorizeSource(context, structuredClone(run.use), at),
    )
    const sourceDecision = evaluateRights(sourceRights, 'DISCLOSE', {
      purpose: run.purpose,
      recipientId: run.recipientId,
      at,
    })
    if (!decision.allowed || !sourceDecision.allowed) {
      appendTransition(
        data,
        run,
        'REVOKED',
        context.actorId,
        at,
        [...decision.reasons, ...sourceDecision.reasons].join(','),
        rights,
        sourceRights,
      )
      return false
    }
    if (
      rights.decisionRef !== run.authorizationRef ||
      workflowDigest(rights) !== run.authorizationContextSha256 ||
      workflowDigest(sourceRights) !== workflowDigest(run.use.assertion.support.rights) ||
      definition.superseded ||
      workflowDigest(definition.use) !== run.requirement.definitionSha256
    ) {
      appendTransition(
        data,
        run,
        'SUPERSEDED',
        context.actorId,
        at,
        'REQUIREMENT_OR_AUTHORIZATION_CONTEXT_CHANGED',
        rights,
        sourceRights,
      )
      return false
    }
    const evidence = await ports.loadEvidence(context.orgId, run.evidence.reference)
    if (evidence.orgId !== context.orgId || evidence.assertion.support.orgId !== context.orgId) {
      throw new WorkflowDenied('Evidence tenant mismatch during revalidation')
    }
    const loadedDigest =
      (evidence.supplementalAssertions?.length ?? 0) > 0
        ? workflowDigest({
            assertion: evidence.assertion,
            supplementalAssertions: evidence.supplementalAssertions,
          })
        : workflowDigest(evidence.assertion)
    if (loadedDigest !== run.evidence.assertionSha256) {
      appendTransition(
        data,
        run,
        'SUPERSEDED',
        context.actorId,
        at,
        'IMMUTABLE_EVIDENCE_CHANGED',
        rights,
      )
      return false
    }
    const checked = resolveInstitutionalUse(run.use, ports.authority, at)
    if (!['MATCHED', 'PARTIAL', 'NOT_SATISFIED'].includes(checked.technical.state)) {
      appendTransition(
        data,
        run,
        checked.technical.state === 'NOT_AUTHORIZED'
          ? 'REVOKED'
          : run.state === 'DISPOSITION_RECORDED'
            ? 'SUPERSEDED'
            : 'FAILED',
        context.actorId,
        at,
        checked.technical.reasonRefs.join(',') || checked.technical.state,
        rights,
      )
      return false
    }
    return true
  }

  return {
    async request(input: WorkflowRequest): Promise<InstitutionalWorkflowRun> {
      const context = await trusted(WORKFLOW_PERMISSION)
      const request = workflowRequestSchema.parse(input)
      return guarded(context, () =>
        ports.storage.transaction(context.orgId, async (data) => {
          const at = now()
          const definition = await ports.loadRequirement(context.orgId, request.requirement)
          exactRequirement(definition, context.orgId, request)
          if (definition.superseded) throw new WorkflowDenied('Requirement superseded')
          const evidence = await ports.loadEvidence(context.orgId, request.evidence)
          const assertion = governedAssertionSchema.parse(evidence.assertion)
          if (
            evidence.orgId !== context.orgId ||
            assertion.support.orgId !== context.orgId ||
            assertion.evidence.evidenceId !== request.evidence.id ||
            assertion.evidence.version !== request.evidence.version
          ) {
            throw new WorkflowDenied('Evidence tenant or immutable version mismatch')
          }
          const supplementalAssertions = (evidence.supplementalAssertions ?? []).map((item) =>
            governedAssertionSchema.parse(item),
          )
          if (supplementalAssertions.some((item) => item.support.orgId !== context.orgId)) {
            throw new WorkflowDenied('Supplemental evidence tenant mismatch')
          }
          const use = institutionalUseSchema.parse({
            ...definition.use,
            assertion,
            supplementalAssertions,
          })
          const rights = rightsSnapshotSchema.parse(
            await ports.authorize(context, structuredClone(use), at),
          )
          const decision = evaluateRights(rights, 'DISCLOSE', {
            purpose: use.requirement.purpose,
            recipientId: use.requirement.recipientId,
            at,
          })
          if (!decision.allowed)
            throw new WorkflowDenied(`Authorization denied: ${decision.reasons.join(',')}`)
          const sourceRights = rightsSnapshotSchema.parse(
            await ports.authorizeSource(context, structuredClone(use), at),
          )
          const sourceDecision = evaluateRights(sourceRights, 'DISCLOSE', {
            purpose: use.requirement.purpose,
            recipientId: use.requirement.recipientId,
            at,
          })
          if (!sourceDecision.allowed)
            throw new WorkflowDenied(
              `Source authorization denied: ${sourceDecision.reasons.join(',')}`,
            )
          if (workflowDigest(sourceRights) !== workflowDigest(assertion.support.rights))
            throw new WorkflowDenied(
              'Source authorization context requires a newly governed evidence binding',
            )
          use.requirement.rights = rights
          const authorizationContextSha256 = workflowDigest(rights)
          const evidenceBinding = {
            reference: request.evidence,
            assertionSha256:
              supplementalAssertions.length > 0
                ? workflowDigest({ assertion, supplementalAssertions })
                : workflowDigest(assertion),
            sourceProvenanceSha256: workflowDigest({
              sourceRef: assertion.support.sourceRef,
              provenanceRef: assertion.support.provenanceRef,
              edges: assertion.support.provenanceEdgeRefs,
              capsuleSha256: assertion.support.capsuleSha256,
            }),
            capsuleRef: assertion.support.capsuleId,
          }
          const requirementBinding = {
            reference: request.requirement,
            interpretation: {
              id: use.interpretation.interpretationRef,
              version: use.interpretation.version,
            },
            definitionSha256: workflowDigest(definition.use),
          }
          if (request.originatingRunId) {
            const origin = ownedRun(data, request.originatingRunId, context)
            if (
              !origin.resolution ||
              ![
                'REUSE_EVALUATED',
                'AWAITING_RECIPIENT_DISPOSITION',
                'DISPOSITION_RECORDED',
              ].includes(origin.state)
            ) {
              throw new WorkflowDenied('Originating workflow is not eligible for reuse')
            }
          }
          const idempotencyKey = workflowDigest({
            orgId: context.orgId,
            actorId: context.actorId,
            institutionId: use.institutionId,
            recipientId: use.requirement.recipientId,
            purpose: use.requirement.purpose,
            evidenceBinding,
            requirementBinding,
            authorizationContextSha256,
            originatingRunId: request.originatingRunId ?? null,
          })
          const replay = data.runs.find((run) => run.idempotencyKey === idempotencyKey)
          if (replay) {
            if (['FAILED', 'REVOKED', 'SUPERSEDED'].includes(replay.state))
              throw new WorkflowDenied('Terminal request requires a new governed context')
            await boundary(data, replay, context, at)
            return replay
          }
          const predecessor = data.runs.findLast(
            (run) =>
              run.actorId === context.actorId &&
              run.recipientId === use.requirement.recipientId &&
              run.requirement.reference.id === request.requirement.id &&
              run.evidence.reference.id === request.evidence.id,
          )
          const run: InstitutionalWorkflowRun = {
            workflowId: `workflow:${idempotencyKey}`,
            runId: `run:${idempotencyKey}`,
            idempotencyKey,
            orgId: context.orgId,
            actorId: context.actorId,
            recipientInstitutionId: use.institutionId,
            recipientId: use.requirement.recipientId,
            purpose: use.requirement.purpose,
            evidence: evidenceBinding,
            requirement: requirementBinding,
            authorizationRef: rights.decisionRef,
            authorizationContextSha256,
            requestedAt: at,
            state: 'REQUESTED',
            revision: 0,
            use,
            rightsSnapshot: structuredClone(rights),
            ...(request.originatingRunId ? { originatingRunId: request.originatingRunId } : {}),
            ...(predecessor ? { supersedesRunId: predecessor.runId } : {}),
          }
          appendTransition(
            data,
            run,
            'REQUESTED',
            context.actorId,
            at,
            'SERVER_BOUND_REQUEST',
            rights,
          )
          return run
        }),
      )
    },

    async advance(runId: string, expectedRevision?: number): Promise<InstitutionalWorkflowRun> {
      const context = await trusted(WORKFLOW_PERMISSION)
      return guarded(context, () =>
        ports.storage.transaction(context.orgId, async (data) => {
          const run = ownedRun(data, runId, context)
          if (['FAILED', 'REVOKED', 'SUPERSEDED'].includes(run.state))
            throw new WorkflowDenied('Workflow is terminal')
          const at = now()
          if (!(await boundary(data, run, context, at))) return run
          if (expectedRevision !== undefined) {
            if (
              !Number.isInteger(expectedRevision) ||
              expectedRevision < 1 ||
              expectedRevision > run.revision
            ) {
              throw new WorkflowDenied('Invalid expected workflow revision')
            }
            if (expectedRevision < run.revision) return run
          }
          const rights = run.rightsSnapshot
          if (run.state === 'REQUESTED') {
            const audit = appendTransition(
              data,
              run,
              'AUTHORIZED',
              context.actorId,
              at,
              'RECIPIENT_AUTHORIZATION_VERIFIED',
              rights,
            )
            appendFriction(data, run, 'permissionRemediation', context.actorId, at, audit)
          } else if (run.state === 'AUTHORIZED') {
            const audit = appendTransition(
              data,
              run,
              'EVIDENCE_BOUND',
              context.actorId,
              at,
              'IMMUTABLE_GOVERNED_REFERENCE_BOUND',
              rights,
            )
            if (!run.originatingRunId)
              appendFriction(data, run, 'sourceRetrieval', context.actorId, at, audit)
          } else if (run.state === 'EVIDENCE_BOUND') {
            const resolution = resolveInstitutionalUse(run.use, ports.authority, at)
            const auditRef = `${run.runId}:audit:${run.revision + 1}`
            run.resolution = { at, auditRef, result: resolution.technical }
            appendTransition(
              data,
              run,
              'RESOLVED',
              context.actorId,
              at,
              'INDEPENDENT_TECHNICAL_RESOLUTION',
              rights,
            )
            appendFriction(data, run, 'semanticClarification', context.actorId, at, auditRef)
          } else if (run.state === 'RESOLVED') {
            if (run.originatingRunId) {
              const origin = ownedRun(data, run.originatingRunId, context)
              if (
                ['REVOKED', 'SUPERSEDED', 'FAILED'].includes(origin.state) ||
                !(await boundary(data, origin, context, at))
              ) {
                appendTransition(
                  data,
                  run,
                  'FAILED',
                  context.actorId,
                  at,
                  'ORIGIN_NO_LONGER_REUSABLE',
                  rights,
                )
                return run
              }
              const counts = frictionCounts(data, run.runId)
              const event = qualifyEvidenceReuse(
                {
                  eventId: `${run.runId}:reuse`,
                  originating: origin.use,
                  consuming: run.use,
                  at,
                  acquisition: 'GOVERNED_REFERENCE',
                  reconstructionAvoided: 'ESTABLISHED',
                  reconstructionEvidence: {
                    traceRef: `${run.runId}:friction`,
                    contextId: run.use.contextId,
                    evidenceId: run.evidence.reference.id,
                    evidenceVersion: run.evidence.reference.version,
                    sourceRetrieval: counts.sourceRetrieval,
                    manualReentry: counts.manualReentry,
                    duplicateDocumentProduction: counts.duplicateDocumentProduction,
                    evidenceReconstruction: counts.evidenceReconstruction,
                  },
                  originDispositionUsedAsAuthority: false,
                },
                ports.authority,
              )
              const record = {
                at,
                auditRef: `${run.runId}:audit:${run.revision + 1}`,
                originatingRunId: origin.runId,
                event,
              }
              run.reuse = record
              const existing = data.reuseLedger.find(
                (item) => item.event.opportunityKey === event.opportunityKey,
              )
              if (existing && existing.event.qualification !== event.qualification)
                throw new WorkflowDenied('Conflicting reuse ledger opportunity')
              if (!existing) data.reuseLedger.push(structuredClone(record))
            }
            appendTransition(
              data,
              run,
              'REUSE_EVALUATED',
              context.actorId,
              at,
              run.reuse?.event.qualification ?? 'ORIGIN_CONTEXT_NO_REUSE',
              rights,
            )
          } else if (run.state === 'REUSE_EVALUATED') {
            appendTransition(
              data,
              run,
              'AWAITING_RECIPIENT_DISPOSITION',
              context.actorId,
              at,
              'RECIPIENT_DECISION_REMAINS_EXTERNAL',
              rights,
            )
          }
          return run
        }),
      )
    },

    async recordDisposition(input: {
      runId: string
      externalDispositionRef: string
    }): Promise<InstitutionalWorkflowRun> {
      const context = await trusted(DISPOSITION_PERMISSION)
      const request = dispositionRequestSchema.parse(input)
      return guarded(context, () =>
        ports.storage.transaction(context.orgId, async (data) => {
          const run = ownedRun(data, request.runId, context, true)
          if (
            run.state !== 'AWAITING_RECIPIENT_DISPOSITION' &&
            run.state !== 'DISPOSITION_RECORDED'
          )
            throw new WorkflowDenied('Workflow not awaiting recipient disposition')
          const at = now()
          const disposition = await ports.loadDisposition(
            context,
            structuredClone(run),
            request.externalDispositionRef,
          )
          if (
            disposition.recipientId !== run.recipientId ||
            disposition.decisionAuthorityRef !== run.use.decisionAuthorityRef ||
            disposition.externalDispositionRef !== request.externalDispositionRef ||
            !disposition.provenanceRef ||
            !disposition.auditRef ||
            !Number.isFinite(Date.parse(disposition.recordedAt)) ||
            Date.parse(disposition.recordedAt) > Date.parse(at) ||
            Date.parse(disposition.recordedAt) < Date.parse(run.requestedAt)
          ) {
            throw new WorkflowDenied('External recipient disposition authority or lineage mismatch')
          }
          if (!(await boundary(data, run, context, at))) return run
          if (run.disposition) {
            if (workflowDigest(run.disposition) !== workflowDigest(disposition))
              throw new WorkflowDenied('Disposition already recorded; use explicit supersession')
            return run
          }
          run.disposition = structuredClone(disposition)
          const audit = appendTransition(
            data,
            run,
            'DISPOSITION_RECORDED',
            context.actorId,
            at,
            'EXTERNAL_RECIPIENT_REFERENCE_RECORDED',
            run.rightsSnapshot,
          )
          appendFriction(data, run, 'institutionalReverification', context.actorId, at, audit)
          return run
        }),
      )
    },

    async recordFrictionAction(runId: string, eventRef: string) {
      const context = await trusted(WORKFLOW_PERMISSION)
      return guarded(context, () =>
        ports.storage.transaction(context.orgId, async (data) => {
          const run = ownedRun(data, runId, context)
          if (['FAILED', 'REVOKED', 'SUPERSEDED', 'DISPOSITION_RECORDED'].includes(run.state))
            throw new WorkflowDenied('Workflow does not accept additional actions')
          const at = now()
          if (!(await boundary(data, run, context, at))) return run
          const event = await ports.loadFrictionAction(context, structuredClone(run), eventRef)
          if (
            event.eventId !== eventRef ||
            event.runId !== run.runId ||
            event.orgId !== context.orgId ||
            event.actorId !== context.actorId ||
            !event.auditRef ||
            !(event.step in frictionCounts(data, runId)) ||
            !Number.isFinite(Date.parse(event.at)) ||
            Date.parse(event.at) > Date.parse(at) ||
            Date.parse(event.at) < Date.parse(run.requestedAt)
          )
            throw new WorkflowDenied('Workflow action authority or lineage mismatch')
          const existing = data.frictionLedger.find((item) => item.eventId === event.eventId)
          if (existing && workflowDigest(existing) !== workflowDigest(event))
            throw new WorkflowDenied('Conflicting workflow action')
          if (!existing) data.frictionLedger.push(structuredClone(event))
          return run
        }),
      )
    },

    async inspect(runId: string) {
      const context = await trusted(WORKFLOW_PERMISSION)
      return guarded(context, () =>
        ports.storage.transaction(context.orgId, async (data) => {
          const run = ownedRun(data, runId, context)
          if (!['FAILED', 'REVOKED', 'SUPERSEDED'].includes(run.state))
            await boundary(data, run, context, now())
          const latestAudit = data.audit.findLast((entry) => entry.runId === runId)
          if (!latestAudit) throw new WorkflowDenied('Workflow authorization lineage is missing')
          return {
            runId: run.runId,
            state: run.state,
            evidenceSource: run.use.assertion.support.sourceRef.providerId,
            sourceAuthority: run.use.assertion.evidence.sourceAuthorityId,
            requirementOwner: run.recipientInstitutionId,
            technicalResolution: run.resolution?.result.state ?? 'UNKNOWN',
            unresolvedGaps: run.resolution?.result.unresolvedCriterionRefs ?? [],
            reuseStatus: run.reuse?.event.qualification ?? 'NOT_EVALUATED',
            recipientDecisionOwner: run.use.decisionAuthorityRef,
            externalDispositionRef: run.disposition?.externalDispositionRef ?? null,
            freshness: run.use.assertion.evidence.freshness ?? 'UNKNOWN',
            permissions: latestAudit.rightsSnapshot,
            sourcePermissions: latestAudit.sourceRightsSnapshot,
            permissionsEvaluatedAt: latestAudit.at,
            boundPermissions: run.rightsSnapshot,
            lineage: data.audit.filter((entry) => entry.runId === runId),
            metrics: workflowMetrics(data, run),
            limitations: ['SYNTHETIC_LOCAL_RUNTIME', 'TECHNICAL_RESOLUTION_IS_NOT_APPROVAL'],
          }
        }),
      )
    },

    async inspectOperator(runId: string): Promise<OperatorInstitutionalWorkflowView> {
      try {
        const context = await trusted(WORKFLOW_PERMISSION)
        return await guarded(context, () =>
          ports.storage.transaction(context.orgId, async (data) => {
            const run = ownedRun(data, runId, context)
            const at = now()
            if (!['FAILED', 'REVOKED', 'SUPERSEDED'].includes(run.state))
              await boundary(data, run, context, at)
            const authorization = await ports.authorizeOperatorView?.(
              context,
              structuredClone(run),
              at,
            )
            const historical = ['FAILED', 'REVOKED', 'SUPERSEDED'].includes(run.state)
            if (
              !authorization?.allowed ||
              !authorization.authorizationRef ||
              (historical && !authorization.historical)
            ) {
              throw new WorkflowDenied('Operator evidence viewing permission not established')
            }
            const rights = await currentRights(context, run, at)
            const sourceRights = rightsSnapshotSchema.parse(
              await ports.authorizeSource(context, structuredClone(run.use), at),
            )
            const checked = resolveInstitutionalUse(run.use, ports.authority, at)
            const currentDisclosureReasons = [
              ...evaluateRights(rights, 'DISCLOSE', {
                purpose: run.purpose,
                recipientId: run.recipientId,
                at,
              }).reasons,
              ...evaluateRights(sourceRights, 'DISCLOSE', {
                purpose: run.purpose,
                recipientId: run.recipientId,
                at,
              }).reasons,
            ]
            if (
              currentDisclosureReasons.some(
                (reason) => !['RIGHTS_REVOKED', 'RIGHTS_EXPIRED'].includes(reason),
              )
            ) {
              throw new WorkflowDenied(
                'Operator evidence disclosure permission absent or unresolved',
              )
            }
            if (checked.technical.state === 'NOT_AUTHORIZED' && run.state !== 'REVOKED') {
              throw new WorkflowDenied('Operator evidence disclosure not authorized')
            }
            const definition = await ports.loadEvidence(context.orgId, run.evidence.reference)
            if (definition.orgId !== context.orgId)
              throw new WorkflowDenied('Operator view evidence tenant mismatch')
            const successors = data.runs.filter(
              (item) =>
                item.supersedesRunId === runId &&
                item.actorId === context.actorId &&
                item.orgId === context.orgId,
            )
            const permittedSuccessors: string[] = []
            for (const successor of successors) {
              const permission = await ports.authorizeOperatorView?.(
                context,
                structuredClone(successor),
                at,
              )
              const successorHistorical = ['FAILED', 'REVOKED', 'SUPERSEDED'].includes(
                successor.state,
              )
              if (
                permission?.allowed &&
                permission.authorizationRef &&
                (!successorHistorical || permission.historical)
              )
                permittedSuccessors.push(successor.runId)
            }
            return projectOperatorWorkflowView({
              run,
              checked: checked.technical,
              rights,
              sourceRights,
              at,
              viewingAuthorizationRef: authorization.authorizationRef,
              currentlyVerifiedAt: definition.currentlyVerifiedAt,
              successors: permittedSuccessors,
              data,
            })
          }),
        )
      } catch (error) {
        if (error instanceof WorkflowDenied)
          return {
            access: 'DENIED',
            message: 'This workflow is unavailable in your current authorized context.',
          }
        throw error
      }
    },
  }
}
