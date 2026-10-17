import { resolveEvidence } from '../evidence-resolution/resolve'
import { resolutionResultSchema, type ResolutionResult } from '../evidence-resolution/contracts'
import { sha256Canonical } from '../source-continuity/integrity'
import { evaluateRights } from '../source-continuity/rights'
import { authorityRejectionReasons } from './authority'
import {
  institutionalUseSchema,
  type GovernedEvidenceAssertion,
  type InstitutionalUse,
  type IssuerAuthorityPort,
} from './contracts'

export function candidateFromAssertion(assertion: GovernedEvidenceAssertion) {
  const { kind: _kind, authorityBinding: _binding, ...candidate } = assertion
  return candidate
}

export interface InstitutionalUseResolution {
  technical: ResolutionResult
  supportingEvidence: ResolutionResult['evidence'][]
  interpretationRef: string
  interpretationVersion: string
}

export function resolveInstitutionalUse(
  input: InstitutionalUse,
  authority: IssuerAuthorityPort,
  at: string,
): InstitutionalUseResolution {
  const use = institutionalUseSchema.parse(input)
  const requirement = {
    ...use.requirement,
    evaluatedAt: at,
    interpretationVersion: use.interpretation.version,
    evidenceCriterionStates: {},
  }
  const assertions = [use.assertion, ...use.supplementalAssertions]
  const base = resolveEvidence(use.assertion.evidence, requirement)
  const result = (technical: ResolutionResult): InstitutionalUseResolution => ({
    technical,
    supportingEvidence: assertions.map((assertion) => assertion.evidence),
    interpretationRef: use.interpretation.interpretationRef,
    interpretationVersion: use.interpretation.version,
  })
  const blocked = (state: ResolutionResult['state'], reasonRefs: string[]) =>
    result(
      resolutionResultSchema.parse({
        ...base,
        state,
        reasonRefs,
        unresolvedCriterionRefs: requirement.requiredCriterionRefs,
      }),
    )
  const sourceRightsReasons = assertions.flatMap(
    (assertion) =>
      evaluateRights(assertion.support.rights, 'DISCLOSE', {
        purpose: requirement.purpose,
        recipientId: requirement.recipientId,
        at,
      }).reasons,
  )
  if (sourceRightsReasons.length) return blocked('NOT_AUTHORIZED', sourceRightsReasons)
  if (
    base.state !== 'UNKNOWN' ||
    base.reasonRefs.some((reason) => !reason.startsWith('CRITERION_'))
  ) {
    return result(base)
  }
  const authorityReasons = assertions.flatMap((assertion) =>
    authorityRejectionReasons(candidateFromAssertion(assertion), authority, at),
  )
  if (authorityReasons.length) return blocked('UNKNOWN', authorityReasons)
  for (const assertion of assertions) {
    const compatibility = resolveEvidence(assertion.evidence, requirement)
    if (
      compatibility.state !== 'UNKNOWN' ||
      compatibility.reasonRefs.some((reason) => !reason.startsWith('CRITERION_'))
    ) {
      return result(compatibility)
    }
    if (
      assertion.subjectRef !== use.interpretation.subjectRef ||
      assertion.scopeRef !== use.interpretation.scopeRef ||
      !use.interpretation.acceptedEvidenceClasses.includes(assertion.evidenceClass)
    )
      return blocked('UNKNOWN', ['EVIDENCE_CLASS_SUBJECT_OR_SCOPE_NOT_ACCEPTED'])
  }
  const criterionStates: InstitutionalUse['requirement']['evidenceCriterionStates'] = {}
  for (const criterion of requirement.requiredCriterionRefs) {
    const rules = use.interpretation.rules.filter((rule) => rule.criterionRef === criterion)
    if (rules.length !== 1) {
      criterionStates[criterion] = 'UNKNOWN'
      continue
    }
    const rule = rules[0]!
    const values = assertions.flatMap((assertion) =>
      assertion.support.claims
        .filter((claim) => claim.conceptRef === rule.conceptRef)
        .map((claim) => claim.value),
    )
    const unique = new Set(values.map(sha256Canonical))
    criterionStates[criterion] =
      unique.size > 1
        ? 'CONFLICT'
        : unique.size === 0
          ? 'UNKNOWN'
          : unique.has(sha256Canonical(rule.expectedValue))
            ? 'MET'
            : 'NOT_MET'
  }
  return result(
    resolveEvidence(use.assertion.evidence, {
      ...requirement,
      evidenceCriterionStates: criterionStates,
    }),
  )
}
