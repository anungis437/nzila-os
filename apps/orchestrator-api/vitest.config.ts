import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "orchestrator-api",
    // /ready and other route tests call buildApp() which dynamically loads
    // Fastify + plugins; cold module resolution on Windows + monorepo-scale
    // parallel runners can exceed the vitest defaults. 30s gives comfortable
    // headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/contract.ts',
        'src/telemetry-hooks.ts',
        'src/routes/ready.ts',
        'src/event-store/postgres.ts',
      ],
      // Strict coverage on mission-critical API infrastructure:
      // - Contract definitions (API schema validation)
      // - Telemetry hooks (observability instrumentation)
      // - Readiness check (health probe logic)
      // - Event store abstraction (data persistence)
      // Execution engine and dispatch logic tested via contract and integration tests
      thresholds: {
        statements: 99,
        branches: 99,
        functions: 99,
        lines: 99,
      },
    },
  },
});
