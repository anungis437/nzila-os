import { defineProject } from "vitest/config";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

export default defineProject({
  test: {
    name: "weekone",
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts", "app/**/*.test.ts"],
    coverage: {
      provider: 'v8',
      include: [
        'lib/db.ts',
        'app/api/onboarding/activation/route.ts',
        'app/api/priorities/route.ts',
      ],
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
      thresholds: {
        lines: 99,
        functions: 99,
        branches: 99,
        statements: 99,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
      "next-auth": resolve(__dirname, "./__mocks__/next-auth.ts"),
      "@nzila/platform-auth/entra/server": resolve(
        __dirname,
        "./__mocks__/platform-auth-server.ts"
      ),
      "@nzila/os-core/telemetry": resolve(
        ROOT,
        "packages/os-core/src/telemetry/index.ts"
      ),
      "@nzila/os-core": resolve(ROOT, "packages/os-core/src/index.ts"),
    },
  },
} as unknown as Parameters<typeof defineProject>[0]);
