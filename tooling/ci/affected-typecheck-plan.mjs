/**
 * Fail-closed affected typecheck (E6-C).
 *
 * Doctrine: PROVE_AFFECTED_OR_RUN_FULL. A raw `turbo typecheck --affected`
 * exit 0 is not merge authority. Relevant or unknown changes that schedule
 * no typecheck task run the full universe. NOT_APPLICABLE is only an
 * explicit proven-irrelevant classification (the same documentation
 * predicate Affected Build uses).
 *
 * Path classes that force `pnpm build` also force `pnpm typecheck`. Shared
 * compilation config (tsconfig*.json, jsconfig.json) forces the full
 * typecheck universe even when the path sits inside a workspace package.
 *
 * Dependency-free aside from the existing affected-build and merge-authority
 * classifiers, so CI can run it after checkout.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  basenameOf,
  listWorkspacePackageDirs,
  planAffectedBuild,
  readChangedPaths,
} from './affected-build-plan.mjs'
import { isDocumentationOnlyPath, normalizeRepoPath } from './merge-authority/surface.mjs'

export const PLAN_VERSION = 'e6c-1'
export const DOCTRINE = 'PROVE_AFFECTED_OR_RUN_FULL'

const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

export function pathForcesFullTypecheck(path) {
  const base = basenameOf(path).toLowerCase()
  if (base === 'jsconfig.json' || base === 'tsconfig.json') return true
  return base.startsWith('tsconfig.') && base.endsWith('.json')
}

/**
 * Longest workspace package directory that contains this repo-relative path.
 */
export function owningPackageDir(path, packageDirs) {
  let best = null
  for (const dir of packageDirs) {
    if (path === dir || path.startsWith(`${dir}/`)) {
      if (!best || dir.length > best.length) best = dir
    }
  }
  return best
}

/**
 * @returns {{
 *   ok: true,
 *   dirToName: Map<string, string>,
 *   nameToDir: Map<string, string>,
 *   dependents: Map<string, Set<string>>,
 *   hasTypecheck: Set<string>,
 *   typecheckPackages: string[],
 * } | { ok: false, reason: string, dir?: string, name?: string }}
 */
export function buildWorkspaceTypecheckGraph(root, packageDirs) {
  const dirToName = new Map()
  const nameToDir = new Map()
  const manifests = new Map()
  const hasTypecheck = new Set()
  const typecheckPackages = []

  for (const dir of packageDirs) {
    let manifest
    try {
      manifest = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'))
    } catch {
      return { ok: false, reason: 'unreadable-manifest', dir }
    }
    if (!manifest || typeof manifest.name !== 'string' || !manifest.name.trim()) {
      return { ok: false, reason: 'unnamed-package', dir }
    }
    const name = manifest.name
    if (nameToDir.has(name)) {
      return { ok: false, reason: 'duplicate-package-name', dir, name }
    }
    dirToName.set(dir, name)
    nameToDir.set(name, dir)
    manifests.set(name, manifest)
    const script = manifest.scripts && manifest.scripts.typecheck
    if (typeof script === 'string' && script.trim()) {
      hasTypecheck.add(name)
      typecheckPackages.push(name)
    }
  }

  const dependents = new Map()
  for (const [name, manifest] of manifests) {
    for (const field of DEP_FIELDS) {
      const block = manifest[field]
      if (!block || typeof block !== 'object') continue
      for (const depName of Object.keys(block)) {
        if (!nameToDir.has(depName)) continue
        let incoming = dependents.get(depName)
        if (!incoming) {
          incoming = new Set()
          dependents.set(depName, incoming)
        }
        incoming.add(name)
      }
    }
  }

  typecheckPackages.sort()
  return { ok: true, dirToName, nameToDir, dependents, hasTypecheck, typecheckPackages }
}

/**
 * Changed packages plus every workspace dependent, direct or transitive.
 * Packages without a typecheck script stay in the walk so a stub in the
 * middle cannot hide a downstream typecheck.
 */
export function expandTypecheckClosure(startNames, graph) {
  const seen = new Set()
  const queue = [...startNames]
  const selected = []
  while (queue.length > 0) {
    const name = queue.shift()
    if (!name || seen.has(name)) continue
    seen.add(name)
    if (graph.hasTypecheck.has(name)) selected.push(name)
    const next = graph.dependents.get(name)
    if (!next) continue
    for (const dependent of next) queue.push(dependent)
  }
  selected.sort()
  return selected
}

export function changedPackageNames(paths, packageDirs, graph) {
  const names = []
  for (const path of paths) {
    const dir = owningPackageDir(path, packageDirs)
    if (!dir) continue
    const name = graph.dirToName.get(dir)
    if (!name) return { ok: false, names: [], dir }
    names.push(name)
  }
  return { ok: true, names: [...new Set(names)] }
}

