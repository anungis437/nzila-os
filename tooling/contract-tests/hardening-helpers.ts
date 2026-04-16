import { existsSync, readdirSync } from 'node:fs'
import { ROOT, readContent, safeJoin, walkSync } from './governance-helpers'

export type MaturityStatus = 'production' | 'pilot' | 'internal' | 'scaffold' | 'deprecated'

export interface AppMaturity {
  status: MaturityStatus
  exposure: 'public' | 'internal'
  data_integrity: 'enforced' | 'partial' | 'minimal'
  contracts_complete: boolean
  observability: 'complete' | 'partial' | 'minimal'
  last_validated: string
}

export function listApps(): string[] {
  const appsRoot = safeJoin(ROOT, 'apps')
  if (!appsRoot) return []

  return readdirSync(appsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readContent(filePath)) as T
}

export function getAppRoot(app: string): string {
  const appRoot = safeJoin(ROOT, 'apps', app)
  if (!appRoot) {
    throw new Error(`Invalid app path: ${app}`)
  }
  return appRoot
}

export function getMaturityPath(app: string): string {
  const maturityPath = safeJoin(getAppRoot(app), 'maturity.json')
  if (!maturityPath) {
    throw new Error(`Invalid maturity path: ${app}`)
  }
  return maturityPath
}

export function loadMaturity(app: string): AppMaturity {
  return readJsonFile<AppMaturity>(getMaturityPath(app))
}

export function loadAllMaturities(): Record<string, AppMaturity> {
  return Object.fromEntries(listApps().map((app) => [app, loadMaturity(app)]))
}

export function routeFilesForApp(app: string): string[] {
  const apiRoot = safeJoin(getAppRoot(app), 'app', 'api')
  if (!apiRoot) return []
  return walkSync(apiRoot, ['.ts', '.tsx', '.js', '.jsx']).filter((filePath) => /[\\/]route\.(ts|tsx|js|jsx)$/.test(filePath))
}

export function runtimeFilesForApp(app: string): string[] {
  const appRoot = getAppRoot(app)
  const runtimeRoots = ['app', 'lib', 'services']
    .map((segment) => safeJoin(appRoot, segment))
    .filter((dirPath): dirPath is string => Boolean(dirPath))
  return runtimeRoots.flatMap((dir) => walkSync(dir, ['.ts', '.tsx', '.js', '.jsx', '.mjs']))
    .filter((filePath) => !/\.test\./.test(filePath))
    .filter((filePath) => !/[\\/]scripts[\\/]/.test(filePath))
}

export function fileContains(filePath: string, pattern: RegExp | string): boolean {
  if (!existsSync(filePath)) return false
  const content = readContent(filePath)
  return typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content)
}
