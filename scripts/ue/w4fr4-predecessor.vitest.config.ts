import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { defineConfig, mergeConfig } from 'vitest/config'
import unionEyes from '../../apps/union-eyes/vitest.config'

assert(typeof unionEyes !== 'function' && !('then' in unionEyes), 'EXPECTED_STATIC_UE_TEST_CONFIG')
export default mergeConfig(
  unionEyes,
  defineConfig({
    test: {
      setupFiles: [fileURLToPath(new URL('./w4fr4-historical-test-setup.ts', import.meta.url))],
    },
  }),
)
