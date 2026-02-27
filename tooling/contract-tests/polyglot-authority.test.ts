/**
 * STACK_POLYGLOT — Polyglot Persistence Authority
 *
 * Enforces the polyglot persistence governance rules
 * (docs/architecture/POLYGLOT_PERSISTENCE.md §6):
 *
 * 1. STACK_POLYGLOT_001 — Apps must not bypass PostgreSQL for domain mutations.
 *    All domain writes MUST go to the primary store (PostgreSQL) first.
 *    Secondary stores (Redis, Elasticsearch) are read-optimized caches/indices.
 *
 * 2. STACK_POLYGLOT_002 — Redis writes MUST include a TTL.
 *    Every `set`, `hset`, `lpush` etc. MUST be paired with an expiry to prevent
 *    unbounded memory growth.
 *
 * 3. STACK_POLYGLOT_003 — Elasticsearch indices must use shared-index + orgId field
 *    for tenant isolation (filtered aliases), not index-per-tenant.
 *
 * 4. STACK_POLYGLOT_004 — Embedding writes must go through the governed
 *    `ai_embeddings` table. No ad-hoc vector columns outside the schema.
 *
 * 5. STACK_POLYGLOT_005 — Only allowed apps may depend on secondary store packages.
 *    Prevents unplanned polyglot sprawl.
 *
 * @invariant STACK_POLYGLOT_001
 * @invariant STACK_POLYGLOT_002
 * @invariant STACK_POLYGLOT_003
 * @invariant STACK_POLYGLOT_004
 * @invariant STACK_POLYGLOT_005
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  ROOT,
  walkSync,
  readContent,
  relPath,
  loadExceptions,
  isExcepted,
  formatViolations,
  type Violation,
} from './governance-helpers'

// ── Configuration ───────────────────────────────────────────────────────────

/**
 * Which secondary stores each app is allowed to use.
 * Any app not listed here has NO secondary store privileges.
 * Aligned with docs/architecture/POLYGLOT_PERSISTENCE.md §6.1.
 */
const SECONDARY_STORE_ALLOWLIST: Record<string, string[]> = {
  'union-eyes': ['redis', 'elasticsearch', 'pgvector'],
  'abr': ['redis', 'elasticsearch', 'pgvector'],
  'console': ['redis', 'timescaledb'],
  'cfo': ['redis'],
  'shop-quoter': ['redis', 'elasticsearch'],
  'partners': ['redis'],
  'orchestrator-api': ['redis'],
  'web': [],
  'nacp-exams': [],
  'zonga': [],
}

/**
 * Package name patterns that indicate a secondary store dependency.
 * Maps store name → npm package patterns (regex).
 */
