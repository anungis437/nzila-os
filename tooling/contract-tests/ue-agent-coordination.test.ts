import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')
const coordination = JSON.parse(
  readFileSync(join(ROOT, 'docs/union-eyes/convergence/UE_AGENT_COORDINATION.json'), 'utf8'),
) as {
  integrationBranch: string
  cursorBranch: string
  gitMergeBaseAgainstMainSha: string
  cursorDevelopmentBaselineSha: string
  cursorMayEdit: string[]
  cursorMustConsumeWithoutEditing: string[]
  integratorReservedCaseDocumentRoutes: string[]
  cursorForbiddenPathPrefixes: string[]
  integratedCursorCommits: string[]
  integratedCursorCommitProvenance: Array<{ sourceSha: string; integrationSha: string }>
  reservedCanonicalContracts: Array<{ id: string; owner: string; status: string; deliveredBy?: string }>
  trancheTwo: { status: string; integrated: boolean }
  trancheThree: { status: string; integrated: boolean }
  UE_CURSOR_DOCUMENT_INTEGRATION: string
  deployment: { UE_SAAS_OPERATIONAL_READINESS: string; PRODUCTION_DEPLOYMENT_AUTHORIZED: string }
}

const MAIN_MERGE_BASE = '0c994b968aed0657cca5b702954ba87252408245'
const CURSOR_BASELINE = 'fde81a81a088a1c8c4aa6d498b2b3a52e0dea298'

function ancestor(sha: string): boolean {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: ROOT, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

describe('Union Eyes agent coordination lanes', () => {
  it('pins the integration branch to the published main SHA', () => {
    expect(coordination.gitMergeBaseAgainstMainSha).toBe(MAIN_MERGE_BASE)
    expect(coordination.cursorDevelopmentBaselineSha).toBe(CURSOR_BASELINE)
    expect(coordination.cursorDevelopmentBaselineSha).not.toBe(coordination.gitMergeBaseAgainstMainSha)
    expect(coordination.integrationBranch).toBe('agents/ue-final-convergence')
    expect(coordination.cursorBranch).toBe('agents/ue-cursor-documents-convergence')
    expect(ancestor(MAIN_MERGE_BASE)).toBe(true)
    expect(ancestor(CURSOR_BASELINE)).toBe(true)
    expect(coordination.deployment.UE_SAAS_OPERATIONAL_READINESS).toBe('NO_GO')
    expect(coordination.deployment.PRODUCTION_DEPLOYMENT_AUTHORIZED).toBe('NO')
    // The 16 commits of the Cursor range fde81a81a..7c17ecf7a, in order: tranche 1 (2), tranche 2 (9), tranche 3 (5).
    expect(coordination.integratedCursorCommits).toEqual([
      '38e002e54ae2866a567b4d48d00d386dfe149091',
      '74aed8ec9bc44d6306918c0056c5a4c788b64b7f',
      '3e4a9733ffd0c0f50249111a761e42133e4dc6e2',
      'fcab5609612777c85b17a33152e886243361ccac',
      '1af25ce6279e5a7072f9eb8ef8d44de0c5d1a379',
      '79617383443a0a5bed742d9dd5cf39bf282140ee',
      '7e88b3e56015b0dbe69f21d20b0075c6aedd889f',
      '1b8337a0958aa5479fe915db4ba42bdd326f6511',
      '6c0c07ae8c03b5c5b5df6d2294da76025e2fdddb',
      '911358c741e03a468705d2ea38a4d6ca1e564e0f',
      'ca7f4d23ce19fd54780c268abc949efb8d2c1b9c',
      'f32c2ba26a830f543e88b09210aeb69568d55931',
      '45c7bb5d7e6ad646ae0ced543cc042bb322fc1a3',
      'e913eab4d7800a98f77ed57f8ff6ca968edd4bd0',
      'baad35639440f9bbe9dfd4afe1753c5259f1d0f7',
      '7c17ecf7a597cbcdbc332308b24b95b3349384b0',
    ])
  })

  it('gives Cursor only existing document retirement and UI files', () => {
    expect(new Set(coordination.cursorMayEdit).size).toBe(coordination.cursorMayEdit.length)
    for (const path of coordination.cursorMayEdit) {
      expect(existsSync(join(ROOT, path)), path).toBe(true)
      expect(coordination.cursorForbiddenPathPrefixes.some((prefix) => path.startsWith(prefix)), path).toBe(false)
      expect(path.includes('/documents/repository/'), path).toBe(false)
    }
  })

  it('keeps shared contracts and case-kernel document routes out of the Cursor edit set', () => {
    const editable = new Set(coordination.cursorMayEdit)
    for (const path of [
      ...coordination.cursorMustConsumeWithoutEditing,
      ...coordination.integratorReservedCaseDocumentRoutes,
    ]) {
      expect(existsSync(join(ROOT, path)), path).toBe(true)
      expect(editable.has(path), path).toBe(false)
    }
  })

  it('records every integrated tranche with source provenance and an integration commit reachable from HEAD', () => {
    expect(coordination.integratedCursorCommitProvenance.map((p) => p.sourceSha)).toEqual(coordination.integratedCursorCommits)
    for (const { integrationSha } of coordination.integratedCursorCommitProvenance) {
      expect(ancestor(integrationSha), integrationSha).toBe(true)
    }
    expect(coordination.integratedCursorCommitProvenance).toHaveLength(16)
    expect(new Set(coordination.integratedCursorCommitProvenance.map((p) => p.integrationSha)).size).toBe(16)
    expect(coordination.trancheTwo).toMatchObject({ status: 'INTEGRATED_QUALIFIED_ENGINEERING', integrated: true })
    expect(coordination.trancheThree).toMatchObject({ status: 'INTEGRATED_QUALIFIED_ENGINEERING', integrated: true })
    // Engineering integration only: activation and release gates are unchanged.
    expect(coordination.UE_CURSOR_DOCUMENT_INTEGRATION).toBe('PASS')
  })

  it('delivered the tranche 2 canonical contracts as the integrator', () => {
    expect(coordination.reservedCanonicalContracts.map((c) => c.id).sort()).toEqual([
      'intake-cleanup',
      'ocr-processing-authority',
      'reviewed-transcript-writes',
      'unlinked-document-create-audit',
    ])
    for (const contract of coordination.reservedCanonicalContracts) {
      expect(contract).toMatchObject({ owner: 'integrator', status: 'DELIVERED' })
      expect(ancestor((contract as { deliveredBy: string }).deliveredBy)).toBe(true)
    }
  })
})
