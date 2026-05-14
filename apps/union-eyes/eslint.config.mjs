import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import noShadowAi from '../../packages/ai-sdk/eslint-no-shadow-ai.mjs'
import noShadowMl from '../../packages/ml-sdk/eslint-no-shadow-ml.mjs'
import noShadowDb from '../../packages/db/eslint-no-shadow-db.mjs'
import noDirectProvider from '../../packages/config/eslint-no-direct-provider.mjs'
import cognitionArchitecture from '../../packages/institutional-cognition-core/eslint-cognition-architecture.mjs'

const domainImportRestrictions = {
  'case-intelligence': ['clc', 'observability', 'pki', 'platform-economics'],
  clc: ['case-intelligence', 'observability', 'pki', 'platform-economics'],
  observability: ['case-intelligence', 'clc', 'pki', 'platform-economics'],
  pki: ['case-intelligence', 'clc', 'observability', 'platform-economics'],
  'platform-economics': ['case-intelligence', 'clc', 'observability', 'pki'],
}

const libServiceClusterRestrictions = {
  ai: ['rewards', 'external-data', 'messaging', 'cba-intelligence'],
  rewards: ['ai', 'external-data', 'messaging', 'cba-intelligence'],
  'external-data': ['ai', 'rewards', 'messaging', 'cba-intelligence'],
  messaging: ['ai', 'rewards', 'external-data', 'cba-intelligence'],
  'cba-intelligence': ['ai', 'rewards', 'external-data', 'messaging'],
}

// Re-use plugin instances already loaded by eslint-config-next so the custom
// rules block below can reference react/* , react-hooks/* and @next/next/* rules.
const nextPlugins = nextVitals[0]?.plugins ?? {}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  noShadowAi,
  noShadowMl,
  noShadowDb,
  noDirectProvider,
  cognitionArchitecture,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '*.cjs',
    'backend/.venv/**',
    'backend/**/migrations/**',
  ]),
  {
    plugins: {
      react: nextPlugins.react,
      'react-hooks': nextPlugins['react-hooks'],
      '@next/next': nextPlugins['@next/next'],
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-declaration-merging': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'react/no-unescaped-entities': 'warn',
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: 'stripe',
            message: 'Use @nzila/payments-stripe or @/lib/stripe facade instead of raw stripe SDK.',
          },
          {
            name: '@stripe/stripe-js',
            message: 'Use @/lib/stripe-elements (getStripePromise) instead of direct loadStripe.',
          },
        ],
      }],
      'prefer-const': 'warn',
      // Prevent raw console.* in production code — use lib/logger or lib/client-logger
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@next/next/no-assign-module-variable': 'warn',
      // React 19 compiler rules — downgraded until UE code is fully aligned
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  ...Object.entries(domainImportRestrictions).map(([domain, disallowedDomains]) => ({
    files: [`services/${domain}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: disallowedDomains.flatMap((disallowedDomain) => ([
          {
            group: [`@/services/${disallowedDomain}`, `@/services/${disallowedDomain}/*`],
            message: `UnionEyes ${domain} domain must not import ${disallowedDomain} directly. Use contracts, events, or API composition instead.`,
          },
        ])),
      }],
    },
  })),
  ...Object.entries(libServiceClusterRestrictions).map(([cluster, disallowedClusters]) => ({
    files: [`lib/services/${cluster}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: disallowedClusters.map((disallowedCluster) => ({
          group: [`@/lib/services/${disallowedCluster}`, `@/lib/services/${disallowedCluster}/*`],
          message: `UnionEyes lib/services/${cluster} cluster must not import lib/services/${disallowedCluster} directly. Use shared contracts or higher-level composition instead.`,
        })),
      }],
    },
  })),
  // Allow console.log in CLI scripts and test helpers — they are not production code
  {
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },
])

export default eslintConfig
