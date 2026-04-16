#!/usr/bin/env npx tsx
/**
 * validate-workspace-links
 *
 * Verifies every dependency declared as `workspace:*` resolves to an
 * existing workspace package name. Fails closed on unresolved references.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

type PackageJson = {
  name?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

function findRepoRoot(): string {
  let dir = process.cwd()
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = dirname(dir)
  }
  throw new Error('Cannot locate repo root')
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function collectPackageJsonPaths(root: string): string[] {
  const paths: string[] = []

  const scanRoot = (relativePath: string): void => {
    const fullRoot = join(root, relativePath)
    if (!existsSync(fullRoot)) return

    for (const entry of readdirSync(fullRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const pkgPath = join(fullRoot, entry.name, 'package.json')
      if (existsSync(pkgPath)) {
        paths.push(pkgPath)
      }
    }
  }

  scanRoot('apps')
  scanRoot('packages')
  scanRoot('tooling')

  const rootPackage = join(root, 'package.json')
  if (existsSync(rootPackage)) {
    paths.push(rootPackage)
  }

  return paths
}

function main(): void {
  const root = findRepoRoot()
  const packagePaths = collectPackageJsonPaths(root)

  const workspaceNames = new Set<string>()
  for (const packagePath of packagePaths) {
    const pkg = readJson<PackageJson>(packagePath)
    if (pkg.name) workspaceNames.add(pkg.name)
  }

  const unresolved: Array<{ owner: string; dependency: string }> = []

  for (const packagePath of packagePaths) {
    const pkg = readJson<PackageJson>(packagePath)
    const owner = pkg.name ?? packagePath.replace(`${root}\\`, '').replace(`${root}/`, '')

    const maps = [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies, pkg.optionalDependencies]
    for (const map of maps) {
      if (!map) continue
      for (const [depName, depVersion] of Object.entries(map)) {
        if (!depVersion.startsWith('workspace:')) continue
        if (!workspaceNames.has(depName)) {
          unresolved.push({ owner, dependency: depName })
        }
      }
    }
  }

  console.log('\nWorkspace Dependency Integrity\n')
  console.log(`Checked packages: ${packagePaths.length}`)
  console.log(`Workspace names: ${workspaceNames.size}`)

  if (unresolved.length === 0) {
    console.log('PASS: all workspace:* dependencies resolve to local packages')
    return
  }

  console.log('\nERROR unresolved workspace dependencies:')
  for (const item of unresolved) {
    console.log(`- ${item.owner} -> ${item.dependency}`)
  }

  process.exit(1)
}

main()