/**
 * Turbo's selected typecheck packages must cover the dependency closure.
 * Extras are kept. A missing dependent is a failed proof, not a pass.
 */
export function unionAffectedPackages(closure, turboPackages) {
  const turbo = [...new Set((turboPackages ?? []).filter((name) => name && name !== '//'))]
  const missing = closure.filter((name) => !turbo.includes(name))
  if (missing.length > 0) {
    return { ok: false, reason: 'dependent-expansion-incomplete', missing, packages: [] }
  }
  return {
    ok: true,
    reason: '',
    missing: [],
    packages: [...new Set([...closure, ...turbo])].sort(),
  }
}

export function parseTurboTypecheckPackages(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload
  const tasks = Array.isArray(data?.tasks) ? data.tasks : []
  const names = []
  for (const task of tasks) {
    const fromId = typeof task?.taskId === 'string' ? task.taskId : ''
    const taskName = task?.task ?? (fromId.includes('#') ? fromId.slice(fromId.lastIndexOf('#') + 1) : '')
    if (taskName !== 'typecheck') continue
    if (task?.command === '<NONEXISTENT>') continue
    let name = task?.package ?? task?.packageName ?? ''
    if (!name && fromId.includes('#')) name = fromId.slice(0, fromId.lastIndexOf('#'))
    if (!name || name === '//') continue
    names.push(name)
  }
  return [...new Set(names)].sort()
}

/**
 * Pure SCM decision. Missing objects and an unreadable range are FULL.
 * A checkout that does not contain the planned head is ERROR.
 * A diverged pair with a merge-base stays classifiable from that merge-base.
 */
export function assessScm(facts) {
  const base = typeof facts?.base === 'string' ? facts.base.trim() : ''
  const head = typeof facts?.head === 'string' ? facts.head.trim() : ''
  const checkout = typeof facts?.checkoutSha === 'string' ? facts.checkoutSha.trim() : ''
  if (!base || /^0+$/.test(base) || !head || /^0+$/.test(head)) {
    return { confident: false, kind: 'unresolved-scm', mode: 'FULL', diffBase: '' }
  }
  if (facts.headExists === false) {
    return { confident: false, kind: 'missing-head', mode: 'ERROR', diffBase: '' }
  }
  if (checkout && checkout !== head && facts.headInCheckout === false) {
    return { confident: false, kind: 'checkout-head-mismatch', mode: 'ERROR', diffBase: '' }
  }
  if (facts.baseExists === false) {
    return { confident: false, kind: 'missing-base', mode: 'FULL', diffBase: '' }
  }
  if (facts.ancestor === true) {
    return { confident: true, kind: 'resolved', mode: null, diffBase: base }
  }
  if (typeof facts.mergeBase === 'string' && facts.mergeBase.trim()) {
    return { confident: true, kind: 'merge-base', mode: null, diffBase: facts.mergeBase.trim() }
  }
  return { confident: false, kind: 'force-update', mode: 'FULL', diffBase: '' }
}

function planRecord(fields) {
  return {
    PLAN_VERSION,
    DOCTRINE,
    MODE: fields.MODE,
    BASE_SHA: fields.BASE_SHA ?? '',
    HEAD_SHA: fields.HEAD_SHA ?? '',
    DIFF_BASE: fields.DIFF_BASE ?? '',
    CHANGED_PATHS: fields.CHANGED_PATHS ?? [],
    AFFECTED_PACKAGES: fields.AFFECTED_PACKAGES ?? [],
    TASK_COUNT: fields.TASK_COUNT ?? 0,
    FALLBACK_REASON: fields.FALLBACK_REASON ?? '',
    TRIGGERS: fields.TRIGGERS ?? [],
    SCM_KIND: fields.SCM_KIND ?? '',
    SCM_CONFIDENT: Boolean(fields.SCM_CONFIDENT),
    FULL_UNIVERSE: fields.FULL_UNIVERSE ?? 0,
    CLASSIFICATION: fields.CLASSIFICATION ?? '',
  }
}

function fullPlan(common, reason, triggers = []) {
  const universe = common.universe ?? []
  return planRecord({
    ...common.identity,
    MODE: 'FULL',
    CHANGED_PATHS: common.paths ?? [],
    AFFECTED_PACKAGES: universe,
    TASK_COUNT: universe.length,
    FALLBACK_REASON: reason,
    TRIGGERS: triggers,
    SCM_KIND: common.scmKind ?? '',
    SCM_CONFIDENT: Boolean(common.scmConfident),
    FULL_UNIVERSE: universe.length,
    CLASSIFICATION: common.classification ?? reason,
    DIFF_BASE: common.diffBase ?? '',
  })
}

/**
 * Decide the typecheck plan from already-collected facts.
 * AFFECTED requires a non-empty closure. Zero tasks never become
 * NOT_APPLICABLE and never become AFFECTED.
 */
