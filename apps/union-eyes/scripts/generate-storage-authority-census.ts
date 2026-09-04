#!/usr/bin/env tsx
/**
 * scripts/generate-storage-authority-census.ts
 *
 * PR #752 round 38: deterministic authority-EVIDENCE census over every
 * NEEDS_REVIEW entry in the storage authority manifest (340 as of this
 * round). Produces CANDIDATES only — this script NEVER rewrites the
 * manifest. Human/deep review remains required before any candidate
 * disposition is applied to a db/rls-storage-authority/*.ts domain file.
 *
 * For each NEEDS_REVIEW table this emits:
 *   - schema shape (org column, user column, parent FK, nullable/global
 *     shape, canonical declaration(s)) — via scanSchemaDeclarations()/
 *     scanAdditionalDeclarationFiles() (the same scanner used for
 *     schema-conflict analysis and the public-schema grant census, not a
 *     second independent table list);
 *   - reachability (TS production references via git grep for the
 *     Drizzle export name; raw-SQL references via
 *     scripts/lib/raw-sql-detection.ts's hasPossibleRawSqlReference; a
 *     route/action/cron/webhook hint; Django model/ViewSet reachability
 *     and whether its permission_classes is a proven unconditional
 *     deny-all);
 *   - a CANDIDATE classification, confidence, blocker, and cohort key.
 *
 * The candidate classification is ONLY ever auto-suggested as a CLOSED
 * disposition (LATENT_UNREACHABLE or CONTAINED_NO_AUTHORITY) when the
 * mechanical evidence meets the exact bar this repository's existing
 * tests already require for that disposition (see
 * db/__tests__/rls-storage-authority-manifest-raw-sql-latent.test.ts and
 * db/__tests__/rls-storage-authority-manifest-invariants.test.ts). Every
 * other NEEDS_REVIEW entry keeps that classification here — the census
 * only attaches a cohort-lane HINT (see COHORT LANES below) for a human
 * reviewer to triage by batch rather than one table at a time. This
 * script does not, and must not, invent authority: it reports what is
 * mechanically provable and defers everything else.
 *
 * COHORT LANES (informational only, does not affect candidateClassification
 * unless explicitly a DEAD or CONTAINED lane — see below):
 *   DEAD       — zero TS references, zero raw-SQL references, no Django
 *                route reachable at all -> candidateClassification
 *                LATENT_UNREACHABLE.
 *   CONTAINED  — zero TS references, zero raw-SQL references, a Django
 *                route IS reachable but its permission_classes is a
 *                provably unconditional deny-all with no legitimate
 *                consumer -> candidateClassification CONTAINED_NO_AUTHORITY.
 *   SIMPLE_TENANT — has a direct, NOT NULL organization_id column, real TS
 *                references exist, single ownership axis.
 *   PARENT_OWNED  — no direct org column, but a NOT NULL FK to a table
 *                that itself has organization_id (one hop).
 *   SYSTEM_WORKER — real TS references exist, but all supportingCapability
 *                paths match cron/webhook/worker/system path hints, none
 *                match app/api or actions.
 *   COMPLEX    — anything else (multiple ownership columns, nullable
 *                org column, no declaration found, Django route reachable
 *                without a proven deny-all, etc.).
 *
 * Usage: tsx scripts/generate-storage-authority-census.ts
 * Output: reports/union-eyes-storage-authority-census.{json,md}
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { storageAuthorityManifest } from '../db/rls-storage-authority-manifest'
import { scanSchemaDeclarations, scanAdditionalDeclarationFiles, type Declaration } from './schema-duplicate-table-scan'
import { hasPossibleRawSqlReference } from './lib/raw-sql-detection'

const APP_ROOT = resolve(__dirname, '..')
const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const OUT_DIR = resolve(REPO_ROOT, 'reports')

type CohortLane = 'DEAD' | 'CONTAINED' | 'SIMPLE_TENANT' | 'PARENT_OWNED' | 'SYSTEM_WORKER' | 'COMPLEX'
type Confidence = 'HIGH' | 'MEDIUM' | 'LOW'

interface CensusRow {
  table: string
  domainModule: string
  reviewPriority: string
  schema: {
    declarationFound: boolean
    canonicalDeclarations: string[]
    orgColumn: string | null
    orgColumnNullable: boolean | null
    userColumn: string | null
    userColumnNullable: boolean | null
    parentForeignKeys: string[]
  }
  reachability: {
    tsProductionReferences: string[]
    hasRawSqlReference: boolean
    rawSqlFiles: string[]
    routeActionCronHint: boolean
    hintPaths: string[]
    djangoModelFound: boolean
    djangoViewSetReachable: boolean
    djangoUsesUnconditionalDenyAll: boolean
    djangoDetail: string
  }
  candidate: {
    classification: string
    confidence: Confidence
    blocker: string | null
    cohortLane: CohortLane
    cohortKey: string
  }
}

function realImporterFiles(pattern: string, extensions: string[]): string[] {
  let out = ''
  try {
    // -P (Perl regex), not -E (POSIX ERE) — git grep -E does NOT support \b
    // word boundaries; it silently matches nothing rather than erroring,
    // which would make every \b-anchored symbol lookup below falsely
    // report zero references. Verified empirically: `git grep -E '\bfoo\b'`
    // exits 1 (no match) against a file containing `foo`, while
    // `git grep -P '\bfoo\b'` correctly matches.
    out = execFileSync('git', ['grep', '-l', '-P', pattern, '--', ...extensions], {
      cwd: APP_ROOT,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 32,
    })
  } catch (err: unknown) {
    const execErr = err as { status?: number; stdout?: string }
    if (execErr.status === 1) return []
    out = execErr.stdout ?? ''
  }
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !file.includes('__tests__') && !file.includes('.test.') && !file.includes('.spec.') && !file.includes('.stories.'))
    .filter((file) => !file.startsWith('db/schema/') && !file.startsWith('db/rls-storage-authority') && !file.startsWith('db/migrations'))
}

function isProductionHint(filePath: string): boolean {
  return /^(app\/api\/|actions\/)/.test(filePath)
}

function isSystemHint(filePath: string): boolean {
  return /cron|webhook|worker|system|scheduled/i.test(filePath)
}

/** Best-effort snake_case -> Django PascalCase model-name guess (matches this codebase's observed convention: social_accounts -> SocialAccounts). */
function toPascalCase(tableName: string): string {
  return tableName
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function findDjangoModel(pascalName: string): { modelFile: string; viewSetFile: string | null; usesDenyAll: boolean; usesIsAuthenticatedOnly: boolean; routerRegistered: boolean } | null {
  const modelFiles = realImporterFiles(`^class ${pascalName}\\(`, ['*.py'])
  const modelDefiningFiles = modelFiles.filter((f) => f.endsWith('models.py'))
  if (modelDefiningFiles.length === 0) return null

  const viewSetName = `${pascalName}ViewSet`
  const viewSetFiles = realImporterFiles(`class ${viewSetName}\\(`, ['*.py']).filter((f) => f.endsWith('views.py'))
  const routerFiles = realImporterFiles(`register\\([^)]*${viewSetName}`, ['*.py']).filter((f) => f.endsWith('urls.py'))

  let usesDenyAll = false
  let usesIsAuthenticatedOnly = false
  if (viewSetFiles.length > 0) {
    const src = readFileSync(resolve(APP_ROOT, viewSetFiles[0]), 'utf8')
    const classStart = src.indexOf(`class ${viewSetName}(`)
    const nextClassStart = src.indexOf('\nclass ', classStart + 1)
    const classBlock = src.slice(classStart, nextClassStart === -1 ? undefined : nextClassStart)
    const permMatch = classBlock.match(/permission_classes\s*=\s*\[([^\]]*)\]/)
    const permValue = permMatch?.[1] ?? ''
    usesDenyAll = /DenyAllPermission/.test(permValue)
    usesIsAuthenticatedOnly = /^\s*permissions\.IsAuthenticated\s*$/.test(permValue.trim())
  }

  return {
    modelFile: modelDefiningFiles[0],
    viewSetFile: viewSetFiles[0] ?? null,
    usesDenyAll,
    usesIsAuthenticatedOnly,
    routerRegistered: routerFiles.length > 0,
  }
}

