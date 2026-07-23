/**
 * Phase 0B.2R §3 — Validator provenance rules tests.
 *
 * Verifies rules 11–17 added to schema-ownership-validate.ts.
 * Also verifies rules 1–10 still hold when the base manifest is v1.
 */

import { describe, expect, it } from "vitest";
import { validateManifest, type Manifest } from "./schema-ownership-validate";

const BASE_V2_MANIFEST: Manifest = {
	version: 2,
	phase: "0B.2R-test",
	allowed_ownership_values: [
		"PLATFORM_OWNED_SHARED",
		"PLATFORM_OWNED_EXCLUSIVE",
		"UNION_EYES_OWNED_SHARED",
		"UNION_EYES_OWNED_EXCLUSIVE",
		"DJANGO_INTERNAL",
		"LEGACY_DEPRECATE",
		"SAME_NAME_DIFFERENT_MEANING",
		"OWNERSHIP_UNRESOLVED",
	],
	allowed_ddl_owners: [
		"platform",
		"union_eyes",
		"django_framework",
		"shared_by_name_only",
		"unresolved",
	],
	allowed_target_schemas: ["public", "union_eyes", "both", "unresolved"],
	allowed_review_statuses: [
		"HUMAN_REVIEWED",
		"RULE_DERIVED_REVIEWED",
		"AUTO_CLASSIFIED_UNREVIEWED",
		"OWNERSHIP_UNRESOLVED",
	],
	allowed_classification_methods: ["MANUAL", "RULE_BASED", "AUTOMATED_HEURISTIC"],
	closure_rules: {
		OWNERSHIP_UNRESOLVED_max: 0,
		no_duplicate_qualified_table: true,
		django_internal_must_not_target_public: true,
		shared_must_declare_ddl_owner: true,
	},
	provenance_rules: {
		foundational_rows_must_be_reviewed: true,
		auto_classified_unreviewed_foundational_is_hard_fail: true,
		extra_generator_rows_must_have_non_empty_source_arrays: true,
		human_reviewed_requires_reviewer_and_date: true,
	},
	counts: {
		total_tables_declared: 1,
		ownership: { PLATFORM_OWNED_EXCLUSIVE: 1 },
		foundational_slice_size: 0,
		review_status: { RULE_DERIVED_REVIEWED: 1 },
		deferred_review_count: 0,
	},
	foundational_slice: [],
	deferred_review_register: [],
	tables: [
		{
			table: "orgs",
			ownership: "PLATFORM_OWNED_EXCLUSIVE",
			ddl_owner: "platform",
			target_schema: "public",
			foundational: false,
			platform_sources: ["packages/db/src/schema/orgs.ts"],
			django_sources: [],
			rationale: "test row",
			review_status: "RULE_DERIVED_REVIEWED",
			reviewed_by: "Aubert Nungisa",
			reviewed_at: "2026-07-23",
			evidence_sources: ["packages/db/src/schema/orgs.ts"],
			classification_method: "RULE_BASED",
		},
	],
};

function clone<T>(x: T): T {
	return JSON.parse(JSON.stringify(x)) as T;
}

describe("validateManifest — baseline", () => {
	it("accepts a valid minimal v2 manifest", () => {
		const errors = validateManifest(BASE_V2_MANIFEST);
		expect(errors).toEqual([]);
	});
});

describe("Rule 11 — review_status enum", () => {
	it("rejects missing review_status on v2", () => {
		const m = clone(BASE_V2_MANIFEST);
		delete m.tables[0].review_status;
		const errors = validateManifest(m);
		expect(errors.some((e) => e.includes("review_status"))).toBe(true);
	});

	it("rejects invalid review_status enum", () => {
		const m = clone(BASE_V2_MANIFEST);
		m.tables[0].review_status = "MAYBE_MAYBE_NOT";
		const errors = validateManifest(m);
		expect(errors.some((e) => e.includes('review_status "MAYBE_MAYBE_NOT"'))).toBe(true);
	});
});

describe("Rule 12 — classification_method enum", () => {
	it("rejects missing classification_method on v2", () => {
		const m = clone(BASE_V2_MANIFEST);
		delete m.tables[0].classification_method;
		const errors = validateManifest(m);
		expect(errors.some((e) => e.includes("classification_method"))).toBe(true);
	});

	it("rejects invalid classification_method enum", () => {
		const m = clone(BASE_V2_MANIFEST);
		m.tables[0].classification_method = "GUESS";
		const errors = validateManifest(m);
		expect(errors.some((e) => e.includes('classification_method "GUESS"'))).toBe(true);
	});
});

