import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/

function isSemver(value: string): boolean {
  return SEMVER_RE.test(value)
}

function main() {
  const root = process.cwd()
  const pkgPath = join(root, 'package.json')
  const statePath = join(root, 'governance', 'releases', 'release-state.json')

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string }
  const version = pkg.version ?? ''

  if (!isSemver(version)) {
    console.error(`[semver-governance] Invalid semver version in package.json: ${version}`)
    process.exit(1)
  }

  const state = JSON.parse(readFileSync(statePath, 'utf-8')) as Record<string, unknown>
  const updated = {
    ...state,
    version,
    commit: process.env.GITHUB_SHA ?? state.commit ?? 'local',
    lastDeploymentAt: new Date().toISOString(),
    semverCompliant: true,
  }

  writeFileSync(statePath, `${JSON.stringify(updated, null, 2)}\n`, 'utf-8')
  console.log(`[semver-governance] OK ${version}`)
}

main()
