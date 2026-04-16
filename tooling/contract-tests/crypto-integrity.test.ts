import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './governance-helpers'

describe('Break-glass crypto integrity', () => {
  const activeService = readFileSync(join(ROOT, 'apps', 'union-eyes', 'services', 'break-glass-service.ts'), 'utf8')
  const legacyService = readFileSync(join(ROOT, 'apps', 'union-eyes', 'lib', 'services', 'break-glass-service.ts'), 'utf8')

  it('uses real threshold share generation and OpenSSL-backed encryption in the active service', () => {
    expect(activeService).toContain('secrets.js-grempe')
    expect(activeService).toContain('crypto.hkdfSync')
    expect(activeService).toContain("createCipheriv('aes-256-gcm'")
    expect(activeService).toContain("auditEvent: 'share_created'")
    expect(activeService).toContain("auditEvent: 'share_access'")
    expect(activeService).toContain("auditEvent: 'reconstruction_attempt'")
  })

  it('does not retain the deprecated simplified share generation path', () => {
    expect(activeService).not.toContain("implementationStatus: 'SIMPLIFIED")
    expect(activeService).not.toContain('Buffer.from(share).toString("base64")')
    expect(activeService).not.toContain('const share = crypto.randomBytes(32).toString("hex")')
  })

  it('removes simplified Shamir reconstruction from the legacy service', () => {
    expect(legacyService).toContain('secrets.js-grempe')
    expect(legacyService).not.toContain("const combined = fragments.join('-')")
    expect(legacyService).toContain('NZILA_UNIMPLEMENTED: UE_BREAK_GLASS_COLD_STORAGE_ACCESS')
  })
})
