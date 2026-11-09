import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B96: honest availability and endpoint rules', () => {
  it('says when engagement snapshots were never computed', () => {
    // Superseded by a stricter rule (DEF-0B5-COGNITION-ENGAGEMENT-NEVER-COMPUTED): nothing computes snapshots, so the route answers 501
    // instead of listing an empty store as 200 with availability 'not_computed'.
    const route = src('app/api/cognition/engagement/route.ts')
    expect(route).toContain('{ status: 501 }')
    expect(route).not.toContain('listEngagementSnapshots')
  })

  it('accepts only a managed credential reference and provider-approved settings for an integration', () => {
    const route = src('app/api/extensions/[id]/route.ts')
    expect(route).toContain('credentialRef: z.string().trim().min(1).max(255)')
    const control = src('lib/integrations/control-plane.ts')
    expect(control).toContain('assertApprovedSettingsKeys(input.provider, input.settings)')
    expect(control).toContain('rotateIntegrationCredentialBinding')
  })
})
