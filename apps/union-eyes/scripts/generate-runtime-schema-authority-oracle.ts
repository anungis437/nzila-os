#!/usr/bin/env tsx
/**
 * Union Eyes complete runtime schema authority oracle.
 *
 * This is deliberately NOT a migration generator. It reconciles the
 * storage-authority registry against repository migration history so the
 * programme can distinguish "missing from the current fresh bootstrap" from
 * "no governed creation lineage exists".
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import {
  storageAuthorityManifest,
  type StorageAuthorityEntry,
} from '../db/rls-storage-authority-manifest'
import {
  scanAdditionalDeclarationFiles,
  scanSchemaDeclarations,
  type Declaration,
} from './schema-duplicate-table-scan'

const APP_ROOT = resolve(__dirname, '..')
const REPO_ROOT = resolve(APP_ROOT, '..', '..')
const OUT_DIR = resolve(REPO_ROOT, 'reports')

const RLS_REQUIRED_CLASSIFICATIONS = new Set([
  'TENANT_RLS_REQUIRED',
  'USER_RLS_REQUIRED',
  'PARENT_OWNED_RLS_REQUIRED',
  'MIXED_GLOBAL_TENANT_RLS_REQUIRED',
  'MULTI_PARTY_RLS_REQUIRED',
])

const FROZEN_DJANGO_DIGEST = 'f60040e62c1253d0e3aa6476e993241c331f8e02b10a16015ec83c2577a73c47'

type LineageKind =
  | 'DJANGO_MIGRATIONS'
  | 'UNION_EYES_LEGACY_SQL'
  | 'UNION_EYES_SCOPED_SQL'
  | 'UNION_EYES_PLATFORM_SQL'
  | 'UNION_EYES_AUDIT_SQL'
  | 'ROOT_PLATFORM_SQL'
  | 'ROOT_SQL'
  | 'SHARED_DRIZZLE_SQL'
  | 'QA_BASELINE_SQL'
  | 'SCRIPTED_SQL'
  | 'SERVICE_SQL'

type CreationLineage =
  | 'DJANGO_CANONICAL_LINEAGE'
  | 'ACTIVE_SQL_PLATFORM_LINEAGE'
  | 'OTHER_GOVERNED_LINEAGE'
  | 'PROJECTED_OR_RUNTIME_USED_WITHOUT_CREATION_LINEAGE'
  | 'EXTERNAL_OR_NONLOCAL_STORAGE'

type SchemaOwner =
  | 'DJANGO_OWNED'
  | 'PLATFORM_SQL_OWNED'
  | 'SCOPED_AUTHORITY_OWNED'
  | 'QA_BASELINE_ONLY'
  | 'SCRIPTED_OR_STUB_ONLY'
  | 'EXTERNAL'
  | 'UNKNOWN'

export interface LineageSource {
  lineage: LineageKind
  owner: string
  directory: string
  executionMechanism: string
  currentBootstrapStatus:
    | 'EXECUTED_BY_FRESH_BOOTSTRAP'
    | 'OPTIONAL_QA_CI_BASELINE'
    | 'NOT_EXECUTED_BY_FRESH_BOOTSTRAP'
    | 'FORENSIC_OR_SCRIPTED_ONLY'
  rlsOrSecurityOnly: boolean
  historicalOrder: number
  files: string[]
}

export interface CreationEvidence {
  lineage: LineageKind
  file: string
  match: string
  historicalOrder: number
  currentBootstrapStatus: LineageSource['currentBootstrapStatus']
}

interface RuntimeSchemaRecord {
  table: string
  storageAuthorityDomain: string
  runtimePrincipal: 'tenant' | 'mixed' | 'system_or_none'
  runtimePrivileges: readonly string[]
  rlsRequired: boolean
  drizzleProjection: string[]
  djangoModel: string | null
  djangoCreatingMigration: string | null
  sqlCreatingMigration: string | null
  otherCreatingMigration: string | null
  activeRuntimeReaders: string[]
  activeRuntimeWriters: string[]
  presentInF60040: 'UNKNOWN_NOT_MEASURED'
  creationLineage: CreationLineage
  scopeDisposition: string | null
  canonicalRequirement: 'REQUIRED' | 'EXCLUDED_BY_SCOPE_DISPOSITION' | 'UNRESOLVED'
  schemaOwner: SchemaOwner
  creationEvidence: CreationEvidence[]
}

export interface RuntimeSchemaOracle {
  generatedAt: string
  status: {
    f60040Schema: 'PARTIAL_RUNTIME_SCHEMA'
    previousRuntimeContractCompleteness: 'INSUFFICIENT'
    canonicalSchemaAuthorityClosure: 'BLOCKED' | 'READY_FOR_BOOTSTRAP_PROOF'
    preCompleteRuntimeSchemaDigest: string
  }
  lineageMap: Omit<LineageSource, 'files'>[]
  counts: {
    storageAuthorityEntries: number
    runtimeUniverseTables: number
    tenantOrMixedRuntimePrincipalTables: number
    tablesWithNonEmptyRuntimePrivileges: number
    rlsRequiredTables: number
    runtimeTablesWithExistingCreationMigration: number
    runtimeTablesWithoutCreationMigration: number
    runtimeTablesWithOwner: number
    runtimeTablesWithoutSchemaOwner: number
    runtimeTablesWithMultipleSchemaOwners: number
    bootstrapParticipatingCreationTables: number
    bootstrapMissingCreationTables: number
  }
  requiredFollowUp: string[]
  records: RuntimeSchemaRecord[]
}

interface SourceFile {
  path: string
  src: string
}

const LINEAGES: LineageSource[] = [
  {
    lineage: 'DJANGO_MIGRATIONS',
    owner: 'DJANGO_OWNED',
    directory: 'apps/union-eyes/backend/**/migrations',
    executionMechanism: 'Django migration executor',
    currentBootstrapStatus: 'NOT_EXECUTED_BY_FRESH_BOOTSTRAP',
    rlsOrSecurityOnly: false,
    historicalOrder: 10,
    files: [],
  },
  {
    lineage: 'UNION_EYES_LEGACY_SQL',
    owner: 'PLATFORM_SQL_OWNED',
    directory: 'apps/union-eyes/db/migrations',
    executionMechanism: 'Frozen historical SQL/Drizzle lineage; guarded by .lineage-frozen',
    currentBootstrapStatus: 'NOT_EXECUTED_BY_FRESH_BOOTSTRAP',
    rlsOrSecurityOnly: false,
    historicalOrder: 20,
    files: [],
  },
  {
    lineage: 'UNION_EYES_SCOPED_SQL',
    owner: 'SCOPED_AUTHORITY_OWNED',
    directory: 'apps/union-eyes/db/migrations-cache',
    executionMechanism:
      'tooling/scripts/lib/union-eyes-scoped-migrations.mjs via db:bootstrap and db:scoped-migrate:existing',
    currentBootstrapStatus: 'EXECUTED_BY_FRESH_BOOTSTRAP',
    rlsOrSecurityOnly: true,
    historicalOrder: 30,
    files: [],
  },
  {
    lineage: 'UNION_EYES_PLATFORM_SQL',
    owner: 'PLATFORM_SQL_OWNED',
    directory: 'apps/union-eyes/db/migrations-platform',
    executionMechanism:
      'tooling/scripts/lib/union-eyes-platform-migrations.mjs via db:bootstrap (after scoped)',
    currentBootstrapStatus: 'EXECUTED_BY_FRESH_BOOTSTRAP',
    rlsOrSecurityOnly: false,
    historicalOrder: 35,
    files: [],
  },
  {
    lineage: 'UNION_EYES_AUDIT_SQL',
    owner: 'PLATFORM_SQL_OWNED',
    directory: 'apps/union-eyes/db/migrations-audit',
    executionMechanism: 'Audit/forensic SQL lineage; no fresh-bootstrap executor found',
    currentBootstrapStatus: 'NOT_EXECUTED_BY_FRESH_BOOTSTRAP',
    rlsOrSecurityOnly: false,
    historicalOrder: 40,
    files: [],
  },
  {
    lineage: 'ROOT_PLATFORM_SQL',
    owner: 'PLATFORM_SQL_OWNED',
    directory: 'migrations/platform',
    executionMechanism: 'Root platform SQL lineage; no Union Eyes fresh-bootstrap executor found',
    currentBootstrapStatus: 'NOT_EXECUTED_BY_FRESH_BOOTSTRAP',
    rlsOrSecurityOnly: false,
    historicalOrder: 50,
    files: [],
  },
  {
    lineage: 'ROOT_SQL',
    owner: 'PLATFORM_SQL_OWNED',
    directory: 'migrations',
    executionMechanism:
      'Root SQL lineage; execution governed by repository-level migration manifest where applicable',
    currentBootstrapStatus: 'NOT_EXECUTED_BY_FRESH_BOOTSTRAP',
    rlsOrSecurityOnly: false,
    historicalOrder: 60,
    files: [],
  },
  {
    lineage: 'SHARED_DRIZZLE_SQL',
    owner: 'PLATFORM_SQL_OWNED',
    directory: 'packages/db/drizzle',
    executionMechanism:
      'Shared package Drizzle lineage; not executed by Union Eyes fresh bootstrap',
    currentBootstrapStatus: 'NOT_EXECUTED_BY_FRESH_BOOTSTRAP',
    rlsOrSecurityOnly: false,
    historicalOrder: 70,
    files: [],
  },
  {
    lineage: 'QA_BASELINE_SQL',
    owner: 'QA_BASELINE_ONLY',
    directory: 'tooling/sql',
    executionMechanism:
      'QA/CI bootstrap fallback when no snapshot exists or user_management is absent',
    currentBootstrapStatus: 'OPTIONAL_QA_CI_BASELINE',
    rlsOrSecurityOnly: false,
    historicalOrder: 80,
    files: [],
  },
  {
    lineage: 'SCRIPTED_SQL',
    owner: 'SCRIPTED_OR_STUB_ONLY',
    directory: 'scripts',
    executionMechanism: 'Ad hoc scripted SQL; not canonical unless separately governed',
    currentBootstrapStatus: 'FORENSIC_OR_SCRIPTED_ONLY',
    rlsOrSecurityOnly: false,
    historicalOrder: 90,
    files: [],
  },
  {
    lineage: 'SERVICE_SQL',
    owner: 'EXTERNAL',
    directory: 'apps/union-eyes/services/**',
    executionMechanism: 'Service-local SQL lineage, potentially separate database boundary',
    currentBootstrapStatus: 'NOT_EXECUTED_BY_FRESH_BOOTSTRAP',
    rlsOrSecurityOnly: false,
    historicalOrder: 100,
    files: [],
  },
]

