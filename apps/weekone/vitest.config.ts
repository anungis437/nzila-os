import { defineProject } from "vitest/config";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

export default defineProject({
  test: {
    name: "weekone",
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
      "next-auth": resolve(__dirname, "./__mocks__/next-auth.ts"),
      "@nzila/platform-auth/entra/server": resolve(
        __dirname,
        "./__mocks__/platform-auth-server.ts"
      ),
      "@nzila/os-core": resolve(ROOT, "packages/os-core/src/index.ts"),
    },
  },
});
