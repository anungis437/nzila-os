/**
 * Ordered producer graph for migrations-cache/0014 preflight targets.
 *
 * A CREATE TABLE or pgTable match is a declaration. This module records
 * whether that declaration is reached by each runner before tag 0014.
 * It does not apply SQL and does not mark a lifecycle executed.
 */
import fs from 'node:fs'
import path from 'node:path'

const INACTIVE = new Set(['LATENT_UNREACHABLE', 'SEPARATE_DATABASE_BOUNDARY', 'CONTAINED_NO_AUTHORITY'])

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__pycache__') continue
    const target = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(target, predicate, out)
    else if (predicate(target)) out.push(target)
  }
  return out
}

function extractArray(sql, name) {
  const match = sql.match(new RegExp(`${name} TEXT\\[] := ARRAY\\[([\\s\\S]*?)\\];`))
  if (!match) return []
  return [...match[1].matchAll(/'([a-z0-9_]+)'/g)].map((item) => item[1])
}

function createsTable(sql, table) {
  const pattern = new RegExp(
    `CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(?:ONLY\\s+)?(?:public\\.)?"?${table}"?(?![a-z0-9_])`,
    'i',
  )
  return pattern.test(sql)
}

function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null
  const base = path.resolve(path.dirname(fromFile), specifier)
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null
}

function barrelClosure(entryFiles) {
  const seen = new Set()
  const queue = [...entryFiles]
  while (queue.length > 0) {
    const file = queue.pop()
    if (!file || seen.has(file) || !fs.existsSync(file)) continue
    seen.add(file)
    const text = read(file)
    for (const match of text.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const resolved = resolveSpecifier(file, match[1])
      if (resolved) queue.push(resolved)
    }
  }
  return seen
}

