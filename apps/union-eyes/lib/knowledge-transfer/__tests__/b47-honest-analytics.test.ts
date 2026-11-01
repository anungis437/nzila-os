import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { narrateEnvelope } from '@/lib/organizational-narratives'
import { INTERVIEW_READ_LIMIT } from '../governance/interview-read-limit'

const read = (path: string) => readFileSync(join(fileURLToPath(new URL('../../../', import.meta.url)), path), 'utf8')

function envelope(evidence: unknown[]) {
  return {
    domain: 'resilience',
    confidence: 'moderate',
    interpretationGuidance: 'Treat this as guidance.',
    evidence,
    reasoning: [],
    governanceImplications: [],
    provenance: { engine: 'test-engine' },
  } as never
}

describe('B47 cognition results state what they rest on', () => {
  it('does not say a result is derived from evidence when it has none (DEF-0B7-COGB-NARRATIVES-CITE-ZERO-EVIDENCE)', () => {
    const none = narrateEnvelope(envelope([]))
    expect(none.summary).toContain('No institutional evidence is attached')
    expect(none.summary).not.toContain('Derived from 0')
    expect(narrateEnvelope(envelope([{ id: 'e1' }])).summary).toContain('Derived from 1 institutional evidence item')
  })

  it('selects the documentation strategy for a low or unmeasured score, not for any non-zero one (DEF-0B7-COGA-ROADMAP-DOCUMENTATION-STRATEGY-PRECEDENCE-BUG)', () => {
    const source = read('lib/knowledge-transfer/resilience-strategies/strategy-modeler.ts')
    expect(source).not.toMatch(/\?\? 0 < 65/)
    expect(source).toContain('documentationScore < 65')
    expect(source).toContain('!Number.isFinite(documentationScore)')
  })

  it('makes no personality claim from the absence of recorded activity (DEF-0B7-COGB-PERSONALITY-LABEL-ASSIGNED-FROM-ABSENCE-OF-DATA)', () => {
    const source = read('lib/knowledge-transfer/maturity-personalities/personality-profiler.ts')
    expect(source).toContain("if (totalInteractions < 2) return 'insufficient_data'")
    expect(source).not.toContain("if (totalInteractions < 2) return 'resilience_fragile'")
  })

  it('bounds every derived-analysis read of published interviews (DEF-0B7-COGB-INTERVIEW-READS-UNBOUNDED)', () => {
    expect(INTERVIEW_READ_LIMIT).toBe(500)
    for (const file of [
      'topic-graph/topic-graph-builder.ts',
      'propagation/dependency-propagator.ts',
      'resilience-index/resilience-calculator.ts',
      'succession/succession-analyzer.ts',
      'continuity-risk/risk-detector.ts',
      'simulation/continuity-simulator.ts',
    ]) {
      expect(read(`lib/knowledge-transfer/${file}`), file).toContain('.limit(INTERVIEW_READ_LIMIT)')
    }
  })
})
