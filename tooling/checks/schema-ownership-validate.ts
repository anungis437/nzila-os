#!/usr/bin/env tsx
/**
 * Phase 0B.2 — Schema Ownership Manifest validator.
 *
 * Enforces the invariants declared in `packages/db/schema-ownership-manifest.json`.
 *
 * Phase 0B.2 core invariants:
 *   1.  Every table entry uses one of the 8 allowed ownership enum values.
 *   2.  Every table entry uses one of the allowed ddl_owner values.
 *   3.  Every table entry uses one of the allowed target_schema values.
 *   4.  OWNERSHIP_UNRESOLVED count == 0 (closure rule).
 *   5.  No duplicate qualified table (target_schema, table) pair.
 *   6.  DJANGO_INTERNAL entries MUST NOT target `public`.
 *   7.  SHARED entries (PLATFORM_OWNED_SHARED, UNION_EYES_OWNED_SHARED) MUST declare a
 *       concrete ddl_owner (platform or union_eyes).
 *   8.  SAME_NAME_DIFFERENT_MEANING entries MUST use ddl_owner=`shared_by_name_only`
 *       and target_schema=`both`.
 *   9.  counts.total_tables_declared == tables.length.
 *  10.  counts.ownership matches actual tallies.
 *
 * Phase 0B.2R provenance invariants (added by manifest v2):
 *  11.  Every table entry declares `review_status` from `allowed_review_statuses`.
 *  12.  Every table entry declares `classification_method` from
 *       `allowed_classification_methods`.
 *  13.  Every table entry declares `evidence_sources` (may be empty ONLY when
 *       review_status is OWNERSHIP_UNRESOLVED).
 *  14.  HUMAN_REVIEWED and RULE_DERIVED_REVIEWED rows MUST declare a non-empty
 *       `reviewed_by` and `reviewed_at`.
 *  15.  Foundational rows (foundational=true) MUST NOT have review_status
 *       AUTO_CLASSIFIED_UNREVIEWED or OWNERSHIP_UNRESOLVED (HARD FAIL for GREEN).
 *  16.  Rows where the EXTRA-generator once produced empty source arrays are
 *       now required to have at least one entry across platform_sources +
 *       django_sources (unless review_status is OWNERSHIP_UNRESOLVED).
 *  17.  AUTO_CLASSIFIED_UNREVIEWED non-foundational rows MUST appear in
 *       `deferred_review_register[]`.
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

export interface ManifestTable {
	table: string;
	ownership: string;
	ddl_owner: string;
	target_schema: string;
	foundational: boolean;
	platform_sources: string[];
	django_sources: string[];
	rationale: string;
	// Phase 0B.2R provenance additions (required on v2 manifests)
	review_status?: string;
	reviewed_by?: string;
	reviewed_at?: string;
	evidence_sources?: string[];
	classification_method?: string;
	open_blocker_reason?: string;
}

export interface DeferredReviewEntry {
	table: string;
	reason: string;
	target_phase: string;
}

export interface Manifest {
	version: number;
	phase: string;
	allowed_ownership_values: string[];
	allowed_ddl_owners: string[];
	allowed_target_schemas: string[];
	allowed_review_statuses?: string[];
	allowed_classification_methods?: string[];
	closure_rules: {
		OWNERSHIP_UNRESOLVED_max: number;
		no_duplicate_qualified_table: boolean;
		django_internal_must_not_target_public: boolean;
		shared_must_declare_ddl_owner: boolean;
	};
	provenance_rules?: {
		foundational_rows_must_be_reviewed?: boolean;
		auto_classified_unreviewed_foundational_is_hard_fail?: boolean;
		extra_generator_rows_must_have_non_empty_source_arrays?: boolean;
		human_reviewed_requires_reviewer_and_date?: boolean;
	};
	counts: {
		total_tables_declared: number;
		ownership: Record<string, number>;
		foundational_slice_size: number;
		review_status?: Record<string, number>;
		deferred_review_count?: number;
	};
	foundational_slice: string[];
	deferred_review_register?: DeferredReviewEntry[];
	tables: ManifestTable[];
}

const DEFAULT_ALLOWED_REVIEW_STATUSES = [
	"HUMAN_REVIEWED",
	"RULE_DERIVED_REVIEWED",
	"AUTO_CLASSIFIED_UNREVIEWED",
	"OWNERSHIP_UNRESOLVED",
];

const DEFAULT_ALLOWED_CLASSIFICATION_METHODS = [
	"MANUAL",
	"RULE_BASED",
	"AUTOMATED_HEURISTIC",
];

export function validateManifest(manifest: Manifest): string[] {
	const errors: string[] = [];

	const allowedOwnership = new Set(manifest.allowed_ownership_values);
	const allowedDdlOwner = new Set(manifest.allowed_ddl_owners);
	const allowedTarget = new Set(manifest.allowed_target_schemas);
	const allowedReviewStatus = new Set(
		manifest.allowed_review_statuses ?? DEFAULT_ALLOWED_REVIEW_STATUSES,
	);
	const allowedClassificationMethod = new Set(
		manifest.allowed_classification_methods ?? DEFAULT_ALLOWED_CLASSIFICATION_METHODS,
	);

	const isV2 = (manifest.version ?? 1) >= 2;
	const deferredRegister = new Set(
		(manifest.deferred_review_register ?? []).map((e) => e.table),
	);

	const qualifiedSeen = new Map<string, string>();
	const ownershipTally = new Map<string, number>();
	const reviewStatusTally = new Map<string, number>();

	for (const t of manifest.tables) {
		const ctx = `table "${t.table}"`;

		if (!allowedOwnership.has(t.ownership)) {
			errors.push(`${ctx}: ownership "${t.ownership}" not in allowed set`);
		}
		if (!allowedDdlOwner.has(t.ddl_owner)) {
			errors.push(`${ctx}: ddl_owner "${t.ddl_owner}" not in allowed set`);
		}
		if (!allowedTarget.has(t.target_schema)) {
			errors.push(
				`${ctx}: target_schema "${t.target_schema}" not in allowed set`,
			);
		}

		if (t.target_schema !== "both" && t.target_schema !== "unresolved") {
			const key = `${t.target_schema}.${t.table}`;
			const prev = qualifiedSeen.get(key);
			if (prev) {
				errors.push(`${ctx}: duplicate qualified table "${key}" (also declared by "${prev}")`);
			} else {
				qualifiedSeen.set(key, t.table);
			}
		}

		if (
			manifest.closure_rules.django_internal_must_not_target_public &&
			t.ownership === "DJANGO_INTERNAL" &&
			t.target_schema === "public"
		) {
			errors.push(
				`${ctx}: DJANGO_INTERNAL entries MUST NOT target public (found target_schema=public)`,
			);
		}

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

		if (t.ownership === "PLATFORM_OWNED_EXCLUSIVE" && t.target_schema !== "public") {
			errors.push(
				`${ctx}: PLATFORM_OWNED_EXCLUSIVE requires target_schema="public" (found "${t.target_schema}")`,
			);
		}
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

		// -----------------------------------------------------------------
		// Phase 0B.2R provenance rules (only on v2 manifests)
		// -----------------------------------------------------------------
		if (isV2) {
			// (11) review_status enum
			if (!t.review_status || !allowedReviewStatus.has(t.review_status)) {
				errors.push(
					`${ctx}: review_status "${t.review_status ?? "<missing>"}" not in allowed set`,
				);
			} else {
				reviewStatusTally.set(
					t.review_status,
					(reviewStatusTally.get(t.review_status) ?? 0) + 1,
				);
			}

			// (12) classification_method enum
			if (
				!t.classification_method ||
				!allowedClassificationMethod.has(t.classification_method)
			) {
				errors.push(
					`${ctx}: classification_method "${t.classification_method ?? "<missing>"}" not in allowed set`,
				);
			}

			// (13) evidence_sources required unless OWNERSHIP_UNRESOLVED
			const evidence = t.evidence_sources ?? [];
			if (evidence.length === 0 && t.review_status !== "OWNERSHIP_UNRESOLVED") {
				errors.push(
					`${ctx}: evidence_sources[] must be non-empty for review_status="${t.review_status}"`,
				);
			}

			// (14) HUMAN_REVIEWED / RULE_DERIVED_REVIEWED require reviewer + date
			if (
				t.review_status === "HUMAN_REVIEWED" ||
				t.review_status === "RULE_DERIVED_REVIEWED"
			) {
				if (!t.reviewed_by || t.reviewed_by.trim() === "") {
					errors.push(
						`${ctx}: review_status="${t.review_status}" requires non-empty reviewed_by`,
					);
				}
				if (!t.reviewed_at || t.reviewed_at.trim() === "") {
					errors.push(
						`${ctx}: review_status="${t.review_status}" requires non-empty reviewed_at`,
					);
				}
			}

			// (15) foundational rows must not be AUTO/UNRESOLVED (HARD FAIL for GREEN)
			if (
				t.foundational &&
				(t.review_status === "AUTO_CLASSIFIED_UNREVIEWED" ||
					t.review_status === "OWNERSHIP_UNRESOLVED")
			) {
				errors.push(
					`${ctx}: foundational row has review_status="${t.review_status}" — hard fail. ` +
						`open_blocker_reason: ${t.open_blocker_reason ?? "<none>"}`,
				);
			}

			// (16) source arrays must be non-empty (fixes EXTRA-generator weakness)
			if (
				t.platform_sources.length === 0 &&
				t.django_sources.length === 0 &&
				t.review_status !== "OWNERSHIP_UNRESOLVED"
			) {
				errors.push(
					`${ctx}: platform_sources[] and django_sources[] are both empty (EXTRA-generator weakness)`,
				);
			}

			// (17) non-foundational AUTO_CLASSIFIED_UNREVIEWED rows must be in deferred register
			if (
				!t.foundational &&
				t.review_status === "AUTO_CLASSIFIED_UNREVIEWED" &&
				!deferredRegister.has(t.table)
			) {
				errors.push(
					`${ctx}: AUTO_CLASSIFIED_UNREVIEWED non-foundational row is not listed in deferred_review_register[]`,
				);
			}
		}
	}

	const unresolved = ownershipTally.get("OWNERSHIP_UNRESOLVED") ?? 0;
	if (unresolved > manifest.closure_rules.OWNERSHIP_UNRESOLVED_max) {
		errors.push(
			`OWNERSHIP_UNRESOLVED count (${unresolved}) exceeds allowed max (${manifest.closure_rules.OWNERSHIP_UNRESOLVED_max})`,
		);
	}

	if (manifest.counts.total_tables_declared !== manifest.tables.length) {
		errors.push(
			`counts.total_tables_declared=${manifest.counts.total_tables_declared} does not match tables.length=${manifest.tables.length}`,
		);
	}

	for (const [enumValue, count] of Object.entries(manifest.counts.ownership)) {
		const actual = ownershipTally.get(enumValue) ?? 0;
		if (actual !== count) {
			errors.push(
				`counts.ownership["${enumValue}"]=${count} but actual tally is ${actual}`,
			);
		}
	}
	for (const [enumValue, actual] of ownershipTally.entries()) {
		if (!(enumValue in manifest.counts.ownership)) {
			errors.push(
				`Ownership value "${enumValue}" appears ${actual}× in tables but is missing from counts.ownership`,
			);
		}
	}

	if (isV2 && manifest.counts.review_status) {
		for (const [status, count] of Object.entries(manifest.counts.review_status)) {
			const actual = reviewStatusTally.get(status) ?? 0;
			if (actual !== count) {
				errors.push(
					`counts.review_status["${status}"]=${count} but actual tally is ${actual}`,
				);
			}
		}
	}

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

	return errors;
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
	const errors = validateManifest(manifest);

	if (errors.length > 0) {
		console.error("Schema ownership manifest FAILED validation:");
		for (const e of errors) {
			console.error(`  ✗ ${e}`);
		}
		console.error(`\n${errors.length} error(s).`);
		process.exit(1);
	}

	const unresolved =
		manifest.tables.filter((t) => t.ownership === "OWNERSHIP_UNRESOLVED").length;

	console.log("Schema ownership manifest is valid.");
	console.log(`  Manifest version:           ${manifest.version}`);
	console.log(`  Tables declared:            ${manifest.tables.length}`);
	console.log(`  Foundational slice size:    ${manifest.counts.foundational_slice_size}`);
	console.log(`  OWNERSHIP_UNRESOLVED count: ${unresolved}`);
	console.log("  Ownership distribution:");
	for (const [k, v] of Object.entries(manifest.counts.ownership).sort()) {
		console.log(`    ${k.padEnd(32)} ${String(v).padStart(3)}`);
	}
	if (manifest.counts.review_status) {
		console.log("  Review status distribution:");
		for (const [k, v] of Object.entries(manifest.counts.review_status).sort()) {
			console.log(`    ${k.padEnd(32)} ${String(v).padStart(3)}`);
		}
		if (manifest.counts.deferred_review_count !== undefined) {
			console.log(`  Deferred review count:      ${manifest.counts.deferred_review_count}`);
		}
	}
}

if (require.main === module) {
	main();
}