const STORE_PACKAGE_PATTERNS: Record<string, RegExp[]> = {
  redis: [
    /["']ioredis["']/,
    /["']redis["']/,
    /["']@upstash\/redis["']/,
    /["']@nzila\/redis["']/,
  ],
  elasticsearch: [
    /["']@elastic\/elasticsearch["']/,
    /["']@opensearch-project\/opensearch["']/,
    /["']@nzila\/search["']/,
  ],
  timescaledb: [
    /["']timescaledb["']/,
  ],
}

/**
 * Redis write commands that MUST be paired with a TTL.
 * We look for these patterns in TS/JS source files.
 */
const REDIS_WRITE_PATTERNS = [
  /\.set\s*\(/,
  /\.hset\s*\(/,
  /\.lpush\s*\(/,
  /\.rpush\s*\(/,
  /\.sadd\s*\(/,
  /\.zadd\s*\(/,
  /\.mset\s*\(/,
]

/**
 * Patterns that indicate the Redis write includes a TTL (safe).
 * setEx, pSetEx, expire, expireAt, or EX/PX options.
 */
const REDIS_TTL_PATTERNS = [
  /\.setEx\s*\(/i,
  /\.pSetEx\s*\(/i,
  /\.setex\s*\(/i,
  /\.psetex\s*\(/i,
  /setWithTTL\s*\(/,
  /['"]EX['"]/,
  /['"]PX['"]/,
  /\.expire\s*\(/,
  /\.expireAt\s*\(/,
  /\.expireat\s*\(/,
  /ttl/i,
]

/** Directories to skip during recursive walks */
const SKIP_DIRS = new Set([
  'node_modules', '.next', '.turbo', 'dist', '__pycache__',
  '.venv', 'coverage', '.git', '__fixtures__',
])

// ── Helpers ─────────────────────────────────────────────────────────────────

function walkAppTsFiles(appName: string): string[] {
  const appDir = join(ROOT, 'apps', appName)
  if (!existsSync(appDir)) return []
  return walkSync(appDir, ['.ts', '.tsx', '.js', '.jsx', '.mjs'])
}

function readPackageJson(appName: string): Record<string, unknown> | null {
  const pkgPath = join(ROOT, 'apps', appName, 'package.json')
  if (!existsSync(pkgPath)) return null
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * Check if a line is inside a comment (single-line // or block-start).
 */
function isCommentLine(line: string): boolean {
  const trimmed = line.trimStart()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

// ── STACK_POLYGLOT_001 — No domain mutations bypassing PostgreSQL ────────

describe('STACK_POLYGLOT_001 — Apps must not bypass primary store for domain mutations', () => {
  const exceptionFile = loadExceptions('governance/exceptions/polyglot-authority.json')

  it('no app writes domain data directly to Redis without a corresponding DB write', () => {
    /**
     * Heuristic: if a file imports Redis AND performs a Redis write (set, hset, etc.)
     * but does NOT import from @nzila/db or drizzle in the same file, it may be
     * bypassing PostgreSQL. This is a best-effort static check.
     */
    const violations: Violation[] = []
    const REDIS_IMPORT = /import\s+.*from\s+['"](?:ioredis|redis|@upstash\/redis|@nzila\/redis)['"]|require\s*\(\s*['"](?:ioredis|redis|@upstash\/redis|@nzila\/redis)['"]\s*\)/
    const DB_IMPORT = /from\s+['"]@nzila\/db|from\s+['"]drizzle-orm|from\s+['"]@nzila\/commerce-db/
    /** Actual Redis write methods — variable.set(), variable.hset(), etc. */
    const REDIS_WRITE_HINT = /\bredis\s*\.\s*(?:set|hset|lpush|rpush|sadd|zadd|mset)\s*\(/i

    /**
     * Files whose sole purpose is caching, rate-limiting, CSRF tokens, or
     * session management are expected to write to Redis without a DB import.
     */
    const CACHE_ONLY_PATTERNS = [
      /cache/i, /rate-?limit/i, /csrf/i, /session/i, /throttle/i,
    ]

    const apps = Object.keys(SECONDARY_STORE_ALLOWLIST)

    for (const app of apps) {
      if (!SECONDARY_STORE_ALLOWLIST[app]?.includes('redis')) continue
      const files = walkAppTsFiles(app)

      for (const file of files) {
        const rel = relPath(file)
        if (isExcepted(rel, exceptionFile.entries)) continue
        if (rel.includes('.test.') || rel.includes('.spec.')) continue

        const content = readContent(file)
        if (!content) continue

        const hasRedisImport = REDIS_IMPORT.test(content)
        if (!hasRedisImport) continue

        const hasRedisWrite = REDIS_WRITE_HINT.test(content)
        if (!hasRedisWrite) continue

        const hasDbImport = DB_IMPORT.test(content)
        if (hasDbImport) continue

        // Skip files whose name indicates cache-only / infra purpose
        const baseName = rel.split('/').pop() ?? ''
        if (CACHE_ONLY_PATTERNS.some((p) => p.test(baseName))) continue

        // File writes to Redis but never imports the DB — suspicious
        violations.push({
          ruleId: 'STACK_POLYGLOT_001',
          filePath: rel,
          offendingValue: 'Redis write without corresponding DB import',
          remediation:
            'Domain data must be written to PostgreSQL first. Redis should only cache ' +
            'data that originates from the primary store. Add a DB import or move the ' +
            'write to a service that owns the DB transaction. If this is a legitimate ' +
            'cache-only operation (e.g. session, rate-limit counter), add to ' +
            'governance/exceptions/polyglot-authority.json',
        })
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})

// ── STACK_POLYGLOT_002 — Redis writes must have TTL ─────────────────────

describe('STACK_POLYGLOT_002 — Redis usage must have TTL', () => {
  const exceptionFile = loadExceptions('governance/exceptions/polyglot-authority.json')

  it('all Redis .set() calls use setEx, expire, or include EX/PX option', () => {
    const violations: Violation[] = []

    // Scan all TS/JS files across the repo that reference Redis
    const allFiles = walkSync(ROOT, ['.ts', '.tsx', '.js', '.jsx', '.mjs'])

    /**
     * Only match actual Redis client .set() calls — NOT Map.set(),
     * Headers.set(), Drizzle .set({...}), or other JS builtins.
     *
     * Positive: redis.set('key', ...) / client.set('key', ...)
     * Negative: recipients.set(email, ...) / headers.set('X-...', ...)
     *           / .set({ column: value })  (Drizzle ORM update)
     */
    const REDIS_SET_CALL = /\bredis\s*\.\s*set\s*\(/i

    /** Patterns indicating the .set() already includes a TTL */
    const SET_WITH_TTL = [
      /\{\s*(?:ex|px|EX|PX)\s*:/,                // options object { ex: 300 }
      /['"](?:EX|PX|ex|px)['"]\s*,/,             // positional 'EX' arg
    ]

    for (const file of allFiles) {
      const rel = relPath(file)
      if (isExcepted(rel, exceptionFile.entries)) continue
      if (rel.includes('.test.') || rel.includes('.spec.')) continue

      const content = readContent(file)
      if (!content) continue

      // Only check files that actually import a Redis client library
      const hasRedisImport = /import\s+.*from\s+['"](?:ioredis|redis|@upstash\/redis|@nzila\/redis)['"]/.test(content) ||
        /require\s*\(\s*['"](?:ioredis|redis|@upstash\/redis|@nzila\/redis)['"]/.test(content)
      if (!hasRedisImport) continue

      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        if (isCommentLine(line)) continue

        // Only flag redis.set() calls, not Map/Headers/Drizzle
        if (!REDIS_SET_CALL.test(line)) continue
        // Skip setEx/pSetEx (already safe)
        if (/\.setEx\s*\(/i.test(line) || /\.pSetEx\s*\(/i.test(line)) continue

        // Check same line and next 5 lines for TTL indicators
        const contextWindow = lines.slice(i, Math.min(i + 6, lines.length)).join('\n')
        const hasTTL = REDIS_TTL_PATTERNS.some((p) => p.test(contextWindow)) ||
          SET_WITH_TTL.some((p) => p.test(contextWindow))
        if (hasTTL) continue

        violations.push({
          ruleId: 'STACK_POLYGLOT_002',
          filePath: rel,
          line: i + 1,
          snippet: line.trim().slice(0, 120),
          offendingValue: 'Redis .set() without TTL',
          remediation:
            'Use .setEx() or .pSetEx() instead of .set(), or call .expire() immediately ' +
            'after the write. All Redis writes must include a TTL to prevent unbounded ' +
            'memory growth. See packages/redis/ setWithTTL() helper.',
        })
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('@nzila/redis package (if it exists) enforces TTL on all public write methods', () => {
    const redisIndex = join(ROOT, 'packages', 'redis', 'src', 'index.ts')
    if (!existsSync(redisIndex)) {
      // Package not yet created — skip until Phase 1 is complete
      return
    }

    const content = readContent(redisIndex)

    // The shared package should NOT export a bare `set` method
    const exportsBareSet = /export\s+(?:async\s+)?function\s+set\s*\(/.test(content)
    expect(
      exportsBareSet,
      '@nzila/redis must not export a bare set() function. Use setWithTTL() instead.',
    ).toBe(false)

    // Should export setWithTTL or equivalent
    const exportsWithTTL = /setWithTTL|setEx/.test(content)
    expect(
      exportsWithTTL,
      '@nzila/redis must export a TTL-enforcing write method (setWithTTL or setEx wrapper).',
    ).toBe(true)
  })
})

// ── STACK_POLYGLOT_003 — Elasticsearch tenant isolation ─────────────────

describe('STACK_POLYGLOT_003 — Elasticsearch indices must use shared index with orgId field', () => {
  const exceptionFile = loadExceptions('governance/exceptions/polyglot-authority.json')

  it('no Elasticsearch index name contains a dynamic orgId segment (index-per-tenant anti-pattern)', () => {
    const violations: Violation[] = []

    const allFiles = walkSync(ROOT, ['.ts', '.tsx', '.js', '.jsx', '.mjs'])

    for (const file of allFiles) {
      const rel = relPath(file)
      if (isExcepted(rel, exceptionFile.entries)) continue
      if (rel.includes('.test.') || rel.includes('.spec.')) continue

      const content = readContent(file)
      if (!content) continue

      // Only check files that reference Elasticsearch
      if (!/elasticsearch|@elastic|opensearch|@nzila\/search/i.test(content)) continue

      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        if (isCommentLine(line)) continue

        // Detect index-per-tenant patterns:
        //   index: `org-${orgId}-cases`
        //   index: `${orgId}_products`
        //   index: 'org-' + orgId
        const hasIndexPerTenant =
          /index\s*:\s*`[^`]*\$\{[^}]*(?:org|entity|tenant)[^}]*\}[^`]*`/.test(line) ||
          /index\s*:\s*['"][^'"]*['"]\s*\+\s*(?:org|entity|tenant)/i.test(line)

        if (!hasIndexPerTenant) continue

        violations.push({
          ruleId: 'STACK_POLYGLOT_003',
          filePath: rel,
          line: i + 1,
          snippet: line.trim().slice(0, 120),
          offendingValue: 'Index-per-tenant pattern detected',
          remediation:
            'Use a shared index (e.g. `nzila-cases`) with an orgId field and filtered ' +
            'aliases for tenant isolation. Index-per-tenant creates operational overhead ' +
            'at scale. See docs/architecture/POLYGLOT_PERSISTENCE.md §4.2.',
        })
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('Elasticsearch search queries include orgId filter for tenant isolation', () => {
    // This test will be meaningful once Elasticsearch is adopted.
    // For now, verify no unfiltered search calls exist.
    const violations: Violation[] = []

    const allFiles = walkSync(ROOT, ['.ts', '.tsx', '.js', '.jsx', '.mjs'])

    for (const file of allFiles) {
      const rel = relPath(file)
      if (isExcepted(rel, exceptionFile.entries)) continue
      if (rel.includes('.test.') || rel.includes('.spec.')) continue
      // Only check app-layer code, not the search package itself
      if (!rel.startsWith('apps/')) continue

      const content = readContent(file)
      if (!content) continue

      if (!/\.search\s*\(/.test(content)) continue
      if (!/elasticsearch|@elastic|@nzila\/search/i.test(content)) continue

      // If file calls .search() but never references orgId/entityId, flag it
      if (!/orgId|entityId|org_id|entity_id/i.test(content)) {
        violations.push({
          ruleId: 'STACK_POLYGLOT_003',
          filePath: rel,
          offendingValue: 'Elasticsearch .search() without orgId filter',
          remediation:
            'All Elasticsearch queries in app code must include an orgId filter ' +
            'for tenant isolation. Use the org-scoped alias or add a term filter.',
        })
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})

// ── STACK_POLYGLOT_004 — Embedding writes go through governed table ─────

describe('STACK_POLYGLOT_004 — Embedding writes must go through ai_embeddings table', () => {
  it('ai_embeddings table exists in packages/db/src/schema/ai.ts', () => {
    const schemaFile = join(ROOT, 'packages', 'db', 'src', 'schema', 'ai.ts')
    expect(existsSync(schemaFile), 'packages/db/src/schema/ai.ts must exist').toBe(true)

    const content = readContent(schemaFile)
    expect(content).toContain('ai_embeddings')
    expect(content).toContain('embedding')
    expect(content).toContain('entity_id')
    expect(content).toContain('chunk_text')
  })

  it('pgvector migration exists with HNSW index', () => {
    const migrationFile = join(ROOT, 'packages', 'db', 'migrations', 'ai-control-plane-pgvector.sql')
    expect(
      existsSync(migrationFile),
      'pgvector migration (ai-control-plane-pgvector.sql) must exist',
    ).toBe(true)

    const content = readContent(migrationFile)
    expect(content).toContain('vector')
    expect(content).toContain('hnsw')
  })

  it('no app defines ad-hoc vector/embedding columns outside the governed ai schema', () => {
    const violations: Violation[] = []
    const exceptionFile = loadExceptions('governance/exceptions/polyglot-authority.json')

    // Scan all schema files and migration files for vector columns
    const schemaFiles = walkSync(join(ROOT, 'packages', 'db', 'src', 'schema'), ['.ts'])
    const migrationFiles = walkSync(join(ROOT, 'packages', 'db', 'migrations'), ['.sql', '.ts'])
    const allFiles = [...schemaFiles, ...migrationFiles]

    for (const file of allFiles) {
      const rel = relPath(file)
      if (isExcepted(rel, exceptionFile.entries)) continue

      // Skip the governed files — these are the authoritative locations
      if (rel.includes('schema/ai.ts')) continue
      if (rel.includes('ai-control-plane-pgvector')) continue

      const content = readContent(file)
      if (!content) continue

      // Look for vector column definitions outside the governed schema
      const hasVectorCol =
        /vector\s*\(\s*['"]?embedding['"]?\s*,?\s*\{?\s*(?:dimensions|length)/i.test(content) ||
        /CREATE\s+INDEX.*USING\s+(?:hnsw|ivfflat)/i.test(content) ||
        /::vector\s*\(/i.test(content)

      if (hasVectorCol) {
        violations.push({
          ruleId: 'STACK_POLYGLOT_004',
          filePath: rel,
          offendingValue: 'Ad-hoc vector/embedding column outside governed ai schema',
          remediation:
            'All embedding storage must use the ai_embeddings table defined in ' +
            'packages/db/src/schema/ai.ts. If a new vector use case is needed, ' +
            'extend the governed schema rather than creating ad-hoc columns.',
        })
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('RAG ingestion pipeline uses the governed ai_embeddings table', () => {
    const ingestFile = join(ROOT, 'tooling', 'ai-evals', 'ingest-rag.ts')
    if (!existsSync(ingestFile)) return // Skip if RAG pipeline not yet created

    const content = readContent(ingestFile)
    expect(content).toContain('ai_embeddings')
  })
})

// ── STACK_POLYGLOT_005 — Secondary store dependency allowlist ────────────

describe('STACK_POLYGLOT_005 — Only allowed apps may depend on secondary store packages', () => {
  it('no app introduces a secondary store dependency without being in the allowlist', () => {
    const violations: Violation[] = []

    const appsDir = join(ROOT, 'apps')
    if (!existsSync(appsDir)) return

    const allApps = readdirSync(appsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)

    for (const app of allApps) {
      const pkg = readPackageJson(app)
      if (!pkg) continue

      const deps = {
        ...(pkg.dependencies as Record<string, string> ?? {}),
        ...(pkg.devDependencies as Record<string, string> ?? {}),
      }
      const depsString = JSON.stringify(deps)
      const allowed = SECONDARY_STORE_ALLOWLIST[app] ?? []

      for (const [store, patterns] of Object.entries(STORE_PACKAGE_PATTERNS)) {
        if (allowed.includes(store)) continue

        for (const pattern of patterns) {
          if (pattern.test(depsString)) {
            violations.push({
              ruleId: 'STACK_POLYGLOT_005',
              filePath: `apps/${app}/package.json`,
              offendingValue: `${store} dependency found but app "${app}" is not in allowlist`,
              remediation:
                `Add "${app}" to the ${store} allowlist in SECONDARY_STORE_ALLOWLIST ` +
                '(tooling/contract-tests/polyglot-authority.test.ts) and update ' +
                'docs/architecture/POLYGLOT_PERSISTENCE.md §6.1.',
            })
          }
        }
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('Python requirements files do not introduce disallowed store dependencies', () => {
    const violations: Violation[] = []

    const PYTHON_STORE_PATTERNS: Record<string, RegExp[]> = {
      redis: [/^redis\b/m, /^django-redis\b/m, /^celery\[redis\]/m],
      elasticsearch: [/^elasticsearch\b/m, /^django-elasticsearch-dsl\b/m],
    }

    const appsDir = join(ROOT, 'apps')
    if (!existsSync(appsDir)) return

    const allApps = readdirSync(appsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)

    for (const app of allApps) {
      const reqFiles = [
        join(ROOT, 'apps', app, 'requirements.txt'),
        join(ROOT, 'apps', app, 'backend', 'requirements.txt'),
      ]

      const allowed = SECONDARY_STORE_ALLOWLIST[app] ?? []

      for (const reqFile of reqFiles) {
        if (!existsSync(reqFile)) continue

        const content = readContent(reqFile)

        for (const [store, patterns] of Object.entries(PYTHON_STORE_PATTERNS)) {
          if (allowed.includes(store)) continue

          for (const pattern of patterns) {
            if (pattern.test(content)) {
              violations.push({
                ruleId: 'STACK_POLYGLOT_005',
                filePath: relPath(reqFile),
                offendingValue: `Python ${store} dependency found but app "${app}" is not in allowlist`,
                remediation:
                  `Add "${app}" to the ${store} allowlist in SECONDARY_STORE_ALLOWLIST ` +
                  'and update docs/architecture/POLYGLOT_PERSISTENCE.md §6.1.',
              })
            }
          }
        }
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})

// ── Exception management ────────────────────────────────────────────────

describe('STACK_POLYGLOT — Exception hygiene', () => {
  it('no expired exceptions in polyglot-authority.json', () => {
    const exceptionFile = loadExceptions('governance/exceptions/polyglot-authority.json')
    // If file doesn't exist yet, there are no expired entries
    if (!exceptionFile.ruleId) return

    expect(
      exceptionFile.expiredEntries,
      `${exceptionFile.expiredEntries.length} expired exception(s) in polyglot-authority.json`,
    ).toHaveLength(0)
  })
})
