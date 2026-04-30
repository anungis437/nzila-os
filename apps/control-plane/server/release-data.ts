import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface ReleaseDashboardData {
  version: string
  commit: string
  lastDeploymentAt: string
  rollbackAvailable: boolean
  semverCompliant: boolean
  stagingGate: 'passed' | 'pending' | 'failed'
  productionApproval: 'approved' | 'pending' | 'rejected'
}

export async function getReleaseDashboardData(): Promise<ReleaseDashboardData> {
  const fallback: ReleaseDashboardData = {
    version: process.env.npm_package_version ?? '0.0.0',
    commit: process.env.GITHUB_SHA ?? 'local',
    lastDeploymentAt: new Date().toISOString(),
    rollbackAvailable: true,
    semverCompliant: true,
    stagingGate: 'pending',
    productionApproval: 'pending',
  }

  try {
    const path = join(process.cwd(), '..', '..', 'governance', 'releases', 'release-state.json')
    const raw = await readFile(path, 'utf-8')
    return { ...fallback, ...(JSON.parse(raw) as Partial<ReleaseDashboardData>) }
  } catch {
    return fallback
  }
}
