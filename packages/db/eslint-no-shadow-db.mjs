/**
 * ESLint — No Shadow DB Rule
 *
 * Prevents direct imports of the raw Drizzle client or direct `drizzle()`
 * instantiation in application code (apps/*).
 *
 * All database access in apps MUST go through `createScopedDb(entityId)`
 * from `@nzila/db/scoped`.
 *
 * Allowed consumers of rawDb:
 *   - @nzila/os-core (platform layer)
 *   - @nzila/db (self)
 *   - tooling/* (migrations, scripts)
 *   - packages/* (platform packages)
 *
 * Usage in your eslint.config.mjs:
 *
 *   import noShadowDb from '@nzila/db/eslint-no-shadow-db'
 *   export default [
 *     ...otherConfigs,
 *     noShadowDb,
 *   ]
 *
 * @module @nzila/db/eslint-no-shadow-db
 */

/** @type {import('eslint').Linter.FlatConfig} */
const noShadowDbConfig = {
  name: 'nzila/no-shadow-db',
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@nzila/db/raw'],
            message:
              'Raw DB access is forbidden in app code. Use createScopedDb(entityId) from @nzila/db/scoped. ' +
              'See docs/architecture/ENTITY_ISOLATION.md.',
          },
          {
            group: ['drizzle-orm/postgres-js', 'drizzle-orm/node-postgres', 'drizzle-orm/neon-http'],
            message:
              'Direct drizzle() instantiation is forbidden in app code. ' +
              'Use createScopedDb(entityId) from @nzila/db/scoped. ' +
              'See docs/architecture/ENTITY_ISOLATION.md.',
          },
          {
            group: ['postgres', 'pg', '@neondatabase/serverless'],
            message:
              'Direct database driver imports are forbidden in app code. ' +
              'Use createScopedDb(entityId) from @nzila/db/scoped. ' +
              'See docs/architecture/ENTITY_ISOLATION.md.',
          },
        ],
      },
    ],
  },
}

export default noShadowDbConfig
