import { defineConfig } from 'vitest/config';

// Standalone config for the Phase D/E schema-contract tooling tests.
// Deliberately isolated (no app plugins / setup) so it can run with the
// monorepo's hoisted toolchain without the app's full runtime dependencies.
export default defineConfig({
  root: __dirname,
  // Inline tsconfig so esbuild does not walk up to the app tsconfig (which
  // extends a workspace package not resolvable in this standalone context).
  esbuild: {
    tsconfigRaw: { compilerOptions: { target: 'es2022', useDefineForClassFields: false } },
  },
  test: {
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: false,
    globals: false,
  },
});