export function composeTypecheckPlan(input) {
  const universe = input.graph?.ok ? input.graph.typecheckPackages : []
  const identity = {
    BASE_SHA: input.baseSha ?? '',
    HEAD_SHA: input.headSha ?? '',
  }
  const common = {
    identity,
    universe,
    paths: input.paths ?? [],
    scmKind: input.scm?.kind ?? '',
    scmConfident: Boolean(input.scm?.confident),
    diffBase: input.scm?.diffBase ?? '',
    classification: '',
  }

  if (!input.graph?.ok) {
    return fullPlan(common, input.graph?.reason || 'unreadable-manifest')
  }
  if (!input.scm?.confident) {
    if (input.scm?.mode === 'ERROR') {
      return planRecord({
        ...identity,
        MODE: 'ERROR',
        DIFF_BASE: '',
        CHANGED_PATHS: [],
        AFFECTED_PACKAGES: [],
        TASK_COUNT: 0,
        FALLBACK_REASON: input.scm.kind || 'scm-error',
        SCM_KIND: input.scm.kind || 'scm-error',
        SCM_CONFIDENT: false,
        FULL_UNIVERSE: universe.length,
        CLASSIFICATION: input.scm.kind || 'scm-error',
      })
    }
    return fullPlan(common, input.scm?.kind || 'unresolved-scm')
  }

  const classification = planAffectedBuild(input.paths ?? [], input.packageDirs ?? [])
  common.classification = classification.reason
  if (classification.mode === 'full') {
    return fullPlan(common, classification.reason, classification.triggers ?? [])
  }
  if (classification.mode === 'not_applicable') {
    return planRecord({
      ...identity,
      MODE: 'NOT_APPLICABLE',
      DIFF_BASE: input.scm.diffBase ?? '',
      CHANGED_PATHS: input.paths ?? [],
      AFFECTED_PACKAGES: [],
      TASK_COUNT: 0,
      FALLBACK_REASON: 'proven-irrelevant',
      SCM_KIND: input.scm.kind,
      SCM_CONFIDENT: true,
      FULL_UNIVERSE: universe.length,
      CLASSIFICATION: 'proven-irrelevant',
    })
  }

  const relevant = (input.paths ?? []).filter((path) => !isDocumentationOnlyPath(path))
  const configTriggers = relevant.filter((path) => pathForcesFullTypecheck(path))
  if (configTriggers.length > 0) {
    return fullPlan(
      { ...common, classification: 'shared-compilation-config' },
      'shared-compilation-config',
      configTriggers,
    )
  }

  const changed = changedPackageNames(relevant, input.packageDirs ?? [], input.graph)
  if (!changed.ok) {
    return fullPlan({ ...common, classification: 'unknown-package' }, 'unknown-package', [changed.dir ?? ''])
  }
  const closure = expandTypecheckClosure(changed.names, input.graph)
  if (closure.length === 0) {
    return fullPlan({ ...common, classification: 'zero-task-affected' }, 'zero-task-affected')
  }

  if (input.turboQueryFailed) {
    return fullPlan({ ...common, classification: 'turbo-query-failed' }, 'turbo-query-failed')
  }

  let packages = closure
  if (Array.isArray(input.turboPackages)) {
    const union = unionAffectedPackages(closure, input.turboPackages)
    if (!union.ok) {
      return fullPlan(
        { ...common, classification: union.reason },
        union.reason,
        union.missing,
      )
    }
    packages = union.packages
  }

  if (packages.length === 0 || packages.length >= universe.length) {
    return fullPlan(
      { ...common, classification: 'affected-closure-is-universe' },
      packages.length === 0 ? 'zero-task-affected' : 'affected-closure-is-universe',
    )
  }

  return planRecord({
    ...identity,
    MODE: 'AFFECTED',
    DIFF_BASE: input.scm.diffBase ?? '',
    CHANGED_PATHS: input.paths ?? [],
    AFFECTED_PACKAGES: packages,
    TASK_COUNT: packages.length,
    FALLBACK_REASON: '',
    SCM_KIND: input.scm.kind,
    SCM_CONFIDENT: true,
    FULL_UNIVERSE: universe.length,
    CLASSIFICATION: 'workspace-package-changes',
  })
}