function loadClassifications(authorityDir) {
  const map = new Map()
  for (const file of walk(authorityDir, (target) => target.endsWith('.ts'))) {
    const text = read(file)
    const pattern = /table:\s*['"]([a-z0-9_]+)['"][\s\S]{0,400}?classification:\s*['"]([A-Z0-9_]+)['"]/g
    for (const match of text.matchAll(pattern)) map.set(match[1], match[2])
  }
  return map
}

function djangoTables(backendDir) {
  const tables = new Set()
  for (const file of walk(backendDir, (target) => target.endsWith('.py') && !target.includes(`${path.sep}migrations${path.sep}`))) {
    const text = read(file)
    for (const match of text.matchAll(/db_table\s*=\s*['"]([a-z0-9_]+)['"]/g)) tables.add(match[1])
  }
  return tables
}

function journalTags(journalPath) {
  if (!fs.existsSync(journalPath)) return []
  const journal = JSON.parse(read(journalPath))
  return (journal.entries ?? []).map((entry) => entry.tag)
}

function sqlByTag(directory, tags) {
  return tags.map((tag) => {
    const file = path.join(directory, `${tag}.sql`)
    return { tag, file, sql: fs.existsSync(file) ? read(file) : '' }
  })
}

function firstCreate(entries, table) {
  return entries.find((entry) => createsTable(entry.sql, table))?.tag ?? null
}

export function buildProducerGraph(repoRoot) {
  const app = path.join(repoRoot, 'apps', 'union-eyes')
  const closureSql = read(path.join(app, 'db', 'migrations-cache', '0014_lineage_restoration_rls_closure.sql'))
  const targets = extractArray(closureSql, 'target_tables')
  const parents = extractArray(closureSql, 'parent_tables')
  const names = [...new Set([...targets, ...parents])]
  const classifications = loadClassifications(path.join(app, 'db', 'rls-storage-authority'))
  const django = djangoTables(path.join(app, 'backend'))
  const schemaFiles = [
    ...walk(path.join(app, 'db', 'schema'), (target) => target.endsWith('.ts') && !target.endsWith('.test.ts')),
    ...fs.readdirSync(path.join(app, 'db')).filter((name) => /^schema-.*\.ts$/.test(name)).map((name) => path.join(app, 'db', name)),
  ]
  const drizzleFiles = new Map()
  for (const file of schemaFiles) {
    const text = read(file)
    for (const match of text.matchAll(/pgTable\(\s*['"]([a-z0-9_]+)['"]/g)) {
      if (!drizzleFiles.has(match[1])) drizzleFiles.set(match[1], path.relative(repoRoot, file))
    }
  }
  const compilerSource = read(path.join(app, 'scripts', 'bootstrap-v2', 'source.ts'))
  const operationalEntries = [...compilerSource.matchAll(/declaration:\s*'([^']+)'/g)].map((match) =>
    path.join(repoRoot, match[1]),
  )
  const barrel = barrelClosure([path.join(app, 'db', 'schema', 'index.ts'), ...operationalEntries])
  const platformTags = journalTags(path.join(app, 'db', 'migrations-platform', 'meta', '_journal.json'))
  const scopedTags = journalTags(path.join(app, 'db', 'migrations-cache', 'meta', '_journal.json'))
  const platformSql = sqlByTag(path.join(app, 'db', 'migrations-platform'), platformTags)
  const scopedSql = sqlByTag(path.join(app, 'db', 'migrations-cache'), scopedTags)
  const scopedIndex = scopedTags.indexOf('0014_lineage_restoration_rls_closure')
  const scopedBefore = scopedSql.slice(0, scopedIndex === -1 ? 0 : scopedIndex)
  const manifestPath = path.join(repoRoot, 'reports', 'union-eyes', 'runtime-schema-lineage', 'SCHEMA_LINEAGE_MANIFEST.json')
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(read(manifestPath)) : { schemaCreationOrdered: [] }
  const historicalProducers = new Map()
  for (const step of manifest.schemaCreationOrdered ?? []) {
    const rel = step.path ?? ''
    const included = step.classification === 'SCHEMA_CREATION' || step.includeInSchemaCreationBootstrapPath
    if (!included || !rel || rel.endsWith('.py')) continue
    if (rel.includes('/migrations-platform/') || rel.includes('/migrations-audit/')) continue
    for (const created of step.tablesCreated ?? []) {
      if (!historicalProducers.has(created)) historicalProducers.set(created, rel)
    }
  }
  const planPath = path.join(repoRoot, 'docs', 'union-eyes', 'bootstrap-v2', 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json')
  const frozenPlan = fs.existsSync(planPath) ? read(planPath) : ''
  const rls = new Map()
  for (const match of closureSql.matchAll(/ue_create_direct_org_rls_policy\('([a-z0-9_]+)'\)/g)) {
    rls.set(match[1], { policy: 'ue_create_direct_org_rls_policy', parent: null })
  }
  for (const match of closureSql.matchAll(/ue_create_parent_owned_rls_policy_v2\('([a-z0-9_]+)',\s*'[^']+',\s*'([a-z0-9_]+)'/g)) {
    rls.set(match[1], { policy: 'ue_create_parent_owned_rls_policy_v2', parent: match[2] })
  }

  const rows = names.map((table) => {
    const classification = classifications.get(table) ?? 'NO_MANIFEST_ENTRY'
    const drizzleFile = drizzleFiles.get(table) ?? null
    const drizzleReachable = drizzleFile
      ? barrel.has(path.join(repoRoot, drizzleFile))
      : false
    const platformTag = firstCreate(platformSql, table)
    const scopedBeforeTag = firstCreate(scopedBefore, table)
    const historical = historicalProducers.get(table) ?? null
    const djangoOwned = django.has(table)
    const frozenPlanCreate = frozenPlan.includes(`CREATE TABLE \\"${table}\\"`) || frozenPlan.includes(`CREATE TABLE "${table}"`)
    let canonicalOwner = 'UNDECLARED'
    if (djangoOwned) canonicalOwner = 'DJANGO'
    else if (platformTag) canonicalOwner = 'PLATFORM_SQL'
    else if (drizzleFile) canonicalOwner = 'DRIZZLE_PROJECTION'
    else if (historical) canonicalOwner = 'HISTORICAL_SQL'
    const v2WouldMaterialize = djangoOwned || drizzleReachable
    const productionBefore0014 = Boolean(scopedBeforeTag)
    const cleanroomDeclaredBefore0014 = djangoOwned || Boolean(historical) || Boolean(platformTag) || Boolean(scopedBeforeTag)
    return {
      table,
      isParent: parents.includes(table),
      isTarget: targets.includes(table),
      status: INACTIVE.has(classification) ? 'inactive' : 'active',
      canonicalOwner,
      legitimateDdlSource: canonicalOwner,
      executableProducer: productionBefore0014
        ? `migrations-cache/${scopedBeforeTag}.sql`
        : platformTag
          ? `migrations-platform/${platformTag}.sql`
          : djangoOwned
            ? 'django migrate'
            : historical
              ? historical
              : drizzleReachable
                ? drizzleFile
                : null,
      migrationJournal: {
        scopedBefore0014: scopedBeforeTag,
        platform: platformTag,
        platformRunsBefore0014OnProductionBootstrap: false,
        platformRunsBefore0014OnLegacyCleanroom: Boolean(platformTag),
      },
      dependencies: rls.get(table)?.parent ? [rls.get(table).parent] : [],
      securityClassification: classification,
      requiredRlsPolicy: rls.get(table)?.policy ?? null,
      runtimeConsumers: 'storage-authority classification is the source record; this graph does not infer a new consumer',
      bootstrapV2: {
        schemaBarrelIncludesDeclaration: drizzleReachable,
        djangoModel: djangoOwned,
        wouldMaterializeOnNextCompile: v2WouldMaterialize,
        frozenPlanContainsCreateTable: frozenPlanCreate,
        frozenPlanIsEvidenceForThisCandidate: false,
      },
      declaredOrder: {
        productionDrizzleBootstrap: productionBefore0014 ? 'BEFORE_0014' : 'NOT_BEFORE_0014',
        legacyCleanroom: cleanroomDeclaredBefore0014 ? 'DECLARED_BEFORE_0014' : 'NOT_DECLARED_BEFORE_0014',
        freshBuild: djangoOwned || Boolean(scopedBeforeTag) ? 'DECLARED_BEFORE_0014' : 'NOT_DECLARED_BEFORE_0014',
        bootstrapV2Applies0014: false,
      },
      executed: 'NOT_EXECUTED',
    }
  })

  const active = rows.filter((row) => row.status === 'active' && row.isTarget)
  const v2Missing = active.filter((row) => !row.bootstrapV2.wouldMaterializeOnNextCompile).map((row) => row.table)
  const productionBlocked = active.filter((row) => row.declaredOrder.productionDrizzleBootstrap !== 'BEFORE_0014').map((row) => row.table)
  const cleanroomUndeclared = active.filter((row) => row.declaredOrder.legacyCleanroom !== 'DECLARED_BEFORE_0014').map((row) => row.table)
  return {
    mission: 'UE-CONVERGENCE-P0-FINAL',
    generatedFrom: '0014 preflight arrays, Django db_table, platform and scoped journals, frozen historical SQL, schema barrel imports, storage-authority classification, frozen V2 plan text',
    executed: 'NOT_EXECUTED',
    counts: {
      targets: targets.length,
      parents: parents.length,
      rows: rows.length,
      activeTargets: active.length,
      v2CompileWouldMiss: v2Missing.length,
      productionBootstrapNotBefore0014: productionBlocked.length,
      legacyCleanroomUndeclaredBefore0014: cleanroomUndeclared.length,
    },
    v2CompileWouldMiss: v2Missing,
    productionBootstrapNotBefore0014: productionBlocked,
    legacyCleanroomUndeclaredBefore0014: cleanroomUndeclared,
    coverage: {
      bootstrapV2Source: v2Missing.length === 0 ? 'SOURCE_DECLARATIONS_REACHABLE' : 'SOURCE_GAP',
      productionDrizzleBootstrap0014: productionBlocked.length === 0 ? 'DECLARED_COMPLETE' : 'BLOCKED',
      legacyCleanroom0014: 'DECLARED_ORDER_ONLY',
      runtimeExecution: 'NOT_EXECUTED',
    },
    rows,
  }
}
