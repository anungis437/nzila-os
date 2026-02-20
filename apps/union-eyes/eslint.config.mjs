import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import noShadowMl from '@nzila/ml-sdk/eslint-no-shadow-ml'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  noShadowMl,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])

export default eslintConfig