function domainModuleOf(entryReason: string, table: string): string {
  // Best-effort: the domain module isn't stored on the entry itself (the
  // manifest is composed from domain-partitioned files, but each
  // StorageAuthorityEntry doesn't carry its own source module name back).
  // Left as 'unassigned' when not determinable from context; a human
  // triaging a cohort already knows which domain file they opened.
  void entryReason
  void table
  return 'unassigned'
}

function main() {
  const declarations = scanSchemaDeclarations()
  const additional = scanAdditionalDeclarationFiles([
    resolve(APP_ROOT, 'db/schema-organizations.ts'),
    resolve(APP_ROOT, 'db/schema-applications.ts'),
    resolve(APP_ROOT, 'db/data/communication.ts'),
  ])
  for (const [key, decls] of additional) {
    declarations.set(key, [...(declarations.get(key) ?? []), ...decls])
  }

  const needsReview = storageAuthorityManifest.filter((e) => e.classification === 'NEEDS_REVIEW')
  const rows: CensusRow[] = []
  const cohortCounts = new Map<string, number>()

  for (const entry of needsReview) {
    const key = `public.${entry.table}`
    const decls: Declaration[] = declarations.get(key) ?? []
    const primary = decls[0]

    let orgColumn: string | null = null
    let orgColumnNullable: boolean | null = null
    let userColumn: string | null = null
    let userColumnNullable: boolean | null = null
    const parentForeignKeys: string[] = []

    if (primary) {
      for (const col of primary.columns) {
        const isOrgRef = col.referencesTarget?.startsWith('organizations.') || /^organization_id$/.test(col.name)
        const isUserRef = col.referencesTarget?.startsWith('users.') || /^user_id$/.test(col.name)
        if (isOrgRef && !orgColumn) {
          orgColumn = col.name
          orgColumnNullable = !col.notNull
        } else if (isUserRef && !userColumn) {
          userColumn = col.name
          userColumnNullable = !col.notNull
        } else if (col.referencesTarget) {
          parentForeignKeys.push(`${col.name} -> ${col.referencesTarget}`)
        }
      }
    }

    const tsRefs = primary ? realImporterFiles(`\\b${primary.exportName}\\b`, ['*.ts', '*.tsx']) : []
    const rawSqlCandidateFiles = realImporterFiles(entry.table, ['*.ts', '*.tsx'])
    const rawSqlFiles = rawSqlCandidateFiles.filter((f) => {
      try {
        return hasPossibleRawSqlReference(entry.table, readFileSync(resolve(APP_ROOT, f), 'utf8'))
      } catch {
        return false
      }
    })

    const hintPaths = [...tsRefs, ...entry.supportingCapability].filter((f, i, arr) => arr.indexOf(f) === i)
    const routeActionCronHint = hintPaths.some(isProductionHint)

    const pascalName = toPascalCase(entry.table)
    const django = findDjangoModel(pascalName)

    const djangoModelFound = django !== null
    const djangoViewSetReachable = django?.routerRegistered ?? false
    const djangoUsesUnconditionalDenyAll = django?.usesDenyAll ?? false
    const djangoDetail = django
      ? `model=${django.modelFile}${django.viewSetFile ? `, viewset=${django.viewSetFile}` : ''}${django.routerRegistered ? ', router-registered' : ', not router-registered'}${django.usesDenyAll ? ', DenyAll' : django.usesIsAuthenticatedOnly ? ', IsAuthenticated-only' : ''}`
      : 'no Django model found'

    const isDead = tsRefs.length === 0 && rawSqlFiles.length === 0 && !djangoViewSetReachable
    const isContained = tsRefs.length === 0 && rawSqlFiles.length === 0 && djangoViewSetReachable && djangoUsesUnconditionalDenyAll

    let candidateClassification = 'NEEDS_REVIEW'
    let confidence: Confidence = 'LOW'
    let blocker: string | null = null
    let cohortLane: CohortLane = 'COMPLEX'

    if (isDead) {
      candidateClassification = 'LATENT_UNREACHABLE'
      confidence = 'HIGH'
      cohortLane = 'DEAD'
    } else if (isContained) {
      candidateClassification = 'CONTAINED_NO_AUTHORITY'
      confidence = 'HIGH'
      cohortLane = 'CONTAINED'
    } else if (tsRefs.length === 0 && rawSqlFiles.length === 0 && djangoViewSetReachable && !djangoUsesUnconditionalDenyAll) {
      blocker = 'Django route reachable without a proven unconditional deny-all — needs isolation proof or containment, not auto-closable'
      cohortLane = 'COMPLEX'
      confidence = 'MEDIUM'
    } else if (tsRefs.length > 0 && orgColumn && orgColumnNullable === false && !userColumn && parentForeignKeys.length === 0) {
      blocker = 'has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable'
      cohortLane = 'SIMPLE_TENANT'
      confidence = 'MEDIUM'
    } else if (tsRefs.length > 0 && !orgColumn && parentForeignKeys.length > 0) {
      blocker = 'has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable'
      cohortLane = 'PARENT_OWNED'
      confidence = 'LOW'
    } else if (tsRefs.length > 0 && hintPaths.length > 0 && !routeActionCronHint && hintPaths.some(isSystemHint)) {
      blocker = 'has real TS references, hints suggest system/worker-only invocation — requires confirming no tenant-facing path exists, not auto-closable'
      cohortLane = 'SYSTEM_WORKER'
      confidence = 'LOW'
    } else {
      blocker = primary ? 'ambiguous shape — needs manual review' : 'no canonical schema declaration found for this table name'
      cohortLane = 'COMPLEX'
      confidence = 'LOW'
    }

    const cohortKey = `${cohortLane}:${orgColumn ? 'org' : userColumn ? 'user' : parentForeignKeys.length > 0 ? 'parent' : 'none'}:${entry.reviewPriority}`
    cohortCounts.set(cohortKey, (cohortCounts.get(cohortKey) ?? 0) + 1)

    rows.push({
      table: entry.table,
      domainModule: domainModuleOf(entry.reason, entry.table),
      reviewPriority: entry.reviewPriority,
      schema: {
        declarationFound: !!primary,
        canonicalDeclarations: decls.map((d) => `${d.modulePath}.${d.exportName}`),
        orgColumn,
        orgColumnNullable,
        userColumn,
        userColumnNullable,
        parentForeignKeys,
      },
      reachability: {
        tsProductionReferences: tsRefs,
        hasRawSqlReference: rawSqlFiles.length > 0,
        rawSqlFiles,
        routeActionCronHint,
        hintPaths,
        djangoModelFound,
        djangoViewSetReachable,
        djangoUsesUnconditionalDenyAll,
        djangoDetail,
      },
      candidate: {
        classification: candidateClassification,
        confidence,
        blocker,
        cohortLane,
        cohortKey,
      },
    })
  }

  mkdirSync(OUT_DIR, { recursive: true })

  const summary = {
    generatedAt: new Date().toISOString(),
    totalNeedsReview: needsReview.length,
    candidateCounts: {
      LATENT_UNREACHABLE: rows.filter((r) => r.candidate.classification === 'LATENT_UNREACHABLE').length,
      CONTAINED_NO_AUTHORITY: rows.filter((r) => r.candidate.classification === 'CONTAINED_NO_AUTHORITY').length,
      NEEDS_REVIEW: rows.filter((r) => r.candidate.classification === 'NEEDS_REVIEW').length,
    },
    cohortCounts: Object.fromEntries(cohortCounts),
    rows,
  }

  writeFileSync(resolve(OUT_DIR, 'union-eyes-storage-authority-census.json'), JSON.stringify(summary, null, 2))

  const md: string[] = []
  md.push('# Union Eyes Storage Authority Census (round 38)')
  md.push('')
  md.push(`Generated: ${summary.generatedAt}`)
  md.push('')
  md.push('CANDIDATES ONLY — this report never rewrites the manifest. Every disposition below must be')
  md.push('independently reviewed and applied by hand to the relevant db/rls-storage-authority/*.ts domain file.')
  md.push('')
  md.push(`Total NEEDS_REVIEW entries scanned: ${summary.totalNeedsReview}`)
  md.push('')
  md.push('## Candidate classification counts')
  md.push('')
  md.push(`- LATENT_UNREACHABLE (Lane A — Dead, high confidence): ${summary.candidateCounts.LATENT_UNREACHABLE}`)
  md.push(`- CONTAINED_NO_AUTHORITY (Lane B — Contained, high confidence): ${summary.candidateCounts.CONTAINED_NO_AUTHORITY}`)
  md.push(`- Still NEEDS_REVIEW (requires deep review): ${summary.candidateCounts.NEEDS_REVIEW}`)
  md.push('')
  md.push('## Cohort counts')
  md.push('')
  for (const [cohort, count] of [...cohortCounts.entries()].sort((a, b) => b[1] - a[1])) {
    md.push(`- ${cohort}: ${count}`)
  }
  md.push('')
  md.push('## High-confidence candidates (Lane A + Lane B)')
  md.push('')
  md.push('| table | candidate | confidence | evidence |')
  md.push('|---|---|---|---|')
  for (const row of rows) {
    if (row.candidate.classification === 'NEEDS_REVIEW') continue
    const evidence = row.candidate.classification === 'CONTAINED_NO_AUTHORITY' ? row.reachability.djangoDetail : 'zero TS refs, zero raw-SQL refs, no Django route'
    md.push(`| ${row.table} | ${row.candidate.classification} | ${row.candidate.confidence} | ${evidence} |`)
  }
  md.push('')
  md.push('## Remaining NEEDS_REVIEW, grouped by cohort lane (for batched deep review)')
  md.push('')
  for (const lane of ['SIMPLE_TENANT', 'PARENT_OWNED', 'SYSTEM_WORKER', 'COMPLEX'] as CohortLane[]) {
    const laneRows = rows.filter((r) => r.candidate.cohortLane === lane && r.candidate.classification === 'NEEDS_REVIEW')
    if (laneRows.length === 0) continue
    md.push(`### ${lane} (${laneRows.length})`)
    md.push('')
    md.push('| table | blocker |')
    md.push('|---|---|')
    for (const row of laneRows) {
      md.push(`| ${row.table} | ${row.candidate.blocker} |`)
    }
    md.push('')
  }

  writeFileSync(resolve(OUT_DIR, 'union-eyes-storage-authority-census.md'), md.join('\n'))

  console.log(`Total NEEDS_REVIEW scanned: ${summary.totalNeedsReview}`)
  console.log(`Candidate LATENT_UNREACHABLE: ${summary.candidateCounts.LATENT_UNREACHABLE}`)
  console.log(`Candidate CONTAINED_NO_AUTHORITY: ${summary.candidateCounts.CONTAINED_NO_AUTHORITY}`)
  console.log(`Still NEEDS_REVIEW: ${summary.candidateCounts.NEEDS_REVIEW}`)
  console.log(`Report written to reports/union-eyes-storage-authority-census.{json,md}`)
}

if (require.main === module) {
  main()
}

export { toPascalCase, findDjangoModel, realImporterFiles }
