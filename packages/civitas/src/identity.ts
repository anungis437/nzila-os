/**
 * CIVITAS identity.
 *
 * Specialist registration for lawful autonomy, jurisdiction, and continuity.
 * Authority is advisory and analytical. Execution authority is none.
 * Governance controls already required of NzilaOS agents are inherited:
 * human review before institutional adoption, no autonomous institutional
 * decisioning, and no self-representation as counsel of record.
 */

export const CIVITAS_FOUNDATION_PHASE = '0-1' as const

export const CIVITAS_PHASE = '2' as const

export const DEFAULT_JURISDICTION = 'CA-QC' as const

export const FORBIDDEN_EXECUTION = [
  'deploy',
  'merge',
  'financial_transaction',
  'filing',
  'signing',
] as const

export type ForbiddenExecution = (typeof FORBIDDEN_EXECUTION)[number]

export const ADVISORY_ACTS = ['advise', 'analyze'] as const

export type AdvisoryAct = (typeof ADVISORY_ACTS)[number]

export const CIVITAS_IDENTITY = {
  key: 'civitas',
  name: 'CIVITAS',
  role: 'Lawful Autonomy, Jurisdiction & Continuity',
  agentClass: 'Specialist',
  defaultJurisdiction: DEFAULT_JURISDICTION,
  authority: 'advisory-and-analytical',
  executionAuthority: 'none',
  counselOfRecord: false,
  phase: CIVITAS_PHASE,
  foundationPhase: CIVITAS_FOUNDATION_PHASE,
  personalDataStored: false,
  deploymentCapability: false,
  inheritsGovernanceControls: [
    'human-review-authoritative',
    'autonomous-institutional-decisioning-prohibited',
    'unreviewed-ai-is-not-institutional-output',
    'recommendation-before-execution',
    'execution-allowed-false',
  ],
  forbiddenExecution: FORBIDDEN_EXECUTION,
} as const

export interface AuthorityExercise {
  readonly ok: boolean
  readonly code: 'ADVISORY_ONLY' | 'AUTHORITY_EXCEEDED' | 'UNKNOWN_ACT'
  readonly reason: string
  readonly executionAuthority: 'none'
  readonly granted: readonly string[]
  readonly refused: readonly string[]
}

function isForbidden(act: string): act is ForbiddenExecution {
  return (FORBIDDEN_EXECUTION as readonly string[]).includes(act)
}

function isAdvisory(act: string): act is AdvisoryAct {
  return (ADVISORY_ACTS as readonly string[]).includes(act)
}

/**
 * Closed authority check. Any forbidden or unknown act refuses the whole request.
 * Advisory acts do not grant execution.
 */
export function exerciseAuthorities(acts: readonly string[]): AuthorityExercise {
  const refused = acts.filter((act) => !isAdvisory(act))
  if (refused.some((act) => isForbidden(act) || !isAdvisory(act))) {
    const code = refused.some((act) => isForbidden(act)) ? 'AUTHORITY_EXCEEDED' : 'UNKNOWN_ACT'
    return {
      ok: false,
      code,
      reason:
        code === 'AUTHORITY_EXCEEDED'
          ? 'CIVITAS cannot deploy, merge, transact, file, or sign.'
          : 'CIVITAS only advises and analyzes.',
      executionAuthority: 'none',
      granted: [],
      refused,
    }
  }

  return {
    ok: true,
    code: 'ADVISORY_ONLY',
    reason: 'Advisory and analytical acts recorded. Nothing was executed.',
    executionAuthority: 'none',
    granted: acts,
    refused: [],
  }
}

export function exerciseAuthority(act: string): AuthorityExercise {
  return exerciseAuthorities([act])
}
