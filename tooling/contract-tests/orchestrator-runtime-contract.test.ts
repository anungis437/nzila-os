/**
 * AZ3_REGRESSION — Orchestrator runtime must not bootstrap pnpm.
 *
 * The root Dockerfile is the canonical GitOps image source. Its
 * orchestrator-api target must start the app directly with Node under the
 * image-defined non-root user, avoiding writable package-manager state at
 * runtime.
 */
import { describe, expect, it } from 'vitest'
import { readContent, ROOT } from './governance-helpers'

const dockerfile = readContent(`${ROOT}/Dockerfile`)

function orchestratorTarget(content: string): string {
  const start = content.indexOf('FROM base AS orchestrator-api')
  expect(start, 'root Dockerfile must define orchestrator-api target').toBeGreaterThanOrEqual(0)

  const rest = content.slice(start)
  const nextStage = rest.indexOf('\n# ============================================', 1)
  return nextStage === -1 ? rest : rest.slice(0, nextStage)
}

describe('AZ3_REGRESSION — orchestrator runtime contract', () => {
  const target = orchestratorTarget(dockerfile)

  it('starts orchestrator-api directly with Node from the root target layout', () => {
    expect(target).toContain('WORKDIR /app/apps/orchestrator-api')
    expect(target).toContain('CMD ["node", "--import", "tsx", "src/index.ts"]')
  })

  it('does not invoke package-manager bootstrap at runtime', () => {
    const cmdLines = target
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('CMD ['))

    expect(cmdLines).toHaveLength(1)
    expect(cmdLines[0]).not.toMatch(/\bpnpm\b|\bcorepack\b|npm\s+exec|npx/)
  })

  it('keeps the non-root runtime user boundary', () => {
    expect(target).toContain('USER orchestrator')
    expect(target).not.toMatch(/USER\s+root\b/)
  })
})
