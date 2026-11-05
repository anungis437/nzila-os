import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROVIDER_RESIDUALS, RETIRED_EXPORTS } from './identity-provider-residuals'

const ROOT = resolve(__dirname, '..', '..', '..')

function git(args: readonly string[]): string[] {
  try {
    return execFileSync('git', args as string[], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean).sort()
  } catch (error) {
    if ((error as { status?: number }).status === 1) return []
    throw error
  }
}

const EXCLUDES = [
  ':(exclude)**/*.md', ':(exclude)**/*.json', ':(exclude)**/*.lock', ':(exclude)apps/union-eyes/docs', ':(exclude)apps/union-eyes/db/migrations*',
  ':(exclude)apps/union-eyes/db/replay*', ':(exclude)packages/db/drizzle', ':(exclude)apps/union-eyes/.retire-scratch', ':(exclude)apps/union-eyes/.mut-*',
  ':(exclude)apps/union-eyes/backend/*/migrations/*',
  ':(exclude)packages/platform-auth/src/identity-provider-residuals.ts', ':(exclude)packages/platform-auth/src/identity-provider-residuals.test.ts',
]

describe('UE-CONV-A-006: provider residuals can only shrink', () => {
  it('every file that mentions the retired provider is classified', () => {
    const found = git(['grep', '--untracked', '-il', 'clerk', '--', 'apps/union-eyes', 'packages/platform-auth', 'packages/db/src', ...EXCLUDES])
    const listed = new Set(PROVIDER_RESIDUALS.map((entry) => entry.file))
    expect(found.filter((file) => !listed.has(file))).toEqual([])
  })

  it('every classified file exists and states a reason; a file appears once', () => {
    const seen = new Set<string>()
    for (const entry of PROVIDER_RESIDUALS) {
      expect(existsSync(join(ROOT, entry.file)), entry.file).toBe(true)
      expect(entry.note.length, entry.file).toBeGreaterThan(10)
      expect(seen.has(entry.file), `duplicate ${entry.file}`).toBe(false)
      seen.add(entry.file)
    }
  })

  it('the provider is never an authentication input: no application source reads a CLERK_ variable or a Clerk header as authority', () => {
    const readers = git(['grep', '--untracked', '-lE', 'process\\.env\\.CLERK_|os\\.environ(\\.get)?\\(\\s*["\']CLERK_|from ["\']@clerk/|require\\(["\']@clerk/', '--', 'apps/union-eyes', 'packages/platform-auth', ...EXCLUDES, ':(exclude)**/__tests__/**', ':(exclude)**/*.test.*'])
    // settings.py only NAMES the legacy variables inside a detection list (it never reads one by name).
    expect(readers).toEqual([])
    // The Django settings neither read nor name the provider: no CLERK_ setting is detected, mapped or logged there.
    const settings = readFileSync(join(ROOT, 'apps/union-eyes/backend/config/settings.py'), 'utf8')
    expect(settings).not.toMatch(/clerk/i)
  })

  it('every listed file still mentions the provider: an entry whose mention is gone is removed, so the list only shrinks', () => {
    const stale = PROVIDER_RESIDUALS.filter((entry) => !/clerk/i.test(readFileSync(join(ROOT, entry.file), 'utf8'))).map((entry) => entry.file)
    expect(stale).toEqual([])
  })

  it('the retired adapter and webhook verifier are gone from the shared package, and nothing names them again', () => {
    for (const file of ['packages/platform-auth/src/clerk-adapter.ts', 'packages/platform-auth/src/clerk-webhook.ts']) expect(existsSync(join(ROOT, file)), file).toBe(false)
    const exported = Object.keys((JSON.parse(readFileSync(join(ROOT, 'packages/platform-auth/package.json'), 'utf8')) as { exports: Record<string, string> }).exports)
    expect(exported.filter((subpath) => /clerk|^\.\/adapter$/.test(subpath))).toEqual([])
    const pattern = RETIRED_EXPORTS.join('|') + '|platform-auth/adapter|platform-auth/clerk-adapter|platform-auth/clerk-webhook'
    const users = git(['grep', '--untracked', '-lE', pattern, '--', 'apps', 'packages', 'tooling', ...EXCLUDES])
    expect(users).toEqual([])
  })
})