function walkFiles(dir: string, predicate: (file: string) => boolean): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const path = join(dir, entry)
    const st = statSync(path)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === '.turbo' || entry === '.venv')
        continue
      out.push(...walkFiles(path, predicate))
    } else if (predicate(path)) {
      out.push(path)
    }
  }
  return out.sort((a, b) => a.localeCompare(b))
}

function readSourceFiles(files: string[]): SourceFile[] {
  const sources: SourceFile[] = []
  for (const file of files) {
    try {
      sources.push({
        path: relative(REPO_ROOT, file).replace(/\\/g, '/'),
        src: readFileSync(file, 'utf8'),
      })
    } catch {
      // Best-effort static oracle: unreadable files simply contribute no evidence.
    }
  }
  return sources
}

function buildRuntimeSourceIndex(): SourceFile[] {
  const roots = ['app', 'actions', 'lib', 'services'].map((dir) => join(APP_ROOT, dir))
  return roots.flatMap((root) =>
    readSourceFiles(
      walkFiles(
        root,
        (file) =>
          (file.endsWith('.ts') || file.endsWith('.tsx')) &&
          !file.includes('__tests__') &&
          !file.includes('.test.') &&
          !file.includes('.spec.'),
      ),
    ),
  )
}

function buildDjangoModelIndex(): Map<string, string> {
  const byTable = new Map<string, string>()
  const dbTableRe = /db_table\s*=\s*["']([a-z0-9_]+)["']/gi
  const modelFiles = walkFiles(join(APP_ROOT, 'backend'), (file) => file.endsWith('models.py'))
  for (const file of modelFiles) {
    const rel = relative(REPO_ROOT, file).replace(/\\/g, '/')
    const src = readFileSync(file, 'utf8')
    let match: RegExpExecArray | null
    while ((match = dbTableRe.exec(src))) {
      if (!byTable.has(match[1])) byTable.set(match[1], rel)
    }
  }
  return byTable
}

function populateLineageFiles(): LineageSource[] {
  return LINEAGES.map((lineage) => {
    let baseFiles: string[] = []
    switch (lineage.lineage) {
      case 'DJANGO_MIGRATIONS':
        baseFiles = walkFiles(
          join(APP_ROOT, 'backend'),
          (file) => file.endsWith('.py') && file.includes(`${join('', 'migrations')}\\`),
        )
        break
      case 'UNION_EYES_LEGACY_SQL':
        baseFiles = walkFiles(join(APP_ROOT, 'db', 'migrations'), (file) => file.endsWith('.sql'))
        break
      case 'UNION_EYES_SCOPED_SQL':
        baseFiles = walkFiles(join(APP_ROOT, 'db', 'migrations-cache'), (file) =>
          file.endsWith('.sql'),
        )
        break
      case 'UNION_EYES_PLATFORM_SQL':
        baseFiles = walkFiles(join(APP_ROOT, 'db', 'migrations-platform'), (file) =>
          file.endsWith('.sql') && !file.includes('.rollback.'),
        )
        break
      case 'UNION_EYES_AUDIT_SQL':
        baseFiles = walkFiles(join(APP_ROOT, 'db', 'migrations-audit'), (file) =>
          file.endsWith('.sql'),
        )
        break
      case 'ROOT_PLATFORM_SQL':
        baseFiles = walkFiles(join(REPO_ROOT, 'migrations', 'platform'), (file) =>
          file.endsWith('.sql'),
        )
        break
      case 'ROOT_SQL':
        baseFiles = readdirSync(join(REPO_ROOT, 'migrations'))
          .filter((entry) => entry.endsWith('.sql'))
          .map((entry) => join(REPO_ROOT, 'migrations', entry))
        break
      case 'SHARED_DRIZZLE_SQL':
        baseFiles = walkFiles(join(REPO_ROOT, 'packages', 'db', 'drizzle'), (file) =>
          file.endsWith('.sql'),
        )
        break
      case 'QA_BASELINE_SQL':
        baseFiles = walkFiles(join(REPO_ROOT, 'tooling', 'sql'), (file) => file.endsWith('.sql'))
        break
      case 'SCRIPTED_SQL':
        baseFiles = walkFiles(join(REPO_ROOT, 'scripts'), (file) => file.endsWith('.sql'))
        break
      case 'SERVICE_SQL':
        baseFiles = walkFiles(join(APP_ROOT, 'services'), (file) => file.endsWith('.sql'))
        break
    }
    return {
      ...lineage,
      files: baseFiles.map((file) => relative(REPO_ROOT, file).replace(/\\/g, '/')),
    }
  })
}

function mergeDeclarations(): Map<string, Declaration[]> {
  const declarations = scanSchemaDeclarations()
  const additional = scanAdditionalDeclarationFiles([
    resolve(APP_ROOT, 'db/schema-organizations.ts'),
    resolve(APP_ROOT, 'db/schema-applications.ts'),
    resolve(APP_ROOT, 'db/data/communication.ts'),
  ])
  for (const [key, decls] of additional) {
    declarations.set(key, [...(declarations.get(key) ?? []), ...decls])
  }
  return declarations
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildCreationEvidenceIndex(lineages: LineageSource[]): Map<string, CreationEvidence[]> {
  const byTable = new Map<string, CreationEvidence[]>()
  const sqlCreateRe =
    /\bCREATE\s+(?:UNLOGGED\s+|TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"?public"?\.)?)"?([a-z0-9_]+)"?\b/gi
  const djangoDbTableRe =
    /["']db_table["']\s*:\s*["']([a-z0-9_]+)["']|db_table\s*=\s*["']([a-z0-9_]+)["']/gi
  for (const lineage of lineages) {
    for (const file of lineage.files) {
      const abs = resolve(REPO_ROOT, file)
      let src = ''
      try {
        src = readFileSync(abs, 'utf8')
      } catch {
        continue
      }
      const re = lineage.lineage === 'DJANGO_MIGRATIONS' ? djangoDbTableRe : sqlCreateRe
      re.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = re.exec(src))) {
        const table = match[1] ?? match[2]
        if (!table) continue
        const item: CreationEvidence = {
          lineage: lineage.lineage,
          file,
          match: match[0].replace(/\s+/g, ' ').slice(0, 160),
          historicalOrder: lineage.historicalOrder,
          currentBootstrapStatus: lineage.currentBootstrapStatus,
        }
        const existing = byTable.get(table) ?? []
        existing.push(item)
        byTable.set(table, existing)
      }
    }
  }
  for (const [table, evidence] of byTable) {
    byTable.set(
      table,
      evidence.sort(
        (a, b) => a.historicalOrder - b.historicalOrder || a.file.localeCompare(b.file),
      ),
    )
  }
  return byTable
}