describe("Rule 13 — evidence_sources required except OWNERSHIP_UNRESOLVED", () => {
	it("rejects empty evidence_sources for RULE_DERIVED_REVIEWED", () => {
		const m = clone(BASE_V2_MANIFEST);
		m.tables[0].evidence_sources = [];
		const errors = validateManifest(m);
		expect(errors.some((e) => e.includes("evidence_sources[] must be non-empty"))).toBe(true);
	});

	it("allows empty evidence_sources when review_status=OWNERSHIP_UNRESOLVED", () => {
		const m = clone(BASE_V2_MANIFEST);
		m.tables[0].review_status = "OWNERSHIP_UNRESOLVED";
		m.tables[0].ownership = "OWNERSHIP_UNRESOLVED";
		m.tables[0].ddl_owner = "unresolved";
		m.tables[0].target_schema = "unresolved";
		m.tables[0].evidence_sources = [];
		m.counts.ownership = { OWNERSHIP_UNRESOLVED: 1 };
		if (m.counts.review_status) m.counts.review_status = { OWNERSHIP_UNRESOLVED: 1 };
		const errors = validateManifest(m);
		// OWNERSHIP_UNRESOLVED > 0 still triggers rule 4, but rule 13 does NOT fire.
		expect(errors.some((e) => e.includes("evidence_sources[]"))).toBe(false);
	});
});

describe("Rule 14 — HUMAN_REVIEWED/RULE_DERIVED_REVIEWED require reviewer + date", () => {
	it("rejects empty reviewed_by for HUMAN_REVIEWED", () => {
		const m = clone(BASE_V2_MANIFEST);
		m.tables[0].review_status = "HUMAN_REVIEWED";
		m.tables[0].reviewed_by = "";
		if (m.counts.review_status) m.counts.review_status = { HUMAN_REVIEWED: 1 };
		const errors = validateManifest(m);
		expect(errors.some((e) => e.includes("requires non-empty reviewed_by"))).toBe(true);
	});

	it("rejects empty reviewed_at for RULE_DERIVED_REVIEWED", () => {
		const m = clone(BASE_V2_MANIFEST);
		m.tables[0].reviewed_at = "";
		const errors = validateManifest(m);
		expect(errors.some((e) => e.includes("requires non-empty reviewed_at"))).toBe(true);
	});

	it("does not require reviewer for AUTO_CLASSIFIED_UNREVIEWED (non-foundational)", () => {
		const m = clone(BASE_V2_MANIFEST);
		m.tables[0].ownership = "UNION_EYES_OWNED_EXCLUSIVE";
		m.tables[0].ddl_owner = "union_eyes";
		m.tables[0].target_schema = "union_eyes";
		m.tables[0].review_status = "AUTO_CLASSIFIED_UNREVIEWED";
		m.tables[0].reviewed_by = "";
		m.tables[0].reviewed_at = "";
		m.tables[0].classification_method = "AUTOMATED_HEURISTIC";
		m.tables[0].django_sources = ["ai_core/0001_initial.py"];
		m.tables[0].platform_sources = [];
		m.counts.ownership = { UNION_EYES_OWNED_EXCLUSIVE: 1 };
		if (m.counts.review_status) m.counts.review_status = { AUTO_CLASSIFIED_UNREVIEWED: 1 };
		m.deferred_review_register = [
			{ table: "orgs", reason: "test", target_phase: "Wave 1" },
		];
		if (m.counts.deferred_review_count !== undefined) m.counts.deferred_review_count = 1;
		const errors = validateManifest(m);
		expect(errors.some((e) => e.includes("requires non-empty reviewed_by"))).toBe(false);
	});
});

describe("Rule 15 — foundational rows must not be AUTO/UNRESOLVED", () => {
	it("hard-fails when a foundational row is AUTO_CLASSIFIED_UNREVIEWED", () => {
		const m = clone(BASE_V2_MANIFEST);
		m.tables[0].foundational = true;
		m.tables[0].review_status = "AUTO_CLASSIFIED_UNREVIEWED";
		m.foundational_slice = ["orgs"];
		m.counts.foundational_slice_size = 1;
		if (m.counts.review_status) m.counts.review_status = { AUTO_CLASSIFIED_UNREVIEWED: 1 };
		const errors = validateManifest(m);
		expect(errors.some((e) => e.includes("foundational row has review_status"))).toBe(true);
	});

	it("passes when a foundational row is HUMAN_REVIEWED", () => {
		const m = clone(BASE_V2_MANIFEST);
		m.tables[0].foundational = true;
		m.tables[0].review_status = "HUMAN_REVIEWED";
		m.tables[0].classification_method = "MANUAL";
		m.foundational_slice = ["orgs"];
		m.counts.foundational_slice_size = 1;
		if (m.counts.review_status) m.counts.review_status = { HUMAN_REVIEWED: 1 };
		const errors = validateManifest(m);
		expect(errors.filter((e) => e.includes("foundational row has review_status"))).toEqual([]);
	});
});

