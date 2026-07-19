import { defineProject } from 'vitest/config'
import { join, relative, resolve } from 'node:path'
import type { Plugin } from 'vite'

const ROOT = join(__dirname, '..', '..')

/**
 * Vite plugin that resolves `@/` imports dynamically based on which app
 * the importing file belongs to.  e.g. a file inside `apps/union-eyes/`
 * importing `@/lib/logger` resolves to `apps/union-eyes/lib/logger`.
 */
function resolveAppAtAlias(): Plugin {
  return {
    name: 'contract-tests-resolve-at-alias',
    async resolveId(source, importer, options) {
      if (!source.startsWith('@/') || !importer) return null
      const rel = relative(ROOT, importer).replace(/\\/g, '/')
      const match = rel.match(/^(apps\/[^/]+)\//)
      if (!match) return null
      const target = resolve(ROOT, match[1], source.slice(2))
      const resolved = await this.resolve(target, importer, { ...options, skipSelf: true })
      return resolved
    },
  }
}

export default defineProject({
  plugins: [resolveAppAtAlias()],
  test: {
    name: 'contract-tests',
    environment: 'node',
    globals: false,
    // Large contract scans can exceed 30s on busy developer machines; keep this
    // high enough to avoid nondeterministic pre-push failures.
    testTimeout: 120_000,
    include: ['**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/services/financial-service/**', // Uses Jest, not vitest
    ],
  },
  resolve: {
    alias: {
      // Allow contract tests to import from the monorepo root
      '@repo-root': join(__dirname, '..', '..'),
      // Workspace packages used by scripts/slo-gate.ts
      '@nzila/platform-performance': join(__dirname, '..', '..', 'packages', 'platform-performance', 'src', 'index.ts'),
      '@nzila/platform-ops': join(__dirname, '..', '..', 'packages', 'platform-ops', 'src', 'index.ts'),
      // Governance packages used by proof harness
      '@nzila/enforcement': join(__dirname, '..', '..', 'packages', 'enforcement', 'src', 'index.ts'),
      // CUPE vocabulary package used by vocabulary validation contract tests
      '@nzila/cupe-vocabulary': join(__dirname, '..', '..', 'packages', 'cupe-vocabulary', 'src', 'index.ts'),
      // Platform contracts sub-path imports used by registry + org-scope tests
      '@nzila/platform-contracts/registry': join(__dirname, '..', '..', 'packages', 'platform-contracts', 'src', 'registry.ts'),
      '@nzila/platform-contracts/org-scope': join(__dirname, '..', '..', 'packages', 'platform-contracts', 'src', 'org-scope.ts'),
      '@nzila/platform-contracts/entitlement': join(__dirname, '..', '..', 'packages', 'platform-contracts', 'src', 'entitlement.ts'),
      '@nzila/platform-contracts': join(__dirname, '..', '..', 'packages', 'platform-contracts', 'src', 'index.ts'),
      // AI & governance packages used by e2e tests
      '@nzila/ai-control': join(__dirname, '..', '..', 'packages', 'ai-control', 'src', 'index.ts'),
      '@nzila/governance': join(__dirname, '..', '..', 'packages', 'governance', 'src', 'index.ts'),
      '@nzila/events': join(__dirname, '..', '..', 'packages', 'events', 'src', 'index.ts'),
      '@nzila/observability': join(__dirname, '..', '..', 'packages', 'observability', 'src', 'index.ts'),
      '@nzila/audit': join(__dirname, '..', '..', 'packages', 'audit', 'src', 'index.ts'),
      '@nzila/contracts': join(__dirname, '..', '..', 'packages', 'contracts', 'src', 'index.ts'),
    },
  },
})
