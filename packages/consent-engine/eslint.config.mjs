import { defineConfig, globalIgnores } from 'eslint/config'

const eslintConfig = defineConfig([
  globalIgnores(['dist/**', '.turbo/**']),
])

export default eslintConfig
