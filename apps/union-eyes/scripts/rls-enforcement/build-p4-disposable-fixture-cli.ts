#!/usr/bin/env tsx
/**
 * CLI wrapper for p4-disposable-fixture.ts — builds the production-shape
 * disposable fixture against RLS_ENFORCEMENT_ADMIN_DATABASE_URL /
 * ADMIN_DATABASE_URL. Intended for disposable/local Postgres only.
 */
import postgres from "postgres";
import { buildP4DisposableFixture } from "./p4-disposable-fixture";

async function main() {
  const adminUrl = process.env.RLS_ENFORCEMENT_ADMIN_DATABASE_URL || process.env.ADMIN_DATABASE_URL;
  if (!adminUrl) {
    console.error("[build-p4-disposable-fixture] Missing RLS_ENFORCEMENT_ADMIN_DATABASE_URL / ADMIN_DATABASE_URL.");
    process.exit(1);
  }
  const sql = postgres(adminUrl, { ssl: adminUrl.includes("localhost") ? false : "require", max: 1, prepare: false });
  try {
    await buildP4DisposableFixture(sql);
    console.log("[build-p4-disposable-fixture] Fixture built.");
  } finally {
    await sql.end({ timeout: 2 });
  }
}

main().catch((err) => {
  console.error("[build-p4-disposable-fixture] Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
