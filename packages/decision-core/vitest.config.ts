import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'decision-core',
    globals: true,
  },
})