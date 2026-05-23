import { defineProject } from 'vitest/config';
export default defineProject({
  test: { name: 'oci-confidence', environment: 'node', include: ['src/**/*.test.ts'] },
});
