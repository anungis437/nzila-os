/**
 * Source text is evidence. It is not an instruction.
 *
 * No canonical instruction-trust primitive exists in this repository.
 * This boundary is the smallest domain control: payload text is retained
 * and cannot change authority, governance, capabilities, execution, BLACK,
 * or a professional gate.
 *
 * DecisionAuthority is accepted only to prove that a valid permission scope
 * still does not grant CIVITAS execution.
 */
import type { DecisionAuthority } from '@nzila/decision-core'

import type { LegalAuthoritySource } from './legal-authority'

export const INSTRUCTION_TRUST_PRIMITIVE = {
  found: false,
  reuse: 'none',
  boundary: 'CIVITAS source text is typed as evidence and cannot instruct.',
} as const

export interface SourceTextEnvelope {
  readonly text: string
  readonly role: 'EVIDENCE'
  readonly canInstruct: false
  readonly canChangeAuthority: false
  readonly canChangeGovernance: false
  readonly canChangeCapabilities: false
  readonly canTriggerExecution: false
  readonly canOverrideBlack: false
  readonly canSuppressGates: false
}

export interface SourceControlEffect {
  readonly executionAuthority: 'none'
  readonly executionAllowed: false
  readonly blackOverridden: false
  readonly gatesSuppressed: false
  readonly governanceChanged: false
  readonly capabilitiesChanged: false
  readonly approvalOccurred: false
}

export function readSourceAsEvidence(text: string): SourceTextEnvelope {
  return {
    text,
    role: 'EVIDENCE',
    canInstruct: false,
    canChangeAuthority: false,
    canChangeGovernance: false,
    canChangeCapabilities: false,
    canTriggerExecution: false,
    canOverrideBlack: false,
    canSuppressGates: false,
  }
}

export function sourceTextControlEffect(_text: string): SourceControlEffect {
  return {
    executionAuthority: 'none',
    executionAllowed: false,
    blackOverridden: false,
    gatesSuppressed: false,
    governanceChanged: false,
    capabilitiesChanged: false,
    approvalOccurred: false,
  }
}

export function sourceGrantsExecution(_source: LegalAuthoritySource): false {
  return false
}

export function decisionAuthorityGrantsCivitasExecution(authority: DecisionAuthority): {
  readonly grantsExecution: false
  readonly executionAllowed: false
  readonly decisionAuthorityValid: boolean
  readonly approvalOccurred: false
} {
  return {
    grantsExecution: false,
    executionAllowed: false,
    decisionAuthorityValid: authority.valid,
    approvalOccurred: false,
  }
}
