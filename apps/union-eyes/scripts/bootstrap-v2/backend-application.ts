import { readFileSync } from 'node:fs'
import path from 'node:path'
import { hash, root, runCurrentSourcePython } from './source'

export interface FrameworkExecutionInventory {
  routes: {
    id: string
    route: string
    method: string
    action: string
    callable: string
    binding: Record<string, string | number | null>
    viewBinding: Record<string, string | number | null>
    table: string
    methodCandidateOnly: boolean
    permissionClasses: string[]
    runtimeQualification: 'NOT_PROVEN'
  }[]
  frameworkOwnedRoutes: string[]
  taskCandidates: {
    id: string
    source: string
    sha256: string
    line: number
    decorators: string[]
    registeredNames: string[]
    registration: string
    runtimeQualification: 'NOT_PROVEN'
  }[]
  registeredTasks: {
    name: string
    callable: string
    binding: Record<string, string | number | null>
    runtimeQualification: 'NOT_PROVEN'
  }[]
  scheduledTasks: { name: string; task: string | null }[]
  mutationGraph: {
    rootBindings: Record<string, string[]>
    callers: {
      id: string
      source: string
      sha256: string
      line: number
      callable: string
      calls: string[]
      rootCallables: string[]
      mutations: {
        operation: string
        table: string
        line: number
        expression: string
        classification: string
      }[]
      unresolvedCalls: { expression: string; line: number; reason: string }[]
    }[]
    unreachableDirectWriters: unknown[]
    unresolvedRoots: { callable: string; bindings: string[]; reason: string }[]
    unresolvedReachableCalls: { caller: string; expression: string; line: number; reason: string }[]
    denominatorComplete: false
    runtimeQualification: 'NOT_PROVEN'
    limitations: string[]
  }
  unresolved: { route: string; reason: string }[]
  denominatorComplete: false
  limitations: string[]
}

export interface ApplicationStartupProof {
  lineage: 'PROSPECTIVE_UE_BOOTSTRAP_V2'
  contractVersion: '2.0'
  djangoVersion: string
  startup: 'PASS'
  currentSettings: 'config.settings'
  modelChecks: 'PASS'
  urlChecks: 'PASS'
  rootUrlPatterns: number
  currentManagedModels: number
  databaseConnections: 0
  runtimeDatabaseQualification: 'NOT_PROVEN'
  sourceDigests: Record<string, string>
  executionInventory?: FrameworkExecutionInventory
}

export function proveCurrentApplicationStartup(wheelhouse: string): ApplicationStartupProof {
  const proof: ApplicationStartupProof = JSON.parse(
    runCurrentSourcePython(wheelhouse, 'current_application.py'),
  )
  if (
    proof.lineage !== 'PROSPECTIVE_UE_BOOTSTRAP_V2' ||
    proof.contractVersion !== '2.0' ||
    proof.startup !== 'PASS' ||
    proof.currentSettings !== 'config.settings' ||
    proof.modelChecks !== 'PASS' ||
    proof.urlChecks !== 'PASS' ||
    proof.databaseConnections !== 0 ||
    proof.runtimeDatabaseQualification !== 'NOT_PROVEN' ||
    !Number.isInteger(proof.rootUrlPatterns) ||
    proof.rootUrlPatterns < 1 ||
    !Number.isInteger(proof.currentManagedModels) ||
    proof.currentManagedModels < 1 ||
    !proof.sourceDigests ||
    ![
      'apps/union-eyes/backend/config/settings.py',
      'apps/union-eyes/backend/config/wsgi.py',
      'apps/union-eyes/backend/config/urls.py',
    ].every((file) => typeof proof.sourceDigests[file] === 'string')
  )
    throw new Error('UE_V2_CURRENT_APPLICATION_STARTUP_BOUNDARY')
  for (const [file, digest] of Object.entries(proof.sourceDigests)) {
    if (!file.startsWith('apps/union-eyes/backend/') || file.split('/').includes('..'))
      throw new Error(`UE_V2_APPLICATION_SOURCE_PATH_REQUIRED:${file}`)
    if (hash(readFileSync(path.join(root, ...file.split('/')), 'utf8')) !== digest)
      throw new Error(`UE_V2_APPLICATION_SOURCE_CHANGED:${file}`)
  }
  return proof
}
