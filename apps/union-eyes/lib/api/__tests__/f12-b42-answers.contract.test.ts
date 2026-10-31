import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(join(__dirname, '..', '..', '..', relative), 'utf8')

describe('F12 answers that state a failure as a failure', () => {
  // DEF-0B7-COGB-PROPAGATION-UNKNOWN-NODE-ANSWERS-500-AND-ANALYSIS-TYPE-NOT-VALIDATED
  it('the propagation route validates its query and answers an unknown node as not found', () => {
    const source = read('app/api/exit-interviews/propagation/route.ts')
    expect(source).toContain("analysisType: z.enum(['downstream', 'upstream', 'coupling', 'full'])")
    expect(source).toContain('.strict()')
    expect(source).toContain("ApiError.notFound('Node not found')")
    expect(source).not.toContain("throw new Error('Node not found')")
  })

  // DEF-0B7-EXC-INDEX-FAILURE-RETURNS-200-WITH-RAW-ERROR-TEXT
  it('the indexer reports a failure without its error text', () => {
    const source = read('lib/knowledge-transfer/indexing/semantic-indexer.ts')
    expect(source).not.toContain('reason: String(err)')
    expect(source).toContain("reason: 'Indexing failed', failed: true")
  })
})
