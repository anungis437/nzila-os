import { sha256Canonical } from '../source-continuity/integrity'
import { measureEvidenceReuseRatio } from '../evidence-reuse/metrics'
import {
  assertWorkflowTransition,
  WorkflowDenied,
  type InstitutionalWorkflowRun,
  type WorkflowAuditEntry,
  type WorkflowState,
  type WorkflowStateData,
  type WorkflowStoragePort,
  type FrictionStep,
} from './contracts'
import type { RightsSnapshot } from '../source-continuity/contracts'

export function workflowDigest(value: unknown): string {
  return sha256Canonical(JSON.parse(JSON.stringify(value)))
}
export function appendTransition(
  data: WorkflowStateData,
  run: InstitutionalWorkflowRun,
  next: WorkflowState,
  actorId: string,
  at: string,
  reason: string,
  rights: RightsSnapshot,
  sourceRights: RightsSnapshot = run.use.assertion.support.rights,
): string {
  const isNew = !data.runs.some((item) => item.runId === run.runId)
  if (!isNew) assertWorkflowTransition(run.state, next)
  else if (next !== 'REQUESTED') throw new WorkflowDenied('New workflow must begin REQUESTED')
  const priorState = isNew ? null : run.state
  const entry: Omit<WorkflowAuditEntry, 'sha256'> = {
    auditId: `${run.runId}:audit:${run.revision + 1}`,
    runId: run.runId,
    actorId,
    orgId: run.orgId,
    action: `workflow:${next.toLowerCase()}`,
    evidence: run.evidence.reference,
    requirement: run.requirement.reference,
    authorizationRef: rights.decisionRef,
    rightsSnapshot: structuredClone(rights),
    sourceRightsSnapshot: structuredClone(sourceRights),
    priorState,
    nextState: next,
    at,
    reason,
    previousSha256: data.audit.at(-1)?.sha256 ?? null,
  }
  const priorAt = data.audit.filter((item) => item.runId === run.runId).at(-1)?.at
  if (priorAt && Date.parse(at) < Date.parse(priorAt))
    throw new WorkflowDenied('Workflow time cannot move backwards')
  data.audit.push({ ...entry, sha256: workflowDigest(entry) })
  run.state = next
  run.revision++
  if (isNew) data.runs.push(run)
  data.history.push(structuredClone(run))
  return entry.auditId
}
export function appendFriction(
  data: WorkflowStateData,
  run: InstitutionalWorkflowRun,
  step: FrictionStep,
  actorId: string,
  at: string,
  auditRef: string,
): void {
  data.frictionLedger.push({
    eventId: `${run.runId}:friction:${data.frictionLedger.filter((item) => item.runId === run.runId).length + 1}`,
    runId: run.runId,
    orgId: run.orgId,
    actorId,
    at,
    step,
    auditRef,
  })
}
export function frictionCounts(data: WorkflowStateData, runId: string) {
  const counts = {
    sourceRetrieval: 0,
    manualReentry: 0,
    duplicateDocumentProduction: 0,
    semanticClarification: 0,
    permissionRemediation: 0,
    institutionalReverification: 0,
    evidenceReconstruction: 0,
  }
  for (const event of data.frictionLedger.filter((item) => item.runId === runId))
    counts[event.step]++
  return counts
}
export function workflowMetrics(data: WorkflowStateData, run: InstitutionalWorkflowRun) {
  return {
    reuse: measureEvidenceReuseRatio(data.reuseLedger.map((record) => record.event)),
    friction: {
      proofKind: 'SYNTHETIC_ACTION_COUNTS' as const,
      contextId: run.use.contextId,
      evidenceId: run.evidence.reference.id,
      evidenceVersion: run.evidence.reference.version,
      scenario: 'GOVERNED_REUSE' as const,
      events: frictionCounts(data, run.runId),
    },
  }
}

export function verifyWorkflowAudit(entries: WorkflowAuditEntry[]): boolean {
  let previous: string | null = null
  const states = new Map<string, WorkflowState>()
  for (const entry of entries) {
    const { sha256, ...content } = entry
    if (entry.previousSha256 !== previous || workflowDigest(content) !== sha256) return false
    if (entry.priorState !== (states.get(entry.runId) ?? null)) return false
    if (entry.priorState === null) {
      if (entry.nextState !== 'REQUESTED') return false
    } else {
      assertWorkflowTransition(entry.priorState, entry.nextState)
    }
    states.set(entry.runId, entry.nextState)
    previous = sha256
  }
  return true
}

export function createSyntheticWorkflowStorage(): WorkflowStoragePort {
  const organizations = new Map<string, WorkflowStateData>()
  const locks = new Map<string, Promise<void>>()
  return {
    async transaction<T>(
      orgId: string,
      operation: (data: WorkflowStateData) => Promise<T>,
    ): Promise<T> {
      const predecessor = locks.get(orgId) ?? Promise.resolve()
      let release!: () => void
      const lock = new Promise<void>((resolve) => {
        release = resolve
      })
      locks.set(
        orgId,
        predecessor.then(() => lock),
      )
      await predecessor
      try {
        const original = organizations.get(orgId) ?? {
          runs: [],
          history: [],
          audit: [],
          reuseLedger: [],
          frictionLedger: [],
        }
        const draft = structuredClone(original)
        const result = await operation(draft)
        if (!verifyWorkflowAudit(draft.audit))
          throw new WorkflowDenied('Workflow audit integrity failed')
        for (const key of ['history', 'audit', 'reuseLedger', 'frictionLedger'] as const) {
          if (
            workflowDigest(draft[key].slice(0, original[key].length)) !==
            workflowDigest(original[key])
          ) {
            throw new WorkflowDenied(`Append-only ${key} was modified`)
          }
        }
        if (draft.runs.some((run) => run.orgId !== orgId))
          throw new WorkflowDenied('Storage tenant mismatch')
        if (
          new Set(draft.runs.map((run) => run.runId)).size !== draft.runs.length ||
          new Set(draft.runs.map((run) => run.idempotencyKey)).size !== draft.runs.length
        ) {
          throw new WorkflowDenied('Workflow identity must be unique')
        }
        if (
          draft.history.length !== draft.audit.length ||
          draft.audit.some(
            (entry, index) =>
              draft.history[index]?.runId !== entry.runId ||
              draft.history[index]?.state !== entry.nextState ||
              entry.orgId !== orgId,
          )
        ) {
          throw new WorkflowDenied('Workflow history must match audited transitions')
        }
        for (const run of draft.runs) {
          const historical = draft.history.findLast((item) => item.runId === run.runId)
          if (!historical || workflowDigest(historical) !== workflowDigest(run)) {
            throw new WorkflowDenied('Current workflow must match its latest immutable snapshot')
          }
        }
        organizations.set(orgId, structuredClone(draft))
        return structuredClone(result)
      } finally {
        release()
      }
    },
  }
}
