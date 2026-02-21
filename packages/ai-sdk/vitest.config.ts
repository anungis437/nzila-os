import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'ai-sdk',
    passWithNoTests: true,
  },
})
