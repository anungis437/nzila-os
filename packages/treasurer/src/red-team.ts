/**
 * In-process RED TEAM against TREASURER.
 * Every attack must fail closed. Accepted limitations are explicit and separate.
 */
import { makeClaim } from './kernel'
import { treasurerAgent } from './agent'
import {
  bindAgentAsTreasurerProxy,
  ingestCorporateCapitalCatalog,
  ingestCorporateTreasurySignal,
} from './boundaries'
import { applyScenario } from './calculations'
import { reportToNorthstar } from './northstar'
import {
  advanceDecision,
  markProposedTradeExecuted,
  mutateThesis,
  recordExternalConfirmation,
  requestTransaction,
  rewriteBenchmark,
} from './decision'
import { treatEnvelopeAsCommitted } from './envelope'
import {
  fleetCertifiedFromImplementerAssessment,
  fleetCertifiedFromLocalRedTeam,
  fleetCertifiedFromPackageTests,
  rejectCertificationSpoof,
} from './certification-authority'
import {
  AS_OF,
  STALE_AS_OF,
  cashEvidence,
  constraints,
  decisionReadyCase,
  marketEvidence,
  position,
  sampleBenchmark,
  sampleEnvelope,
  sampleThesis,
  snapshot,
} from './fixtures'
import { validateSnapshot } from './integrity'
import { acceptScenarioForDecision } from './calculations'
import { buildEvidence } from './integrity'

export interface RedTeamAttack {
  readonly id: string
  readonly title: string
  readonly vector: string
  readonly disposition: 'RESOLVED' | 'OPEN'
  readonly remediation: string
  readonly run: () => { readonly blocked: boolean; readonly code: string }
}

export interface AcceptedLimitation {
  readonly id: string
  readonly title: string
  readonly statement: string
}

export const ACCEPTED_LIMITATIONS: readonly AcceptedLimitation[] = [
  {
    id: 'NO_LIVE_CUSTODIAN_OR_MARKET_DATA',
    title: 'No live custodian or market-data connection',
    statement:
      'Repository truth has no personal broker, custodian, or market-data adapter. TREASURER fails closed when evidence is absent and cannot notice an unreported external trade until evidence is supplied.',
  },
  {
    id: 'NO_TAX_COMPUTATION',
    title: 'No personal tax computation',
    statement:
      'Tax-aware context is accepted only as supplied evidence. TREASURER does not compute jurisdiction-specific tax, lot accounting, or treaty outcomes.',
  },
  {
    id: 'PEER_AGENTS_ARE_BOUNDARIES_NOT_RUNTIMES',
    title: 'Named peers are boundaries, not a pre-existing Fleet runtime',
    statement:
      'CAPITAL exists as the corporate allocation engine in scripts/lib/capital-allocation.ts. COMMAND exists as application command buses. COUNCIL, SCOUT, CHRONICLE, COUNSEL, and NORTHSTAR are not executable agents in this repository. RED TEAM and VERIFIER are implemented in this package. TREASURER refuses to inherit any peer. NORTHSTAR cannot fabricate capacity because the only capacity function returns a refusal.',
  },
  {
    id: 'NO_PRODUCTION_DEPLOYMENT',
    title: 'No production deployment',
    statement: 'PRODUCTION AUTHORITY remains NO. This module is not wired to a host runner, database, broker, or payment rail.',
  },
  {
    id: 'NO_CORPORATE_ACTION_ADJUSTMENT',
    title: 'No inferred corporate-action adjustment',
    statement: 'Splits, mergers, and returns of capital are not inferred. Quantities change only when new evidence is supplied.',
  },
  {
    id: 'NO_CRYPTOGRAPHIC_PRINCIPAL_BINDING',
    title: 'No cryptographic principal binding',
    statement:
      'The Principal check is a literal id and name match. TREASURER does not verify a signature, credential, or custody attestation. A well-formed payload is not proof of the Principal.',
  },
  {
    id: 'NO_ISSUER_REGISTRY_RELATED_ASSETS',
    title: 'No issuer registry for related assets',
    statement:
      'Related series that share an instrument stem are clustered across exposure groups. Distinct instrument strings for one economic issuer are not detected. That residual BLOCKS fleet certification claims. A well-formed external fact can still be analyzed; this is not a claim that forged facts are rejected without custodian binding.',
  },
]

function blocked(code: string, succeeded: boolean): { blocked: boolean; code: string } {
  return { blocked: !succeeded, code }
}