function inferReaderWriterFiles(
  entry: StorageAuthorityEntry,
  declaration: Declaration | undefined,
  runtimeSources: SourceFile[],
): { readers: string[]; writers: string[] } {
  const files = new Map<string, string>()
  for (const source of runtimeSources) {
    const exportName = declaration?.exportName
    const mentionsTable = new RegExp(`\\b${escapeRe(entry.table)}\\b`, 'i').test(source.src)
    const mentionsExport = exportName
      ? new RegExp(`\\b${escapeRe(exportName)}\\b`).test(source.src)
      : false
    if (mentionsTable || mentionsExport) files.set(source.path, source.src)
  }
  for (const supporting of entry.supportingCapability) {
    const path = `apps/union-eyes/${supporting}`.replace(/\\/g, '/')
    if (!files.has(path)) {
      try {
        files.set(path, readFileSync(resolve(REPO_ROOT, path), 'utf8'))
      } catch {
        // Evidence path may be historical or non-TS; ignore if unreadable.
      }
    }
  }
  const readers: string[] = []
  const writers: string[] = []
  for (const [file, src] of [...files.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const exportName = declaration?.exportName
    const reads =
      new RegExp(
        `\\bFROM\\s+"?${escapeRe(entry.table)}"?\\b|\\.from\\(\\s*${exportName ? escapeRe(exportName) : 'NEVER_MATCH'}\\b`,
        'i',
      ).test(src) ||
      new RegExp(
        `\\bJOIN\\s+"?${escapeRe(entry.table)}"?\\b|db\\.query\\.${exportName ? escapeRe(exportName) : 'NEVER_MATCH'}\\b`,
        'i',
      ).test(src)
    const writes =
      new RegExp(
        `\\bINSERT\\s+INTO\\s+"?${escapeRe(entry.table)}"?\\b|\\.insert\\(\\s*${exportName ? escapeRe(exportName) : 'NEVER_MATCH'}\\b`,
        'i',
      ).test(src) ||
      new RegExp(
        `\\bUPDATE\\s+"?${escapeRe(entry.table)}"?\\b|\\.update\\(\\s*${exportName ? escapeRe(exportName) : 'NEVER_MATCH'}\\b|\\.delete\\(\\s*${exportName ? escapeRe(exportName) : 'NEVER_MATCH'}\\b`,
        'i',
      ).test(src)
    if (reads) readers.push(file)
    if (writes) writers.push(file)
  }
  return { readers, writers }
}

function runtimePrivileges(entry: StorageAuthorityEntry): readonly string[] {
  return entry.requiredRuntimePrivileges === 'TBD' ? [] : entry.requiredRuntimePrivileges
}

function isRuntimeUniverse(entry: StorageAuthorityEntry): boolean {
  return (
    entry.dbExecutionPrincipal === 'TENANT_RUNTIME' ||
    entry.dbExecutionPrincipal === 'MIXED' ||
    runtimePrivileges(entry).length > 0 ||
    RLS_REQUIRED_CLASSIFICATIONS.has(entry.classification)
  )
}

function inferOwner(evidence: CreationEvidence[], entry: StorageAuthorityEntry): SchemaOwner {
  if (entry.scopeDisposition === 'SEPARATE_DATABASE_BOUNDARY') return 'EXTERNAL'
  if (evidence.some((item) => item.lineage === 'DJANGO_MIGRATIONS')) return 'DJANGO_OWNED'
  if (evidence.some((item) => item.lineage === 'UNION_EYES_SCOPED_SQL'))
    return 'SCOPED_AUTHORITY_OWNED'
  if (
    evidence.some((item) =>
      [
        'UNION_EYES_LEGACY_SQL',
        'UNION_EYES_PLATFORM_SQL',
        'UNION_EYES_AUDIT_SQL',
        'ROOT_PLATFORM_SQL',
        'ROOT_SQL',
        'SHARED_DRIZZLE_SQL',
      ].includes(item.lineage),
    )
  ) {
    return 'PLATFORM_SQL_OWNED'
  }
  if (evidence.some((item) => item.lineage === 'QA_BASELINE_SQL')) return 'QA_BASELINE_ONLY'
  if (evidence.some((item) => item.lineage === 'SCRIPTED_SQL')) return 'SCRIPTED_OR_STUB_ONLY'
  return 'UNKNOWN'
}

function inferCreationLineage(
  evidence: CreationEvidence[],
  entry: StorageAuthorityEntry,
): CreationLineage {
  if (entry.scopeDisposition === 'SEPARATE_DATABASE_BOUNDARY') return 'EXTERNAL_OR_NONLOCAL_STORAGE'
  if (evidence.some((item) => item.lineage === 'DJANGO_MIGRATIONS'))
    return 'DJANGO_CANONICAL_LINEAGE'
  if (
    evidence.some((item) =>
      ['UNION_EYES_LEGACY_SQL', 'UNION_EYES_PLATFORM_SQL', 'ROOT_PLATFORM_SQL', 'ROOT_SQL', 'SHARED_DRIZZLE_SQL'].includes(
        item.lineage,
      ),
    )
  ) {
    return 'ACTIVE_SQL_PLATFORM_LINEAGE'
  }
  if (evidence.length > 0) return 'OTHER_GOVERNED_LINEAGE'
  return 'PROJECTED_OR_RUNTIME_USED_WITHOUT_CREATION_LINEAGE'
}

function schemaDomain(declaration: Declaration | undefined): string {
  if (!declaration) return 'undeclared'
  return declaration.modulePath
}

export function buildRuntimeSchemaOracle(): RuntimeSchemaOracle {
  const lineages = populateLineageFiles()
  const declarations = mergeDeclarations()
  const runtimeSources = buildRuntimeSourceIndex()
  const djangoModelsByTable = buildDjangoModelIndex()
  const creationEvidenceByTable = buildCreationEvidenceIndex(lineages)
  const records: RuntimeSchemaRecord[] = []

  for (const entry of storageAuthorityManifest
    .filter(isRuntimeUniverse)
    .sort((a, b) => a.table.localeCompare(b.table))) {
    const decls = declarations.get(`public.${entry.table}`) ?? []
    const primaryDecl = decls[0]
    const evidence = creationEvidenceByTable.get(entry.table) ?? []
    const djangoEvidence = evidence.find((item) => item.lineage === 'DJANGO_MIGRATIONS') ?? null
    const sqlEvidence =
      evidence.find(
        (item) =>
          item.lineage !== 'DJANGO_MIGRATIONS' &&
          item.lineage !== 'QA_BASELINE_SQL' &&
          item.lineage !== 'SCRIPTED_SQL',
      ) ?? null
    const otherEvidence =
      evidence.find(
        (item) => item.lineage === 'QA_BASELINE_SQL' || item.lineage === 'SCRIPTED_SQL',
      ) ?? null
    const { readers, writers } = inferReaderWriterFiles(entry, primaryDecl, runtimeSources)
    const owner = inferOwner(evidence, entry)

    records.push({
      table: entry.table,
      storageAuthorityDomain: schemaDomain(primaryDecl),
      runtimePrincipal:
        entry.dbExecutionPrincipal === 'MIXED'
          ? 'mixed'
          : entry.dbExecutionPrincipal === 'TENANT_RUNTIME' ||
              runtimePrivileges(entry).length > 0 ||
              RLS_REQUIRED_CLASSIFICATIONS.has(entry.classification)
            ? 'tenant'
            : 'system_or_none',
      runtimePrivileges: runtimePrivileges(entry),
      rlsRequired: RLS_REQUIRED_CLASSIFICATIONS.has(entry.classification),
      drizzleProjection: decls.map((decl) => `${decl.modulePath}.${decl.exportName}`),
      djangoModel: djangoModelsByTable.get(entry.table) ?? null,
      djangoCreatingMigration: djangoEvidence?.file ?? null,
      sqlCreatingMigration: sqlEvidence?.file ?? null,
      otherCreatingMigration: otherEvidence?.file ?? null,
      activeRuntimeReaders: readers,
      activeRuntimeWriters: writers,
      presentInF60040: 'UNKNOWN_NOT_MEASURED',
      creationLineage: inferCreationLineage(evidence, entry),
      scopeDisposition: entry.scopeDisposition ?? null,
      canonicalRequirement: entry.scopeDisposition
        ? 'EXCLUDED_BY_SCOPE_DISPOSITION'
        : owner === 'UNKNOWN'
          ? 'UNRESOLVED'
          : 'REQUIRED',
      schemaOwner: owner,
      creationEvidence: evidence,
    })
  }

  const withoutCreation = records.filter((record) => record.creationEvidence.length === 0)
  const withoutOwner = records.filter(
    (record) => record.schemaOwner === 'UNKNOWN' && !record.scopeDisposition,
  )
  const multipleOwners = records.filter((record) => {
    const owners = new Set(
      record.creationEvidence.map((item) =>
        inferOwner([item], storageAuthorityManifest.find((entry) => entry.table === record.table)!),
      ),
    )
    owners.delete('UNKNOWN')
    return owners.size > 1
  })
  const bootstrapCreation = records.filter((record) =>
    record.creationEvidence.some(
      (item) =>
        item.currentBootstrapStatus === 'EXECUTED_BY_FRESH_BOOTSTRAP' ||
        item.currentBootstrapStatus === 'OPTIONAL_QA_CI_BASELINE',
    ),
  )

  return {
    generatedAt: new Date().toISOString(),
    status: {
      f60040Schema: 'PARTIAL_RUNTIME_SCHEMA',
      previousRuntimeContractCompleteness: 'INSUFFICIENT',
      canonicalSchemaAuthorityClosure:
        withoutOwner.length === 0 ? 'READY_FOR_BOOTSTRAP_PROOF' : 'BLOCKED',
      preCompleteRuntimeSchemaDigest: FROZEN_DJANGO_DIGEST,
    },
    lineageMap: lineages.map(({ files: _files, ...lineage }) => lineage),
    counts: {
      storageAuthorityEntries: storageAuthorityManifest.length,
      runtimeUniverseTables: records.length,
      tenantOrMixedRuntimePrincipalTables: records.filter(
        (record) => record.runtimePrincipal === 'tenant' || record.runtimePrincipal === 'mixed',
      ).length,
      tablesWithNonEmptyRuntimePrivileges: records.filter(
        (record) => record.runtimePrivileges.length > 0,
      ).length,
      rlsRequiredTables: records.filter((record) => record.rlsRequired).length,
      runtimeTablesWithExistingCreationMigration: records.length - withoutCreation.length,
      runtimeTablesWithoutCreationMigration: withoutCreation.length,
      runtimeTablesWithOwner: records.length - withoutOwner.length,
      runtimeTablesWithoutSchemaOwner: withoutOwner.length,
      runtimeTablesWithMultipleSchemaOwners: multipleOwners.length,
      bootstrapParticipatingCreationTables: bootstrapCreation.length,
      bootstrapMissingCreationTables: records.length - bootstrapCreation.length,
    },
    requiredFollowUp: [
      'Measure presentInF60040 against the accepted f60040 physical schema snapshot instead of inferring it from source.',
      'Promote or explicitly exclude every UNKNOWN owner before claiming canonical schema authority closure.',
      'Derive and prove a complete local PostgreSQL 16 bootstrap before any Azure mutation.',
      'Replace the narrow canonical-schema manifest with this complete runtime-storage universe once dispositions are reviewed.',
    ],
    records,
  }
}

function writeReports(oracle: RuntimeSchemaOracle): void {
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(
    resolve(OUT_DIR, 'union-eyes-runtime-schema-authority-oracle.json'),
    JSON.stringify(oracle, null, 2),
  )

  const md: string[] = []
  md.push('# Union Eyes Runtime Schema Authority Oracle')
  md.push('')
  md.push(`Generated: ${oracle.generatedAt}`)
  md.push('')
  md.push(
    'This report treats the storage-authority registry as the runtime-storage universe and reconciles it against repository migration history. It does not mutate Azure, does not generate migrations, and does not claim the current fresh bootstrap is complete.',
  )
  md.push('')
  md.push('## Status')
  md.push('')
  md.push(`- F60040_SCHEMA: ${oracle.status.f60040Schema}`)
  md.push(
    `- PREVIOUS_RUNTIME_CONTRACT_COMPLETENESS: ${oracle.status.previousRuntimeContractCompleteness}`,
  )
  md.push(`- CANONICAL_SCHEMA_AUTHORITY_CLOSURE: ${oracle.status.canonicalSchemaAuthorityClosure}`)
  md.push(`- PRE_COMPLETE_RUNTIME_SCHEMA_DIGEST: ${oracle.status.preCompleteRuntimeSchemaDigest}`)
  md.push('')
  md.push('## Counts')
  md.push('')
  for (const [key, value] of Object.entries(oracle.counts)) {
    md.push(`- ${key}: ${value}`)
  }
  md.push('')
  md.push('## Lineages')
  md.push('')
  md.push('| lineage | owner | directory | execution mechanism | current bootstrap status |')
  md.push('|---|---|---|---|---|')
  for (const lineage of oracle.lineageMap) {
    md.push(
      `| ${lineage.lineage} | ${lineage.owner} | ${lineage.directory} | ${lineage.executionMechanism} | ${lineage.currentBootstrapStatus} |`,
    )
  }
  md.push('')
  md.push('## Critical Runtime Tables')
  md.push('')
  md.push(
    '| table | owner | creation lineage | creating migration | current bootstrap participates | readers | writers |',
  )
  md.push('|---|---|---|---|---|---|---|')
  const critical = new Set([
    'billing_periods',
    'billing_accounts',
    'billing_subscriptions',
    'platform_invoices',
    'platform_payments',
    'org_subscriptions',
    'pension_plans',
    'document_versions',
    'ai_grievance_triages',
  ])
  for (const record of oracle.records.filter((row) => critical.has(row.table))) {
    const firstMigration =
      record.djangoCreatingMigration ??
      record.sqlCreatingMigration ??
      record.otherCreatingMigration ??
      'NONE'
    const bootstrapParticipates = record.creationEvidence.some(
      (item) =>
        item.currentBootstrapStatus === 'EXECUTED_BY_FRESH_BOOTSTRAP' ||
        item.currentBootstrapStatus === 'OPTIONAL_QA_CI_BASELINE',
    )
    md.push(
      `| ${record.table} | ${record.schemaOwner} | ${record.creationLineage} | ${firstMigration} | ${bootstrapParticipates ? 'YES' : 'NO'} | ${record.activeRuntimeReaders.length} | ${record.activeRuntimeWriters.length} |`,
    )
  }
  md.push('')
  md.push('## Tables Without Creation Lineage')
  md.push('')
  for (const record of oracle.records.filter((row) => row.creationEvidence.length === 0)) {
    md.push(`- ${record.table} (${record.schemaOwner}; ${record.creationLineage})`)
  }

  writeFileSync(resolve(OUT_DIR, 'union-eyes-runtime-schema-authority-oracle.md'), md.join('\n'))
}

function main(): void {
  const oracle = buildRuntimeSchemaOracle()
  writeReports(oracle)
  console.log(`Runtime universe tables: ${oracle.counts.runtimeUniverseTables}`)
  console.log(
    `Existing creation migrations: ${oracle.counts.runtimeTablesWithExistingCreationMigration}`,
  )
  console.log(`Without creation migrations: ${oracle.counts.runtimeTablesWithoutCreationMigration}`)
  console.log(`Without schema owner: ${oracle.counts.runtimeTablesWithoutSchemaOwner}`)
  console.log(`Bootstrap missing creation tables: ${oracle.counts.bootstrapMissingCreationTables}`)
  console.log(
    `Report written to ${join('reports', 'union-eyes-runtime-schema-authority-oracle.{json,md}')}`,
  )
}

if (require.main === module) {
  main()
}

export { FROZEN_DJANGO_DIGEST }
