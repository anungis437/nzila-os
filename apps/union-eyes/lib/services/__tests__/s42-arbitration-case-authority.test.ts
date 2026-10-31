import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B98: arbitration writes follow the case authority', () => {
  it('requires the grievance to be the caller organization\'s and the caller to hold the case on create', () => {
    const route = src('app/api/arbitrations/route.ts')
    expect(route).toContain("field: 'grievanceId'")
    expect(route).toContain('mayWriteArbitrationFor({ organizationId, grievanceId: String(values.grievanceId), userId })')
  })

  it('re-checks the case authority under the update lock and never moves an arbitration to another grievance', () => {
    const route = src('app/api/arbitrations/[id]/route.ts')
    expect(route).toContain("blockedPatchFields: ['grievanceId']")
    expect(route).toContain('lockedAuthCheck')
  })
})