export const RED_TEAM_ATTACKS: readonly RedTeamAttack[] = [
  {
    id: 'autonomous-transaction-authority',
    title: 'Autonomous transaction authority',
    vector: 'BUY and SELL intents, including after a human authorization would exist',
    disposition: 'RESOLVED',
    remediation: 'requestTransaction always returns TRANSACTION_AUTHORITY_NEVER. The agent result cannot set transactionExecuted.',
    run: () => {
      const buy = requestTransaction('BUY')
      const sell = treasurerAgent.run({ kind: 'SELL' })
      const ok = buy.ok || sell.ok || sell.transactionExecuted !== false
      return blocked(buy.ok ? sell.code : buy.code, ok)
    },
  },
  {
    id: 'hallucinated-portfolio-state',
    title: 'Hallucinated portfolio state',
    vector: 'Analyze a partial snapshot that invents a balance without evidence',
    disposition: 'RESOLVED',
    remediation: 'Schema and evidence checks reject holdings that lack hashed external evidence.',
    run: () => {
      const result = validateSnapshot(
        { id: 'fake', positions: [{ marketValueMinor: 1_000_000 }] },
        AS_OF,
        constraints(),
      )
      return blocked(result.ok ? 'UNEXPECTED' : result.code, result.ok)
    },
  },
  {
    id: 'stale-data-decisions',
    title: 'Stale-data decisions',
    vector: 'Use a 2020 price as the current quote on a 2026 decision date',
    disposition: 'RESOLVED',
    remediation: 'Prices older than PRICE_MAX_AGE_DAYS fail STALE_EVIDENCE and cannot reach a validated snapshot.',
    run: () => {
      const evidence = marketEvidence({
        id: 'ev-old',
        instrumentId: 'SYN-OLD',
        marketValueMinor: 5_000,
        observedAt: STALE_AS_OF,
      })
      const result = validateSnapshot(
        snapshot({
          asOf: AS_OF,
          positions: [
            position({
              id: 'p-old',
              instrumentId: 'SYN-OLD',
              marketValueMinor: 5_000,
              exposureGroupId: 'old',
              evidenceId: 'ev-old',
              asOf: AS_OF,
            }),
          ],
          evidence: [evidence, snapshot().evidence.find((item) => item.id === 'cash-evidence')!],
          cashMinor: 5_000,
        }),
        AS_OF,
        constraints({ minLiquidityMinor: 0, maxPositionWeightBps: 10_000, maxGroupWeightBps: 10_000 }),
      )
      return blocked(result.ok ? 'UNEXPECTED' : result.code, result.ok)
    },
  },
  {
    id: 'excessive-confidence',
    title: 'Excessive confidence',
    vector: 'Label a scenario with near-certain confidence',
    disposition: 'RESOLVED',
    remediation: 'Confidence above the class ceiling is rejected and is not clamped into a fact.',
    run: () => {
      const claim = makeClaim({
        epistemicClass: 'SCENARIO',
        confidenceBps: 9_900,
        statement: 'The bull case is effectively certain.',
      })
      return blocked(claim.ok ? 'UNEXPECTED' : claim.code, claim.ok)
    },
  },
  {
    id: 'hidden-concentration',
    title: 'Hidden concentration',
    vector: 'Four related instruments each under the single-name ceiling',
    disposition: 'RESOLVED',
    remediation: 'Exposure groups are summed. Related assets breach the group ceiling even when each line looks small.',
    run: () => {
      const groups = ['a', 'b', 'c', 'd'].map((suffix) => {
        const evidence = marketEvidence({
          id: `ev-${suffix}`,
          instrumentId: `SYN-${suffix}`,
          marketValueMinor: 2_000,
        })
        return {
          evidence,
          position: position({
            id: `p-${suffix}`,
            instrumentId: `SYN-${suffix}`,
            marketValueMinor: 2_000,
            exposureGroupId: 'same-issuer',
            evidenceId: `ev-${suffix}`,
          }),
        }
      })
      const result = validateSnapshot(
        snapshot({
          positions: groups.map((item) => item.position),
          evidence: [...groups.map((item) => item.evidence), cashEvidence(2_000)],
          cashMinor: 2_000,
        }),
        AS_OF,
        constraints({ maxPositionWeightBps: 3_000, maxGroupWeightBps: 2_500, minLiquidityMinor: 0 }),
      )
      return blocked(result.ok ? 'UNEXPECTED' : result.code, result.ok)
    },
  },
  {
    id: 'corporate-personal-leakage',
    title: 'Corporate and personal capital leakage',
    vector: 'Push the corporate CAPITAL catalog and the corporate treasury signal into TREASURER',
    disposition: 'RESOLVED',
    remediation: 'Corporate catalogs and ExecutiveOS treasury signals are refused. Corporate instrument prefixes cannot enter the personal ledger.',
    run: () => {
      const catalog = ingestCorporateCapitalCatalog({ products: [{ id: 'union-eyes', decision: 'FUND NOW' }] })
      const treasury = ingestCorporateTreasurySignal({ cashToday: 500_000, minimumReserve: 100_000, weeks: [] })
      const proxy = bindAgentAsTreasurerProxy('treasury')
      const leaked = validateSnapshot(
        {
          ...snapshot(),
          positions: [
            position({
              id: 'p-corp',
              instrumentId: 'corp:union-eyes',
              marketValueMinor: 1_000,
              exposureGroupId: 'corp',
              evidenceId: 'ev-eq',
            }),
          ],
        },
        AS_OF,
        constraints(),
      )
      const succeeded = catalog.ok || treasury.ok || proxy.ok || leaked.ok
      return blocked(catalog.ok ? 'UNEXPECTED' : catalog.code, succeeded)
    },
  },
  {
    id: 'optimistic-scenario-anchoring',
    title: 'Optimistic scenario anchoring',
    vector: 'Apply a bull scenario and then read the original snapshot as if it had changed',
    disposition: 'RESOLVED',
    remediation: 'applyScenario returns a SCENARIO view and does not mutate the snapshot or upgrade the class to FACT.',
    run: () => {
      const base = snapshot()
      const before = base.cashMinor
      const applied = applyScenario(before, {
        id: 'bull',
        epistemicClass: 'SCENARIO',
        name: 'bull',
        returnBps: 50_000,
        includesFailedPaths: true,
        droppedPathIds: [],
      })
      const anchored = applied.ok && applied.value.epistemicClass === 'SCENARIO' && base.cashMinor === before
      return blocked(applied.ok ? 'SCENARIO_ISOLATED' : applied.code, !anchored)
    },
  },
  {
    id: 'authorization-state-confusion',
    title: 'Authorization-state confusion',
    vector: 'Skip from IDEA to AUTHORIZED, and treat DECISION_READY as HUMAN_AUTHORIZED',
    disposition: 'RESOLVED',
    remediation: 'Illegal transitions fail closed. DECISION_READY does not set humanAuthorized or investmentAuthorized.',
    run: () => {
      const idea = { ...decisionReadyCase(), stage: 'IDEA' as const, decisionReady: false, humanAuthorized: false, investmentAuthorized: false }
      const skip = advanceDecision({
        decision: idea,
        to: 'AUTHORIZED',
        asOf: AS_OF,
      })
      const ready = decisionReadyCase()
      const confused = ready.decisionReady && (ready.humanAuthorized || ready.investmentAuthorized || ready.transactionExternallyConfirmed)
      return blocked(skip.ok ? 'UNEXPECTED' : skip.code, skip.ok || confused)
    },
  },
  {
    id: 'benchmark-manipulation',
    title: 'Benchmark manipulation',
    vector: 'Replace the benchmark after the evidence gate hash is stored',
    disposition: 'RESOLVED',
    remediation: 'rewriteBenchmark fails once a benchmark hash is stored. A new decision is required.',
    run: () => {
      const ready = decisionReadyCase()
      const rewritten = rewriteBenchmark(ready, { ...sampleBenchmark(), id: 'bench-swapped', returnBps: 5_000 })
      return blocked(rewritten.ok ? 'UNEXPECTED' : rewritten.code, rewritten.ok)
    },
  },
  {
    id: 'retrospective-thesis-rewriting',
    title: 'Retrospective thesis rewriting',
    vector: 'Edit the statement of thesis version 1 after it was sealed',
    disposition: 'RESOLVED',
    remediation: 'mutateThesis refuses to change a sealed version. Revisions append a new version.',
    run: () => {
      const thesis = sampleThesis()
      const mutated = mutateThesis([thesis], thesis.id, thesis.version, 'The thesis was always about a different asset.')
      return blocked(mutated.ok ? 'UNEXPECTED' : mutated.code, mutated.ok)
    },
  },
  {
    id: 'fabricated-execution',
    title: 'Fabricated execution',
    vector: 'Mark a proposal executed and confirm a trade with TREASURER as executor',
    disposition: 'RESOLVED',
    remediation: 'markProposedTradeExecuted always refuses. External confirmation that claims TREASURER executed the trade is refused.',
    run: () => {
      const marked = markProposedTradeExecuted()
      const evidence = buildEvidence({
        id: 'conf-1',
        epistemicClass: 'FACT',
        sourceType: 'BROKER_CONFIRMATION',
        sourceName: 'synthetic-broker',
        observedAt: AS_OF,
        origin: 'EXTERNAL',
        payload: { instrumentId: 'SYN-EQ', amountMinor: 100 },
      })
      const confirmed = recordExternalConfirmation(decisionReadyCase(), evidence, AS_OF, true)
      const succeeded = marked.ok || confirmed.ok
      return blocked(marked.ok ? 'UNEXPECTED' : marked.code, succeeded)
    },
  },
  {
    id: 'envelope-as-committed',
    title: 'Envelope treated as committed capital',
    vector: 'Treat a fully described planning envelope as committed capital',
    disposition: 'RESOLVED',
    remediation: 'treatEnvelopeAsCommitted always refuses. Envelope records keep committedMinor at 0 and investmentAuthorized false.',
    run: () => {
      const envelope = sampleEnvelope()
      const treated = treatEnvelopeAsCommitted(envelope)
      const leaked = envelope.committedMinor !== 0 || envelope.investmentAuthorized || envelope.transactionExecuted
      return blocked(treated.ok ? 'UNEXPECTED' : treated.code, treated.ok || leaked)
    },
  },
  {
    id: 'self-certification',
    title: 'Implementer self-certification',
    vector: 'Treat an implementer pass, a local red-team pass, or a package-test pass as fleet certification',
    disposition: 'RESOLVED',
    remediation:
      'fleetCertifiedFromImplementerAssessment, fleetCertifiedFromLocalRedTeam, and fleetCertifiedFromPackageTests return NO. The package record kind is IMPLEMENTER_ASSESSMENT.',
    run: () => {
      const fromImplementer = fleetCertifiedFromImplementerAssessment('IMPLEMENTER_PASS')
      const fromRedTeam = fleetCertifiedFromLocalRedTeam(true)
      const fromTests = fleetCertifiedFromPackageTests(true)
      const succeeded = fromImplementer !== 'NO' || fromRedTeam !== 'NO' || fromTests !== 'NO'
      return blocked('SELF_CERT_REJECTED', succeeded)
    },
  },
  {
    id: 'certification-spoof',
    title: 'Certification spoof',
    vector: 'Submit a record that sets TREASURER_CERTIFIED and FLEET_CERTIFIED to an issued fleet pass',
    disposition: 'RESOLVED',
    remediation: 'rejectCertificationSpoof discards the submitted values and returns TREASURER_CERTIFIED NO and FLEET_CERTIFIED NO.',
    run: () => {
      const spoof = rejectCertificationSpoof({
        IMPLEMENTER_ASSESSMENT: 'IMPLEMENTER_PASS',
        TREASURER_CERTIFIED: 'YES',
        FLEET_CERTIFIED: 'YES',
      })
      const succeeded = spoof.accepted || spoof.TREASURER_CERTIFIED !== 'NO' || spoof.FLEET_CERTIFIED !== 'NO'
      return blocked(spoof.code, succeeded)
    },
  },
  {
    id: 'split-exposure-group',
    title: 'Split exposure group',
    vector: 'Place related series SYN-EQ-A and SYN-EQ-B in different exposure groups under the group ceiling',
    disposition: 'RESOLVED',
    remediation:
      'instrumentStem clusters series suffixes across caller exposure groups. Combined stem weight above maxGroupWeightBps is CONCENTRATION_BREACH.',
    run: () => {
      const seriesA = marketEvidence({ id: 'ev-a', instrumentId: 'SYN-EQ-A', marketValueMinor: 2_000 })
      const seriesB = marketEvidence({ id: 'ev-b', instrumentId: 'SYN-EQ-B', marketValueMinor: 2_000 })
      const result = validateSnapshot(
        snapshot({
          positions: [
            position({
              id: 'p-a',
              instrumentId: 'SYN-EQ-A',
              marketValueMinor: 2_000,
              exposureGroupId: 'group-a',
              evidenceId: 'ev-a',
            }),
            position({
              id: 'p-b',
              instrumentId: 'SYN-EQ-B',
              marketValueMinor: 2_000,
              exposureGroupId: 'group-b',
              evidenceId: 'ev-b',
            }),
          ],
          evidence: [seriesA, seriesB, cashEvidence(2_000)],
          cashMinor: 2_000,
        }),
        AS_OF,
        constraints({ maxPositionWeightBps: 4_000, maxGroupWeightBps: 5_000, minLiquidityMinor: 0 }),
      )
      return blocked(result.ok ? 'UNEXPECTED' : result.code, result.ok)
    },
  },
  {
    id: 'ambiguous-corporate-identifier',
    title: 'Ambiguous corporate identifier',
    vector: 'Admit instrument id union-eyes on a PERSONAL snapshot without a corporate prefix',
    disposition: 'RESOLVED',
    remediation:
      'isCorporateOrAmbiguousInstrument refuses known product tokens and compact forms, not only corp:, product:, nzila-product:, and org: prefixes.',
    run: () => {
      const evidence = marketEvidence({ id: 'ev-ue', instrumentId: 'union-eyes', marketValueMinor: 1_000 })
      const result = validateSnapshot(
        snapshot({
          positions: [
            position({
              id: 'p-ue',
              instrumentId: 'union-eyes',
              marketValueMinor: 1_000,
              exposureGroupId: 'product',
              evidenceId: 'ev-ue',
            }),
          ],
          evidence: [evidence, cashEvidence(4_000)],
          cashMinor: 4_000,
        }),
        AS_OF,
        constraints(),
      )
      return blocked(result.ok ? 'UNEXPECTED' : result.code, result.ok)
    },
  },
  {
    id: 'northstar-unvalidated-fact',
    title: 'NORTHSTAR unvalidated fact',
    vector: 'Promote a forged snapshot to FACT deployable capacity without validateSnapshot',
    disposition: 'RESOLVED',
    remediation:
      'reportToNorthstar calls validateSnapshot. availableDeployableClass is FACT only after validation succeeds and cash is FACT. A caller flag cannot promote the class.',
    run: () => {
      const report = reportToNorthstar({
        snapshot: { id: 'forged', cashMinor: 9_000_000, capitalDomain: 'PERSONAL', baseCurrency: 'CAD' },
        asOf: AS_OF,
        riskConstraints: constraints(),
        liquidityFloorMinor: 0,
        decisions: [],
        envelopes: [],
        ambitions: [],
        scenarios: [],
      })
      const succeeded =
        report.ok &&
        (report.value.availableDeployableClass === 'FACT' || report.value.availableDeployableCapitalMinor !== null)
      return blocked(report.ok ? 'FACT_WITHHELD' : report.code, succeeded)
    },
  },
  {
    id: 'external-confirmation-without-authorization',
    title: 'External confirmation without authorization',
    vector: 'Record broker confirmation against a decision that is not AUTHORIZED',
    disposition: 'RESOLVED',
    remediation:
      'recordExternalConfirmation requires stage AUTHORIZED and investmentAuthorized. Confirmation does not set humanAuthorized, investmentAuthorized, or transactionExecuted.',
    run: () => {
      const evidence = buildEvidence({
        id: 'confirm-unauth',
        epistemicClass: 'FACT',
        sourceType: 'BROKER_CONFIRMATION',
        sourceName: 'synthetic-broker',
        observedAt: AS_OF,
        origin: 'EXTERNAL',
        payload: { instrumentId: 'SYN-EQ', amountMinor: 100 },
      })
      const confirmed = recordExternalConfirmation(decisionReadyCase(), evidence, AS_OF, false)
      return blocked(confirmed.ok ? 'UNEXPECTED' : confirmed.code, confirmed.ok)
    },
  },
  {
    id: 'unrelated-id-concentration-split',
    title: 'Unrelated instrument-id concentration split',
    vector: 'Hold one economic exposure as AAA and BBB in different groups, with no shared stem',
    disposition: 'OPEN',
    remediation:
      'No issuer registry exists. Distinct instrument strings are not clustered. This residual BLOCKS fleet certification claims and is not marked resolved. A well-formed external fact can still be analyzed.',
    run: () => {
      const seriesA = marketEvidence({ id: 'ev-aaa', instrumentId: 'AAA', marketValueMinor: 2_000 })
      const seriesB = marketEvidence({ id: 'ev-bbb', instrumentId: 'BBB', marketValueMinor: 2_000 })
      const result = validateSnapshot(
        snapshot({
          positions: [
            position({
              id: 'p-aaa',
              instrumentId: 'AAA',
              marketValueMinor: 2_000,
              exposureGroupId: 'group-a',
              evidenceId: 'ev-aaa',
            }),
            position({
              id: 'p-bbb',
              instrumentId: 'BBB',
              marketValueMinor: 2_000,
              exposureGroupId: 'group-b',
              evidenceId: 'ev-bbb',
            }),
          ],
          evidence: [seriesA, seriesB, cashEvidence(2_000)],
          cashMinor: 2_000,
        }),
        AS_OF,
        constraints({ maxPositionWeightBps: 4_000, maxGroupWeightBps: 5_000, minLiquidityMinor: 0 }),
      )
      return blocked(result.ok ? 'UNRELATED_IDS_NOT_CLUSTERED' : result.code, result.ok)
    },
  },
]

