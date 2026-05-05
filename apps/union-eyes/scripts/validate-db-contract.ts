/**
 * Union Eyes Database Contract Validator
 * 
 * Validates that the database has all required tables and schemas needed for
 * Union Eyes operations. This script runs AFTER migrations but BEFORE seed to
 * catch contract violations early.
 * 
 * Exit codes:
 *   0 = All contracts valid
 *   1 = Missing table(s) or other validation failure
 */

import { sql } from "drizzle-orm";
import { db } from "@/db/db";

// Required tables for Union Eyes operations
const REQUIRED_TABLES = [
  "claims",
  "claim_updates", // Restored by migration 0099
  "grievances",
  "arbitrations",
  "grievance_responses",
  "grievance_timeline",
  "settlements",
  "organizations",
  "auth_users",
  "auth_user_sessions",
  "auth_organization_users",
  "auth_org_policies",
];

// Required enums for Union Eyes operations
const REQUIRED_ENUMS = [
  "claim_status",
  "claim_priority",
  "claim_type",
  "visibility_scope",
];

interface ValidationResult {
  valid: boolean;
  missingTables: string[];
  missingEnums: string[];
  errors: string[];
}

async function validateDatabase(): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    missingTables: [],
    missingEnums: [],
    errors: [],
  };

  try {
    // Check for required tables
    console.log("\n📋 Validating required tables...");
    const tableCheckQuery = sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;

    const existingTables = await db.execute(tableCheckQuery);
    const existingTableNames = new Set(
      (existingTables as unknown as Array<{ table_name: string }>).map((t) =>
        t.table_name.toLowerCase()
      )
    );

    for (const table of REQUIRED_TABLES) {
      if (!existingTableNames.has(table.toLowerCase())) {
        console.error(`  ❌ Missing table: ${table}`);
        result.missingTables.push(table);
        result.valid = false;
      } else {
        console.log(`  ✅ Table exists: ${table}`);
      }
    }

    // Check for required enums
    console.log("\n📋 Validating required enums...");
    const enumCheckQuery = sql`
      SELECT typname 
      FROM pg_type 
      WHERE typtype = 'e' 
      AND typname IN (${REQUIRED_ENUMS.join(",")})
    `;

    const existingEnums = await db.execute(enumCheckQuery);
    const existingEnumNames = new Set(
      (existingEnums as unknown as Array<{ typname: string }>).map((e) => e.typname)
    );

    for (const enumName of REQUIRED_ENUMS) {
      if (!existingEnumNames.has(enumName)) {
        console.error(`  ❌ Missing enum: ${enumName}`);
        result.missingEnums.push(enumName);
        result.valid = false;
      } else {
        console.log(`  ✅ Enum exists: ${enumName}`);
      }
    }

    // Validate claim_updates table structure if it exists
    if (existingTableNames.has("claim_updates")) {
      console.log("\n📋 Validating claim_updates table structure...");
      const columnCheckQuery = sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'claim_updates' 
        AND table_schema = 'public'
      `;

      const columns = await db.execute(columnCheckQuery);
      const columnNames = new Set(
        (columns as unknown as Array<{ column_name: string }>).map((c) =>
          c.column_name.toLowerCase()
        )
      );

      const requiredColumns = [
        "id",
        "update_id",
        "claim_id",
        "update_type",
        "message",
        "created_by",
        "is_internal",
        "visibility_scope",
        "metadata",
        "created_at",
        "updated_at",
      ];

      let structureValid = true;
      for (const col of requiredColumns) {
        if (!columnNames.has(col.toLowerCase())) {
          console.error(`  ❌ Missing column: ${col}`);
          result.errors.push(`claim_updates missing column: ${col}`);
          structureValid = false;
          result.valid = false;
        }
      }

      if (structureValid) {
        console.log("  ✅ claim_updates structure is valid");
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Validation error: ${message}`);
    result.errors.push(message);
    result.valid = false;
  }

  return result;
}

async function main() {
  console.log("🔍 Union Eyes Database Contract Validation\n");

  const result = await validateDatabase();

  console.log("\n" + "=".repeat(60));
  if (result.valid) {
    console.log("✅ DATABASE CONTRACT VALID - All required tables and enums exist");
    process.exit(0);
  } else {
    console.log("❌ DATABASE CONTRACT VIOLATION");
    if (result.missingTables.length > 0) {
      console.log(`\nMissing tables (${result.missingTables.length}):`);
      result.missingTables.forEach((t) => console.log(`  - ${t}`));
    }
    if (result.missingEnums.length > 0) {
      console.log(`\nMissing enums (${result.missingEnums.length}):`);
      result.missingEnums.forEach((e) => console.log(`  - ${e}`));
    }
    if (result.errors.length > 0) {
      console.log(`\nOther errors (${result.errors.length}):`);
      result.errors.forEach((e) => console.log(`  - ${e}`));
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
