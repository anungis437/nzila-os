import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import noShadowAi from '../../packages/ai-sdk/eslint-no-shadow-ai.mjs'
import noShadowMl from '../../packages/ml-sdk/eslint-no-shadow-ml.mjs'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  noShadowAi,
  noShadowMl,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])

export default eslintConfig
