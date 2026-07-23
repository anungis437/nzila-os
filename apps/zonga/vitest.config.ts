import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname),
    },
  },
  test: {
    name: 'zonga',
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
    // Webhook handler and payment-e2e tests dynamically import the route
    // handler inside beforeEach; cold module resolution on Windows +
    // monorepo-scale parallel runners can exceed the vitest defaults
    // (5s test / 10s hook). 30s gives comfortable headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: [
        'app/api/health/route.ts',
        'app/api/ready/route.ts',
        'app/api/version/route.ts',
      ],
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 99,
        branches: 75,
      },
    },
  },
});