function gitOk(cwd, args) {
  try {
    execFileSync('git', args, { cwd, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function gitText(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

export function collectScmFacts(root, base, head, checkoutSha) {
  const checkout = checkoutSha || gitText(root, ['rev-parse', 'HEAD'])
  const baseExists = Boolean(base) && !/^0+$/.test(base) && gitOk(root, ['cat-file', '-e', `${base}^{commit}`])
  const headExists = Boolean(head) && !/^0+$/.test(head) && gitOk(root, ['cat-file', '-e', `${head}^{commit}`])
  const ancestor = baseExists && headExists ? gitOk(root, ['merge-base', '--is-ancestor', base, head]) : false
  const mergeBase = baseExists && headExists && !ancestor ? gitText(root, ['merge-base', base, head]) : ''
  const headInCheckout =
    !checkout || checkout === head || !headExists
      ? checkout === head || !checkout
      : gitOk(root, ['merge-base', '--is-ancestor', head, checkout])
  return assessScm({
    base,
    head,
    checkoutSha: checkout,
    baseExists,
    headExists,
    ancestor,
    mergeBase,
    headInCheckout,
  })
}

export function queryTurboAffectedTypecheck(root, base, head) {
  const env = {
    ...process.env,
    TURBO_TELEMETRY_DISABLED: '1',
    TURBO_SCM_BASE: base,
    TURBO_SCM_HEAD: head,
  }
  try {
    const stdout = execFileSync(
      'pnpm',
      ['exec', 'turbo', 'run', 'typecheck', '--affected', '--dry-run=json'],
      { cwd: root, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    return { ok: true, packages: parseTurboTypecheckPackages(stdout) }
  } catch (error) {
    const stdout = error && error.stdout ? String(error.stdout) : ''
    if (stdout.trim().startsWith('{')) {
      try {
        return { ok: true, packages: parseTurboTypecheckPackages(stdout) }
      } catch {
        // Fall through to the failed query.
      }
    }
    return { ok: false, packages: [], error: error instanceof Error ? error.message : String(error) }
  }
}

export function planRepositoryTypecheck(root, options = {}) {
  const base = options.base ?? ''
  const head = options.head ?? ''
  const packageDirs = listWorkspacePackageDirs(root)
  const graph = buildWorkspaceTypecheckGraph(root, packageDirs)
  const scm = options.scm ?? collectScmFacts(root, base, head, options.checkoutSha)
  let paths = options.paths
  if (!paths && scm.confident) {
    try {
      paths = readChangedPaths(scm.diffBase || base, head, root).map((path) => normalizeRepoPath(path) ?? path)
    } catch {
      return composeTypecheckPlan({
        baseSha: base,
        headSha: head,
        scm: { confident: false, kind: 'unreadable-diff', mode: 'FULL', diffBase: '' },
        paths: [],
        packageDirs,
        graph,
      })
    }
  }
  const uniquePaths = [...new Set(paths ?? [])].sort()
  let turboPackages = options.turboPackages
  let turboQueryFailed = Boolean(options.turboQueryFailed)
  const provisional = composeTypecheckPlan({
    baseSha: base,
    headSha: head,
    scm,
    paths: uniquePaths,
    packageDirs,
    graph,
    turboPackages: Array.isArray(turboPackages) ? turboPackages : undefined,
    turboQueryFailed: false,
  })
  if (options.verifyTurbo && provisional.MODE === 'AFFECTED' && !Array.isArray(turboPackages)) {
    const query = queryTurboAffectedTypecheck(root, scm.diffBase || base, head)
    turboPackages = query.packages
    turboQueryFailed = !query.ok
    if (!query.ok) console.error(`affected-typecheck turbo query failed: ${query.error ?? ''}`)
  }
  return composeTypecheckPlan({
    baseSha: base,
    headSha: head,
    scm,
    paths: uniquePaths,
    packageDirs,
    graph,
    turboPackages: Array.isArray(turboPackages) ? turboPackages : undefined,
    turboQueryFailed,
  })
}

function argument(name) {
  const index = process.argv.indexOf(name)
  if (index < 0 || index + 1 >= process.argv.length) return undefined
  return process.argv[index + 1]
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(entry).href
}

if (isDirectRun()) {
  let plan
  try {
    const root = argument('--root') ?? process.cwd()
    plan = planRepositoryTypecheck(root, {
      base: argument('--base') ?? '',
      head: argument('--head') ?? '',
      checkoutSha: argument('--checkout'),
      verifyTurbo: hasFlag('--verify-turbo'),
    })
  } catch (error) {
    plan = planRecord({
      MODE: 'ERROR',
      FALLBACK_REASON: 'planner-exception',
      CLASSIFICATION: error instanceof Error ? error.message : String(error),
      SCM_KIND: 'planner-exception',
    })
    console.error(plan.CLASSIFICATION)
  }
  const body = `${JSON.stringify(plan, null, 2)}\n`
  const out = argument('--out')
  if (out) writeFileSync(out, body)
  process.stdout.write(body)
  console.error(
    `affected-typecheck MODE=${plan.MODE} TASK_COUNT=${plan.TASK_COUNT} FALLBACK_REASON=${plan.FALLBACK_REASON || '-'} SCM_KIND=${plan.SCM_KIND}`,
  )
  if (plan.MODE === 'ERROR') process.exit(1)
}
