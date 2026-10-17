import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { listWorkspacePackageDirs } from './affected-build-plan.mjs'
import { partitionTaskPlan, runTurboTask } from './run-typecheck-shard.mjs'

export function selectBuildScope(entries, activeApps, catalogApps) {
  if (
    !Array.isArray(activeApps) ||
    !activeApps.length ||
    new Set(activeApps).size !== activeApps.length ||
    activeApps.some((app) => typeof app !== 'string' || !catalogApps.includes(app))
  ) {
    throw new Error('Invalid active app build scope')
  }
  const seen = new Set()
  const foundApps = new Set()
  const selected = []
  const excluded = []
  for (const { dir, manifest } of entries) {
    if (!manifest.name || seen.has(manifest.name))
      throw new Error('Invalid workspace build identity')
    seen.add(manifest.name)
    const app = dir.startsWith('apps/') ? dir.split('/')[1] : null
    if (app && !catalogApps.includes(app)) throw new Error(`Unclassified app build target: ${app}`)
    if (app && dir === `apps/${app}`) foundApps.add(app)
    if (typeof manifest.scripts?.build !== 'string' || !manifest.scripts.build.trim()) continue
    if (app && !activeApps.includes(app)) excluded.push(manifest.name)
    else selected.push(manifest.name)
  }
  if (activeApps.some((app) => !foundApps.has(app)))
    throw new Error('Active app workspace is missing')
  return { selected: selected.sort(), excluded: excluded.sort() }
}

export function scopedBuildPlan(root) {
  const rootManifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  if (
    rootManifest.scripts.build !== 'turbo build' ||
    rootManifest.scripts.prebuild ||
    rootManifest.scripts.postbuild
  ) {
    throw new Error('Root build semantics changed; CI build scope must be reviewed')
  }
  const scope = JSON.parse(readFileSync(join(root, 'governance/ci/build-scope.json'), 'utf8'))
  if (scope.schemaVersion !== 1) throw new Error('Unknown CI build scope version')
  const catalog = JSON.parse(
    readFileSync(join(root, 'governance/portfolio/product-catalog.json'), 'utf8'),
  )
  const entries = listWorkspacePackageDirs(root).map((dir) => ({
    dir,
    manifest: JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')),
  }))
  const { selected, excluded } = selectBuildScope(
    entries,
    scope.activeApps,
    catalog.products.map((p) => p.id),
  )
  return {
    MODE: 'FULL',
    AFFECTED_PACKAGES: selected,
    TASK_COUNT: selected.length,
    FULL_UNIVERSE: selected.length,
    ACTIVE_APPS: scope.activeApps,
    EXCLUDED_APP_PACKAGES: excluded,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [index, total] = process.argv.slice(2)
    const scope = scopedBuildPlan(process.cwd())
    const receipt = partitionTaskPlan(
      {
        ...scope,
        BASE_SHA: process.env.BUILD_BASE,
        HEAD_SHA: process.env.BUILD_HEAD,
      },
      Number(index),
      Number(total),
    )
    Object.assign(receipt, {
      ACTIVE_APPS: scope.ACTIVE_APPS,
      EXCLUDED_APP_PACKAGES: scope.EXCLUDED_APP_PACKAGES,
    })
    console.log(JSON.stringify(receipt))
    const outputDir = process.env.RUNNER_TEMP || '.turbo'
    mkdirSync(outputDir, { recursive: true })
    writeFileSync(
      join(outputDir, `scoped-build-shard-${index}.json`),
      `${JSON.stringify(receipt, null, 2)}\n`,
    )
    process.exitCode = runTurboTask(receipt, 'build')
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
