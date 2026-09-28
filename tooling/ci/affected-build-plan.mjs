/**
 * Build All portfolio fallback (E5_B).
 *
 * `turbo run build --affected` maps files outside a pnpm workspace package to
 * the root package `//`. The root `build` script is `turbo build`, which Turbo
 * does not schedule, so that selection runs 0 build tasks and the job can
 * exit 0. Lockfiles, turbo.json, pnpm-workspace.yaml, and the root
 * package.json are in that set. So is every other path that is not inside a
 * workspace package and is not a proven documentation path.
 *
 * Proven documentation stays `not_applicable` (same predicate the merge
 * authority surface already uses). Unknown paths are never `not_applicable`.
 *
 * Dependency-free so CI can run it after checkout without extra install steps
 * beyond the existing monorepo setup.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDocumentationOnlyPath, normalizeRepoPath } from './merge-authority/surface.mjs'

/**
 * Lockfiles and task-graph files. Any directory: a nested copy still changes
 * resolution or the Turbo graph beyond one package's `--affected` closure.
 */
export const LOCKFILE_AND_GRAPH_BASENAMES = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'turbo.json',
  'turbo.jsonc',
  'pnpm-workspace.yaml',
])

/**
 * Root inputs Turbo attributes to `//` and does not treat as a workspace
 * package build. Nested `package.json` files stay on `--affected`.
 */
export const ROOT_FULL_BUILD_PATHS = new Set(['package.json', '.npmrc'])

export function parseWorkspacePatterns(yaml) {
  if (typeof yaml !== 'string' || !yaml.trim()) return []
  const patterns = []
  let inPackages = false
  for (const raw of yaml.split(/\r?\n/)) {
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (!inPackages) {
      if (trimmed === 'packages:') inPackages = true
      continue
    }
    if (!raw.startsWith(' ') && !raw.startsWith('\t')) break
    if (!trimmed.startsWith('-')) continue
    const item = trimmed.replace(/^-\s*/, '').replace(/^['"]|['"]$/g, '')
    if (item) patterns.push(item)
  }
  return patterns
}

function expandPattern(root, pattern) {
  const segments = pattern.split('/').filter((segment) => segment.length > 0)
  let dirs = ['']
  for (const segment of segments) {
    const next = []
    for (const dir of dirs) {
      if (segment === '*') {
        const absolute = join(root, dir)
        if (!existsSync(absolute)) continue
        let entries = []
        try {
          entries = readdirSync(absolute, { withFileTypes: true })
        } catch {
          continue
        }
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          next.push(dir ? `${dir}/${entry.name}` : entry.name)
        }
      } else {
        next.push(dir ? `${dir}/${segment}` : segment)
      }
    }
    dirs = next
  }
  return dirs.filter((dir) => dir && existsSync(join(root, dir, 'package.json')))
}

/**
 * Workspace package directories relative to the repo root, in pnpm pattern order.
 * A directory counts only when it contains package.json. Negations remove
 * earlier matches.
 */
export function listWorkspacePackageDirs(root, patterns) {
  const source =
    patterns ??
    parseWorkspacePatterns(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8'))
  const included = new Set()
  for (const pattern of source) {
    const negate = pattern.startsWith('!')
    const body = negate ? pattern.slice(1) : pattern
    if (!body || body.includes('..')) continue
    for (const dir of expandPattern(root, body)) {
      if (negate) included.delete(dir)
      else included.add(dir)
    }
  }
  return [...included].sort()
}

export function isInsideWorkspacePackage(path, packageDirs) {
  return packageDirs.some((dir) => path === dir || path.startsWith(`${dir}/`))
}

export function basenameOf(path) {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? path : path.slice(slash + 1)
}

/**
 * True when this single path is one of the inputs that make `--affected`
 * select `//` with no build task, or is otherwise not a workspace-package
 * change whose build relevance Turbo will actually schedule.
 */
export function pathForcesFullPortfolioBuild(path, packageDirs) {
  if (LOCKFILE_AND_GRAPH_BASENAMES.has(basenameOf(path))) return true
  if (ROOT_FULL_BUILD_PATHS.has(path)) return true
  if (!isInsideWorkspacePackage(path, packageDirs)) return true
  return false
}

/**
 * @returns {{ mode: 'full' | 'affected' | 'not_applicable', reason: string, triggers: string[] }}
 */
export function planAffectedBuild(paths, packageDirs) {
  if (!Array.isArray(paths) || !Array.isArray(packageDirs)) {
    return { mode: 'full', reason: 'unknown-change-set', triggers: [] }
  }

  const normalized = []
  for (const input of paths) {
    const path = normalizeRepoPath(input)
    if (!path || path.split('/').includes('..')) {
      return {
        mode: 'full',
        reason: 'unknown-path',
        triggers: [typeof input === 'string' ? input : ''],
      }
    }
    normalized.push(path)
  }

  if (normalized.length === 0) {
    return { mode: 'full', reason: 'empty-diff', triggers: [] }
  }

  const unique = [...new Set(normalized)]
  const relevant = unique.filter((path) => !isDocumentationOnlyPath(path))
  if (relevant.length === 0) {
    return { mode: 'not_applicable', reason: 'proven-irrelevant', triggers: [] }
  }

  const triggers = relevant.filter((path) => pathForcesFullPortfolioBuild(path, packageDirs))
  if (triggers.length > 0) {
    return { mode: 'full', reason: 'root-or-global-input', triggers }
  }

  return { mode: 'affected', reason: 'workspace-package-changes', triggers: [] }
}

/**
 * `git diff --name-status -z` records. Renames and copies contribute both
 * paths so removing a lockfile by rename still forces the portfolio build.
 */
export function parseNameStatusZ(payload) {
  const text = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload ?? '')
  if (!text) return []
  const records = text.split('\0')
  if (records.length > 0 && records[records.length - 1] === '') records.pop()
  const paths = []
  for (let index = 0; index < records.length; index += 1) {
    const status = records[index]
    if (!status) continue
    const code = status[0]
    if (code === 'R' || code === 'C') {
      const previous = records[(index += 1)]
      const current = records[(index += 1)]
      if (previous) paths.push(previous)
      if (current) paths.push(current)
      continue
    }
    const path = records[(index += 1)]
    if (path) paths.push(path)
  }
  return paths
}

export function readChangedPaths(base, head, cwd) {
  if (!base || !head) {
    throw new Error('SCM base and head are required')
  }
  const payload = execFileSync(
    'git',
    ['diff', '--name-status', '-z', '--find-renames', base, head],
    { cwd, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
  )
  return parseNameStatusZ(payload)
}

export function planRepositoryDiff(root, base, head) {
  const packageDirs = listWorkspacePackageDirs(root)
  const paths = readChangedPaths(base, head, root)
  return planAffectedBuild(paths, packageDirs)
}

function argument(name) {
  const index = process.argv.indexOf(name)
  if (index < 0 || index + 1 >= process.argv.length) return undefined
  return process.argv[index + 1]
}

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(entry).href
}

if (isDirectRun()) {
  try {
    const root = argument('--root') ?? process.cwd()
    const base = argument('--base')
    const head = argument('--head')
    const plan = planRepositoryDiff(root, base, head)
    console.error(
      `affected-build mode=${plan.mode} reason=${plan.reason} triggers=${plan.triggers.length}`,
    )
    for (const trigger of plan.triggers) console.error(`affected-build trigger ${trigger}`)
    process.stdout.write(`${plan.mode}\n`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

// PROBE CI-TYPECHECK tooling marker. Do not merge.
