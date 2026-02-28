/**
 * Contract test — NACP Integrity: No Stub Ports
 *
 * Guarantees the Console NACP integrity page and platform-proof
 * package use real, DB-backed ports — not stubs or hardcoded zeros.
 *
 * @invariant NACP_INTEGRITY_NO_STUBS_001
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOT = join(__dirname, '..', '..')

function readContent(rel: string): string {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return ''
  return readFileSync(abs, 'utf-8')
}

describe('NACP Integrity — No Stub Ports', () => {
  const consolePage = 'apps/console/app/(dashboard)/nacp-integrity/page.tsx'
  const portsModule = 'packages/platform-proof/src/ports/nacp.ts'
  const proofIndex = 'packages/platform-proof/src/index.ts'

  // ── Console page must not contain stubPorts ───────────────────────────
  it('NACP_INTEGRITY_NO_STUBS_001: Console NACP integrity page contains no stub ports', () => {
    const page = readContent(consolePage)
    expect(page).toBeTruthy()

    // Must not contain stubPorts definition or usage
    expect(page).not.toMatch(/stubPorts/)
    expect(page).not.toMatch(/\bstub\b/i)

    // Must not contain hardcoded zero-count seal statuses
    expect(page).not.toMatch(/totalEvents:\s*0/)
    expect(page).not.toMatch(/sealedCount:\s*0/)
    expect(page).not.toMatch(/unsealedCount:\s*0/)

    // Must import real ports (nacpIntegrityPorts)
    expect(page).toMatch(/nacpIntegrityPorts/)
    expect(page).toMatch(/@nzila\/platform-proof/)
  })

  // ── Real ports module must exist ──────────────────────────────────────
  it('NACP_INTEGRITY_NO_STUBS_001: Real NACP ports module exists with DB-backed queries', () => {
    const ports = readContent(portsModule)
    expect(ports).toBeTruthy()

    // Must export real ports object
    expect(ports).toMatch(/export\s+(const|function)\s+nacpIntegrityPorts/)

    // Must reference DB tables (audit_events, evidence_packs)
    expect(ports).toMatch(/auditEvents/)
    expect(ports).toMatch(/evidencePacks/)

    // Must implement all 4 port methods
    expect(ports).toMatch(/fetchSealStatuses/)
    expect(ports).toMatch(/fetchAnomalies/)
    expect(ports).toMatch(/fetchExportProofHash/)
    expect(ports).toMatch(/fetchHashChainInfo/)

    // Must use platformDb for queries
    expect(ports).toMatch(/platformDb/)

    // Must NOT contain stubs or hardcoded fallbacks
    expect(ports).not.toMatch(/stubPorts/)
    expect(ports).not.toMatch(/\bstub\b/i)
  })

  // ── Platform-proof index must re-export real ports ────────────────────
  it('NACP_INTEGRITY_NO_STUBS_001: Platform-proof index re-exports nacpIntegrityPorts', () => {
    const idx = readContent(proofIndex)
    expect(idx).toBeTruthy()

    expect(idx).toMatch(/nacpIntegrityPorts/)
    expect(idx).toMatch(/\.\/ports\/nacp/)
  })

  // ── Console page must use generateNacpIntegrityProofSection with real ports
  it('NACP_INTEGRITY_NO_STUBS_001: Console page wires real ports into proof generator', () => {
    const page = readContent(consolePage)
    expect(page).toBeTruthy()

    // Must call generateNacpIntegrityProofSection with nacpIntegrityPorts (not stubPorts)
    expect(page).toMatch(/generateNacpIntegrityProofSection\(.*nacpIntegrityPorts/)
  })
})
