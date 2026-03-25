/**
 * Temporary Drizzle config for audit — points to ALL schema files.
 * Used to generate corrective migrations.
 * DELETE AFTER AUDIT.
 */
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./db/migrations-audit",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://nzila:nzila_dev@localhost:5433/nzila_automation",
  },
});
