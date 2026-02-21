import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noShadowAi from "../../packages/ai-sdk/eslint-no-shadow-ai.mjs";
import noShadowMl from "../../packages/ml-sdk/eslint-no-shadow-ml.mjs";
import noShadowDb from "../../packages/db/eslint-no-shadow-db.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  noShadowAi,
  noShadowMl,
  noShadowDb,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
