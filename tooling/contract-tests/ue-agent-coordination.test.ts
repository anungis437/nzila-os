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
    expect(coordination.integratedCursorCommits).toEqual([])
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
})
