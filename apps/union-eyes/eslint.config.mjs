import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import noShadowAi from '../../packages/ai-sdk/eslint-no-shadow-ai.mjs'
import noShadowMl from '../../packages/ml-sdk/eslint-no-shadow-ml.mjs'
import noShadowDb from '../../packages/db/eslint-no-shadow-db.mjs'
import noDirectProvider from '../../packages/config/eslint-no-direct-provider.mjs'
import cognitionArchitecture from '../../packages/organizational-cognition-core/eslint-cognition-architecture.mjs'

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
    'coverage/**',
    'services/**/dist/**',
    'next-env.d.ts',
    '*.cjs',
    'backend/.venv/**',
    'backend/**/migrations/**',
    'playwright-report/**',
    'test-results/**',
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
  // ---------------------------------------------------------------------------
  // no-explicit-any ratchet: files below have been fully cleaned of `any`.
  // `no-explicit-any` is escalated to ERROR here so they cannot regress.
  // When you finish de-anying another file, add it to this list.
  // See docs/union-eyes/any-elimination.md for the cleanup playbook.
  // ---------------------------------------------------------------------------
  {
    files: [
      'lib/services/notification-service.ts',
      'db/queries/analytics-queries.ts',
      'db/queries/deadline-queries.ts',
      'db/queries/enhanced-rbac-queries.ts',
      'lib/deadline-service.ts',
      'lib/scheduled-report-executor.ts',
      'lib/api-auth-guard.ts',
      'actions/rewards-actions.ts',
      'lib/api/signature-service-api.ts',
      'lib/utils/excel-generator.ts',
      'components/cross-union-analytics/cross-union-analytics-console.tsx',
      'lib/services/audit-trail-service.ts',
      'lib/enterprise-role-middleware.ts',
      'lib/api/index.ts',
      'components/ui/data-table-advanced.tsx',
      'lib/services/ai/vector-search-service.ts',
      'lib/tracing/utils.ts',
      'lib/database/multi-db-client.ts',
      'lib/middleware/request-validation.ts',
      'lib/console-wrapper.ts',
      'lib/services/ocr-service.ts',
      'lib/movement-insights/consent-manager.ts',
      'components/analytics/charts/types.ts',
      'components/analytics/charts/ScatterChart.tsx',
      'components/analytics/charts/BubbleChart.tsx',
      'components/analytics/charts/TreemapChart.tsx',
      'components/analytics/charts/FunnelChart.tsx',
      'components/analytics/charts/SunburstChart.tsx',
      'components/analytics/charts/BoxPlotChart.tsx',
      'components/analytics/charts/WaterfallChart.tsx',
      'components/analytics/charts/DataTable.tsx',
      'components/analytics/charts/SankeyChart.tsx',
      'components/analytics/charts/CandlestickChart.tsx',
      'lib/services/pci-compliance-service.ts',
      'lib/calendar-reminder-scheduler.ts',
      'lib/api/crud-factory.ts',
      'lib/api/standardized-responses.ts',
      'lib/workflow-engine.ts',
      'lib/ai/insights-generator.ts',
      'lib/mobile/service-worker-registration.ts',
      'actions/admin-actions.ts',
      'components/voting/vote-casting-interface.tsx',
      'components/admin/MemberEmploymentManagement.tsx',
      'components/clause-library/clause-library-console.tsx',
      'lib/services/member-service.ts',
      'lib/services/clause-service.ts',
      'lib/payment-processor/types.ts',
      'lib/db-validator.ts',
      'lib/accessibility/accessibility-service.ts',
      'lib/data-export-import.ts',
      'lib/ai/template-engine.ts',
      'lib/mobile/mobile-engine.ts',
      'components/precedents/precedents-console.tsx',
      'components/members/members-console.tsx',
      'lib/services/rewards/export-service.ts',
      'lib/services/policy-engine.ts',
      'lib/services/messaging/campaign-service.ts',
      'lib/report-executor.ts',
      'lib/organizational-narratives/index.ts',
      'lib/csrf-client.ts',
      'lib/ai/chatbot-service.ts',
      'components/members/member-onboarding-wizard.tsx',
      'components/analytics/custom-report-builder.tsx',
      'app/api/icra/report/[assessmentId]/review/route.ts',
      'lib/services/external-data/statcan-client.ts',
      'lib/services/ai/precedent-matching-service.ts',
      'lib/middleware/api-security.ts',
      'lib/email/report-email-templates.ts',
      'lib/email-service.ts',
      'lib/clc/nil-prompts.ts',
      'lib/azure-keyvault.ts',
      'lib/ai/pipeline.ts',
      'components/ui/chart.tsx',
      'components/rewards/recognition-feed.tsx',
      'components/education/quiz-builder.tsx',
      'components/communication/notification-preferences.tsx',
      'components/automation/automation-workflow-builder.tsx',
      'components/accessibility/accessibility-dashboard.tsx',
      'app/api/icra/submit/route.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
])

export default eslintConfig
