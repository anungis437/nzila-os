import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('S6 verified and small fixes', () => {
  it('counts a completion as a registration marked completed, not as attendance (DEF-0B6-EDU-CONTENT-COMPLETIONS-COUNT-ATTENDED)', () => {
    for (const route of ['app/api/content/training/route.ts', 'app/api/content/stats/route.ts']) {
      const source = read(route)
      expect(source, route).toContain('cr.completed IS TRUE')
      expect(source, route).not.toContain('cr.attended IS TRUE')
    }
  })

  it('records every AI model invocation through the audited operation wrapper (DEF-0B2-AI-INVOCATION-NOT-AUDITED, verified existing implementation)', () => {
    for (const route of ['classify', 'summarize', 'match-precedents', 'search']) {
      const source = read(`app/api/ai/${route}/route.ts`)
      expect(source, route).toContain('performAuditedOperation({')
      expect(source, route).toContain('operationAuditResponse(error)')
    }
  })
})
