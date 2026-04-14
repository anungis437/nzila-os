import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import noShadowAi from '../../packages/ai-sdk/eslint-no-shadow-ai.mjs'
import noShadowMl from '../../packages/ml-sdk/eslint-no-shadow-ml.mjs'
import noShadowDb from '../../packages/db/eslint-no-shadow-db.mjs'
import noDirectProvider from '../../packages/config/eslint-no-direct-provider.mjs'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  noShadowAi,
  noShadowMl,
  noShadowDb,
  noDirectProvider,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.venv/**',
    'backend/.venv/**',
    'coverage/**',
  ]),
  {
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
      'react/no-unescaped-entities': 'warn',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: [`@nzila/db${'/raw'}`, `@nzila/db${'/client'}`], message: 'Use createScopedDb(entityId) from @nzila/db/scoped — no direct DB client in app code.' },
          ],
        },
      ],
      'prefer-const': 'warn',
    },
  },
])

export default eslintConfig
