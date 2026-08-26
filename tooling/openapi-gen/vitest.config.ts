import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    // Dynamic-import barrel/route tests can exceed the 5s vitest default under
    // monorepo-scale parallel runners on Windows; 30s provides comfortable headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Fixture setup/teardown creates + rmSyncs a shared __test-gen-fixtures__ dir;
    // under monorepo-scale parallel forks on Windows this can occasionally EPERM
    // due to filesystem contention (indexer/AV holding a handle). Retry absorbs
    // the transient blip without weakening the test.
    retry: 2,
    name: "openapi-gen",
  },
});
