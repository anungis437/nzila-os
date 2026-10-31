import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('F06 batch 1 (A1): audit contract, manifest truthfulness, reader parity, capability ownership', () => {
  it('states the audit-write contract: atomic for our own rows, two-phase for effects elsewhere', () => {
    const op = src('lib/audit/operation-audit.ts')
    expect(op).toContain('THE AUDIT-WRITE CONTRACT')
    expect(op).toContain('export async function performAtomicAuditedOperation')
    expect(op).toContain('INTENT_OUTCOME, never ATOMIC')
  })

  it('does not let the scanner call a performAuditedOperation route atomic', () => {
    const scan = src('scripts/lib/route-coverage-scan.ts')
    expect(scan).toContain("return 'INTENT_OUTCOME'")
    expect(scan).toContain("!f.endsWith('operation-audit.ts')")
    const manifest = JSON.parse(src('../../docs/union-eyes/convergence/register/ue-route-coverage-manifest.json')) as { routes: { route: string; audit: string }[] }
    expect(manifest.routes.filter((r) => r.audit === 'INTENT_OUTCOME').length).toBeGreaterThan(0)
    for (const r of manifest.routes.filter((x) => x.audit === 'ATOMIC_SERVICE' || x.audit === 'ATOMIC')) {
      const text = src(`app/api/${r.route}`)
      expect(text, r.route).not.toMatch(/\bperformAuditedOperation\(/)
    }
  })

  it('reads both audit stores in the audit routes, tenant-scoped', () => {
    for (const route of ['app/api/audits/route.ts', 'app/api/audits/[id]/route.ts']) {
      const text = src(route)
      expect(text, route).toContain("@/lib/audit/audit-reader")
      expect(text, route).not.toContain("audit-security-schema")
    }
    expect(src('app/api/audits/route.ts')).toContain('withRLSContext')
    expect(src('lib/audit/audit-reader.ts')).toContain('public.audit_logs')
  })

  it('moves the platform feature-flag toggle onto the atomic contract', () => {
    const route = src('app/api/admin/feature-flags/route.ts')
    expect(route).toContain('performAtomicAuditedOperation(')
    expect(route).not.toContain('performAuditedOperation(')
  })

  it('names the representation protocol in the capability registry', () => {
    expect(src('lib/reality/capability-registry.ts')).toContain("id: 'UE-REP-PROTOCOL-GOVERNANCE'")
  })
})
