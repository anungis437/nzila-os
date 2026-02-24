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
    'backend/.venv/**',
    'backend/**/migrations/**',
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
      '@typescript-eslint/no-unsafe-declaration-merging': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'react/no-unescaped-entities': 'warn',
      'no-restricted-imports': 'error', // NzilaOS: raw DB driver imports are BLOCKER (PR-UE-01)
      'prefer-const': 'warn',
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
])

export default eslintConfig
