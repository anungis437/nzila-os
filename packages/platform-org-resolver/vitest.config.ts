import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'platform-org-resolver',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    environment: 'node',
  },
});