describe("Rule 16 — source arrays must be non-empty (EXTRA-generator weakness)", () => {
	it("rejects a row with both source arrays empty", () => {
		const m = clone(BASE_V2_MANIFEST);
		m.tables[0].platform_sources = [];
		m.tables[0].django_sources = [];
		const errors = validateManifest(m);
		expect(errors.some((e) => e.includes("EXTRA-generator weakness"))).toBe(true);
	});

	it("allows both source arrays empty when review_status=OWNERSHIP_UNRESOLVED", () => {
		const m = clone(BASE_V2_MANIFEST);
		m.tables[0].ownership = "OWNERSHIP_UNRESOLVED";
		m.tables[0].ddl_owner = "unresolved";
		m.tables[0].target_schema = "unresolved";
		m.tables[0].review_status = "OWNERSHIP_UNRESOLVED";
		m.tables[0].platform_sources = [];
		m.tables[0].django_sources = [];
		m.tables[0].evidence_sources = [];
		m.counts.ownership = { OWNERSHIP_UNRESOLVED: 1 };
		if (m.counts.review_status) m.counts.review_status = { OWNERSHIP_UNRESOLVED: 1 };
		const errors = validateManifest(m);
		expect(errors.some((e) => e.includes("EXTRA-generator weakness"))).toBe(false);
	});
});

describe("Rule 17 — AUTO_CLASSIFIED_UNREVIEWED non-foundational must be in deferred_review_register", () => {
	it("rejects an AUTO_CLASSIFIED_UNREVIEWED non-foundational row missing from register", () => {
		const m = clone(BASE_V2_MANIFEST);
		m.tables[0].ownership = "UNION_EYES_OWNED_EXCLUSIVE";
		m.tables[0].ddl_owner = "union_eyes";
		m.tables[0].target_schema = "union_eyes";
		m.tables[0].review_status = "AUTO_CLASSIFIED_UNREVIEWED";
		m.tables[0].classification_method = "AUTOMATED_HEURISTIC";
		m.tables[0].reviewed_by = "";
		m.tables[0].reviewed_at = "";
		m.tables[0].platform_sources = [];
		m.tables[0].django_sources = ["ai_core/0001_initial.py"];
		m.counts.ownership = { UNION_EYES_OWNED_EXCLUSIVE: 1 };
		if (m.counts.review_status) m.counts.review_status = { AUTO_CLASSIFIED_UNREVIEWED: 1 };
		m.deferred_review_register = [];
		if (m.counts.deferred_review_count !== undefined) m.counts.deferred_review_count = 0;
		const errors = validateManifest(m);
		expect(
			errors.some((e) =>
				e.includes("AUTO_CLASSIFIED_UNREVIEWED non-foundational row is not listed"),
			),
		).toBe(true);
	});

	it("passes when row IS present in deferred_review_register", () => {
		const m = clone(BASE_V2_MANIFEST);
		m.tables[0].ownership = "UNION_EYES_OWNED_EXCLUSIVE";
		m.tables[0].ddl_owner = "union_eyes";
		m.tables[0].target_schema = "union_eyes";
		m.tables[0].review_status = "AUTO_CLASSIFIED_UNREVIEWED";
		m.tables[0].classification_method = "AUTOMATED_HEURISTIC";
		m.tables[0].reviewed_by = "";
		m.tables[0].reviewed_at = "";
		m.tables[0].platform_sources = [];
		m.tables[0].django_sources = ["ai_core/0001_initial.py"];
		m.counts.ownership = { UNION_EYES_OWNED_EXCLUSIVE: 1 };
		if (m.counts.review_status) m.counts.review_status = { AUTO_CLASSIFIED_UNREVIEWED: 1 };
		m.deferred_review_register = [
			{ table: "orgs", reason: "test", target_phase: "Wave 1" },
		];
		if (m.counts.deferred_review_count !== undefined) m.counts.deferred_review_count = 1;
		const errors = validateManifest(m);
		expect(
			errors.some((e) =>
				e.includes("AUTO_CLASSIFIED_UNREVIEWED non-foundational row is not listed"),
			),
		).toBe(false);
	});
});

describe("Backward compatibility — v1 manifests skip provenance rules", () => {
	it("does not enforce provenance rules on v1", () => {
		const m: Manifest = clone(BASE_V2_MANIFEST);
		m.version = 1;
		// Strip all v2 fields on the row.
		delete m.tables[0].review_status;
		delete m.tables[0].reviewed_by;
		delete m.tables[0].reviewed_at;
		delete m.tables[0].evidence_sources;
		delete m.tables[0].classification_method;
		delete m.counts.review_status;
		delete m.counts.deferred_review_count;
		delete m.deferred_review_register;
		delete m.allowed_review_statuses;
		delete m.allowed_classification_methods;
		delete m.provenance_rules;
		const errors = validateManifest(m);
		expect(errors).toEqual([]);
	});
});

describe("counts.review_status tally verification", () => {
	it("rejects mismatched review_status count", () => {
		const m = clone(BASE_V2_MANIFEST);
		if (m.counts.review_status) m.counts.review_status = { RULE_DERIVED_REVIEWED: 99 };
		const errors = validateManifest(m);
		expect(errors.some((e) => e.includes("counts.review_status"))).toBe(true);
	});
});