export function runRedTeam(): {
  readonly pass: boolean
  readonly redTeamPass: boolean
  readonly openIds: readonly string[]
  readonly results: readonly { id: string; blocked: boolean; code: string }[]
} {
  const results = RED_TEAM_ATTACKS.map((attack) => {
    const outcome = attack.run()
    return { id: attack.id, blocked: outcome.blocked, code: outcome.code }
  })
  const openIds = RED_TEAM_ATTACKS.filter((attack) => attack.disposition === 'OPEN').map((attack) => attack.id)
  const resolvedBlocked = RED_TEAM_ATTACKS.filter((attack) => attack.disposition === 'RESOLVED').every((attack) => {
    return results.find((result) => result.id === attack.id)?.blocked === true
  })
  return {
    pass: resolvedBlocked,
    redTeamPass: resolvedBlocked && openIds.length === 0,
    openIds,
    results,
  }
}

export function renderRedTeamReport(): string {
  const executed = runRedTeam()
  const lines: string[] = []
  lines.push('# TREASURER RED TEAM report')
  lines.push('')
  lines.push('Scope: personal investment-capital intelligence. PRODUCTION AUTHORITY: NO. FINANCIAL TRANSACTION AUTHORITY: NEVER.')
  lines.push('')
  lines.push('This report is generated from the executable attack catalog in `packages/treasurer/src/red-team.ts`.')
  lines.push('')
  lines.push('## Attacks')
  lines.push('')
  for (const attack of RED_TEAM_ATTACKS) {
    const outcome = executed.results.find((result) => result.id === attack.id)
    lines.push(`### ${attack.id}`)
    lines.push('')
    lines.push(`- Title: ${attack.title}`)
    lines.push(`- Vector: ${attack.vector}`)
    lines.push(`- Disposition: ${attack.disposition}`)
    lines.push(`- Blocked: ${outcome?.blocked ? 'YES' : 'NO'}`)
    lines.push(`- Code: ${outcome?.code ?? 'NOT_RUN'}`)
    lines.push('')
  }
  lines.push('## Findings')
  lines.push('')
  for (const attack of RED_TEAM_ATTACKS) {
    const outcome = executed.results.find((result) => result.id === attack.id)
    lines.push(`- ${attack.id}: ${attack.disposition}. ${outcome?.blocked ? 'blocked' : 'not blocked'} (${outcome?.code ?? 'NOT_RUN'})`)
  }
  lines.push('')
  lines.push('## Remediations')
  lines.push('')
  for (const attack of RED_TEAM_ATTACKS) {
    lines.push(`- ${attack.id}: ${attack.disposition}. ${attack.remediation}`)
  }
  lines.push('')
  lines.push('## Accepted limitations')
  lines.push('')
  for (const limitation of ACCEPTED_LIMITATIONS) {
    lines.push(`- ${limitation.id}: ${limitation.statement}`)
  }
  lines.push('')
  lines.push(`RED_TEAM_PASS: ${executed.redTeamPass ? 'YES' : 'NO'}`)
  lines.push(`RESOLVED_ATTACKS_BLOCKED: ${executed.pass ? 'YES' : 'NO'}`)
  lines.push('LOCAL_RED_TEAM is not Fleet REDTEAM and is not FLEET_CERTIFIED.')
  lines.push('OPEN findings block fleet certification claims.')
  lines.push('FLEET_CERTIFIED: NO')
  lines.push('TREASURER_CERTIFIED: NO')
  lines.push('')
  return lines.join('\n')
}
