import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'mobility-client-portal',
    environment: 'jsdom',
  },
})
