#!/usr/bin/env tsx
/**
 * Phase 0B.2 — Schema Ownership Manifest validator.
 *
 * Enforces the invariants declared in `packages/db/schema-ownership-manifest.json`:
 *   1. Every table entry uses one of the 8 allowed ownership enum values.
 *   2. Every table entry uses one of the allowed ddl_owner values.
 *   3. Every table entry uses one of the allowed target_schema values.
 *   4. OWNERSHIP_UNRESOLVED count == 0 (closure rule).
 *   5. No duplicate qualified table (target_schema, table) pair.
 *   6. DJANGO_INTERNAL entries MUST NOT target `public`.
 *   7. SHARED entries (PLATFORM_OWNED_SHARED, UNION_EYES_OWNED_SHARED) MUST declare a
 *      concrete ddl_owner (platform or union_eyes) — not `unresolved` and not
 *      `shared_by_name_only`.
 *   8. SAME_NAME_DIFFERENT_MEANING entries MUST use ddl_owner=`shared_by_name_only`
 *      and target_schema=`both`.
 *   9. counts.total_tables_declared == tables.length.
 *  10. counts.ownership matches actual tallies.
 *
 * Usage:
 *   pnpm tsx tooling/checks/schema-ownership-validate.ts
 *
 * Exit codes: 0 = valid, 1 = validation failure, 2 = unable to read manifest.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..", "..");
const MANIFEST_PATH = resolve(REPO_ROOT, "packages", "db", "schema-ownership-manifest.json");

interface ManifestTable {
	table: string;
	ownership: string;
	ddl_owner: string;
	target_schema: string;
	foundational: boolean;
	platform_sources: string[];
	django_sources: string[];
	rationale: string;
}

interface Manifest {
	version: number;
	phase: string;
	allowed_ownership_values: string[];
	allowed_ddl_owners: string[];
	allowed_target_schemas: string[];
	closure_rules: {
		OWNERSHIP_UNRESOLVED_max: number;
		no_duplicate_qualified_table: boolean;
		django_internal_must_not_target_public: boolean;
		shared_must_declare_ddl_owner: boolean;
	};
	counts: {
		total_tables_declared: number;
		ownership: Record<string, number>;
		foundational_slice_size: number;
	};
	foundational_slice: string[];
	tables: ManifestTable[];
}

function loadManifest(): Manifest {
	try {
		return JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as Manifest;
	} catch (err) {
		console.error(
			`FAILED to read manifest at ${MANIFEST_PATH}: ${(err as Error).message}`,
		);
		process.exit(2);
	}
}

function main(): void {
	const manifest = loadManifest();
	const errors: string[] = [];

	const allowedOwnership = new Set(manifest.allowed_ownership_values);
	const allowedDdlOwner = new Set(manifest.allowed_ddl_owners);
	const allowedTarget = new Set(manifest.allowed_target_schemas);

	const qualifiedSeen = new Map<string, string>();
	const ownershipTally = new Map<string, number>();

	for (const t of manifest.tables) {
		const ctx = `table "${t.table}"`;

		// (1) ownership enum
		if (!allowedOwnership.has(t.ownership)) {
			errors.push(`${ctx}: ownership "${t.ownership}" not in allowed set`);
		}
		// (2) ddl_owner enum
		if (!allowedDdlOwner.has(t.ddl_owner)) {
			errors.push(`${ctx}: ddl_owner "${t.ddl_owner}" not in allowed set`);
		}
		// (3) target_schema enum
		if (!allowedTarget.has(t.target_schema)) {
			errors.push(
				`${ctx}: target_schema "${t.target_schema}" not in allowed set`,
			);
		}

		// (5) no duplicate qualified table pair (skip "both" — that's SAME_NAME_DIFFERENT_MEANING)
		if (t.target_schema !== "both" && t.target_schema !== "unresolved") {
			const key = `${t.target_schema}.${t.table}`;
			const prev = qualifiedSeen.get(key);
			if (prev) {
				errors.push(`${ctx}: duplicate qualified table "${key}" (also declared by "${prev}")`);
			} else {
				qualifiedSeen.set(key, t.table);
			}
		}

		// (6) DJANGO_INTERNAL must not target public
		if (
			manifest.closure_rules.django_internal_must_not_target_public &&
			t.ownership === "DJANGO_INTERNAL" &&
			t.target_schema === "public"
		) {
			errors.push(
				`${ctx}: DJANGO_INTERNAL entries MUST NOT target public (found target_schema=public)`,
			);
		}

		// (7) SHARED must declare a concrete DDL owner
		if (manifest.closure_rules.shared_must_declare_ddl_owner) {
			if (t.ownership === "PLATFORM_OWNED_SHARED" && t.ddl_owner !== "platform") {
				errors.push(
					`${ctx}: PLATFORM_OWNED_SHARED requires ddl_owner="platform" (found "${t.ddl_owner}")`,
				);
			}
			if (t.ownership === "UNION_EYES_OWNED_SHARED" && t.ddl_owner !== "union_eyes") {
				errors.push(
					`${ctx}: UNION_EYES_OWNED_SHARED requires ddl_owner="union_eyes" (found "${t.ddl_owner}")`,
				);
			}
		}

		// (8) SAME_NAME_DIFFERENT_MEANING invariants
		if (t.ownership === "SAME_NAME_DIFFERENT_MEANING") {
			if (t.ddl_owner !== "shared_by_name_only") {
				errors.push(
					`${ctx}: SAME_NAME_DIFFERENT_MEANING requires ddl_owner="shared_by_name_only" (found "${t.ddl_owner}")`,
				);
			}
			if (t.target_schema !== "both") {
				errors.push(
					`${ctx}: SAME_NAME_DIFFERENT_MEANING requires target_schema="both" (found "${t.target_schema}")`,
				);
			}
		}

		// PLATFORM_OWNED_EXCLUSIVE must target public
		if (t.ownership === "PLATFORM_OWNED_EXCLUSIVE" && t.target_schema !== "public") {
			errors.push(
				`${ctx}: PLATFORM_OWNED_EXCLUSIVE requires target_schema="public" (found "${t.target_schema}")`,
			);
		}
		// UNION_EYES_OWNED_* must target union_eyes
		if (
			(t.ownership === "UNION_EYES_OWNED_EXCLUSIVE" ||
				t.ownership === "UNION_EYES_OWNED_SHARED") &&
			t.target_schema !== "union_eyes"
		) {
			errors.push(
				`${ctx}: ${t.ownership} requires target_schema="union_eyes" (found "${t.target_schema}")`,
			);
		}

		ownershipTally.set(t.ownership, (ownershipTally.get(t.ownership) ?? 0) + 1);
	}

	// (4) OWNERSHIP_UNRESOLVED count
	const unresolved = ownershipTally.get("OWNERSHIP_UNRESOLVED") ?? 0;
	if (unresolved > manifest.closure_rules.OWNERSHIP_UNRESOLVED_max) {
		errors.push(
			`OWNERSHIP_UNRESOLVED count (${unresolved}) exceeds allowed max (${manifest.closure_rules.OWNERSHIP_UNRESOLVED_max})`,
		);
	}

	// (9) counts.total_tables_declared
	if (manifest.counts.total_tables_declared !== manifest.tables.length) {
		errors.push(
			`counts.total_tables_declared=${manifest.counts.total_tables_declared} does not match tables.length=${manifest.tables.length}`,
		);
	}

	// (10) counts.ownership tallies
	for (const [enumValue, count] of Object.entries(manifest.counts.ownership)) {
		const actual = ownershipTally.get(enumValue) ?? 0;
		if (actual !== count) {
			errors.push(
				`counts.ownership["${enumValue}"]=${count} but actual tally is ${actual}`,
			);
		}
	}
	// Also detect any enum value present in tables but missing from counts.ownership.
	for (const [enumValue, actual] of ownershipTally.entries()) {
		if (!(enumValue in manifest.counts.ownership)) {
			errors.push(
				`Ownership value "${enumValue}" appears ${actual}× in tables but is missing from counts.ownership`,
			);
		}
	}

	// Foundational slice consistency
	const declaredFoundational = new Set(manifest.foundational_slice);
	for (const t of manifest.tables) {
		if (t.foundational && !declaredFoundational.has(t.table)) {
			errors.push(
				`table "${t.table}" marked foundational=true but not present in foundational_slice[]`,
			);
		}
		if (!t.foundational && declaredFoundational.has(t.table)) {
			errors.push(
				`table "${t.table}" appears in foundational_slice[] but foundational=false`,
			);
		}
	}
	if (manifest.foundational_slice.length !== manifest.counts.foundational_slice_size) {
		errors.push(
			`counts.foundational_slice_size=${manifest.counts.foundational_slice_size} but foundational_slice.length=${manifest.foundational_slice.length}`,
		);
	}

	if (errors.length > 0) {
		console.error("Schema ownership manifest FAILED validation:");
		for (const e of errors) {
			console.error(`  ✗ ${e}`);
		}
		console.error(`\n${errors.length} error(s).`);
		process.exit(1);
	}

	console.log("Schema ownership manifest is valid.");
	console.log(`  Tables declared:            ${manifest.tables.length}`);
	console.log(`  Foundational slice size:    ${manifest.counts.foundational_slice_size}`);
	console.log(`  OWNERSHIP_UNRESOLVED count: ${unresolved}`);
	console.log("  Ownership distribution:");
	for (const [k, v] of Object.entries(manifest.counts.ownership).sort()) {
		console.log(`    ${k.padEnd(32)} ${String(v).padStart(3)}`);
	}
}

main();
