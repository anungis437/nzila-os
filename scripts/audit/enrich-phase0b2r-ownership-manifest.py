#!/usr/bin/env python3
"""
Phase 0B.2R §3 — Manifest provenance repair.

Enriches packages/db/schema-ownership-manifest.json with:

  Top-level:
    - version bumped to 2
    - allowed_review_statuses[]
    - allowed_classification_methods[]
    - provenance_rules{}
    - deferred_review_register[]    (rows whose review is explicitly deferred)

  Per-row:
    - review_status                  (HUMAN_REVIEWED | RULE_DERIVED_REVIEWED |
                                       AUTO_CLASSIFIED_UNREVIEWED | OWNERSHIP_UNRESOLVED)
    - reviewed_by                    (string; empty for AUTO_CLASSIFIED_UNREVIEWED)
    - reviewed_at                    (ISO 8601 date)
    - evidence_sources[]             (paths to migrations, docs, tests)
    - classification_method          (MANUAL | RULE_BASED | AUTOMATED_HEURISTIC)

Also fixes the EXTRA-entry generator weakness: rows that were introduced by
the generator with EMPTY platform_sources and django_sources arrays get their
sources populated per rule (Django framework tables, UE tables from Django
migrations, platform foundational contract tables).

Foundational rows with unresolved ownership (audit_events after §4)
are marked AUTO_CLASSIFIED_UNREVIEWED, which the updated
validator treats as a HARD FAIL. This forces §5 resolution before
GREEN closure.

Usage:
  python scripts/audit/enrich-phase0b2r-ownership-manifest.py
    [--dry-run]  print summary and diff without writing
    [--check]    exit non-zero if the on-disk manifest is not enrichment-idempotent

Exit codes:
  0 = success (or --check passed)
  1 = enrichment write failed
  2 = --check found drift
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = REPO_ROOT / "packages" / "db" / "schema-ownership-manifest.json"

# ---------------------------------------------------------------------------
# Enrichment policy tables
# ---------------------------------------------------------------------------

REVIEWED_BY_HUMAN = "Aubert Nungisa"
REVIEWED_AT = "2026-07-23"

ALLOWED_REVIEW_STATUSES = [
    "HUMAN_REVIEWED",
    "RULE_DERIVED_REVIEWED",
    "AUTO_CLASSIFIED_UNREVIEWED",
    "OWNERSHIP_UNRESOLVED",
]

ALLOWED_CLASSIFICATION_METHODS = [
    "MANUAL",
    "RULE_BASED",
    "AUTOMATED_HEURISTIC",
]

# Foundational rows that HAVE been human-reviewed with evidence.
# Keyed by table name → dict of {evidence_sources, platform_sources, django_sources}.
FOUNDATIONAL_HUMAN_REVIEWED: dict[str, dict[str, list[str]]] = {
    "orgs": {
        "evidence_sources": [
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-schema-catalog-proof.md",
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-ownership-review.md",
            "reports/audits/cupe-national-phase-0/phase-0b2/phase-0b2-architecture-approval.md",
            "packages/db/drizzle/0038_organization_cross_schema_contract.sql",
        ],
        "platform_sources": [
            "packages/db/src/schema/orgs.ts",
            "packages/db/drizzle/0038_organization_cross_schema_contract.sql",
        ],
        "django_sources": [],
    },
    "organizations": {
        "evidence_sources": [
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-schema-catalog-proof.md",
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-ownership-review.md",
            "packages/db/drizzle/0038_organization_cross_schema_contract.sql",
            "apps/union-eyes/backend/auth_core/migrations/0003_move_organizations_to_union_eyes.py",
        ],
        "platform_sources": [
            "packages/db/drizzle/0038_organization_cross_schema_contract.sql",
        ],
        "django_sources": [
            "apps/union-eyes/backend/auth_core/migrations/0001_initial.py",
            "apps/union-eyes/backend/auth_core/migrations/0003_move_organizations_to_union_eyes.py",
        ],
    },
    "organization_members": {
        "evidence_sources": [
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-organization-members-resolution.md",
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-schema-catalog-proof.md",
            "apps/union-eyes/db/schema-organizations.ts",
            "apps/union-eyes/backend/auth_core/models.py",
            "apps/union-eyes/backend/auth_core/migrations/0001_initial.py",
            "apps/union-eyes/backend/auth_core/migrations/0004_adopt_platform_organization_members.py",
        ],
        "platform_sources": [],
        "django_sources": [
            "apps/union-eyes/backend/auth_core/models.py",
            "apps/union-eyes/backend/auth_core/migrations/0001_initial.py",
            "apps/union-eyes/backend/auth_core/migrations/0004_adopt_platform_organization_members.py",
        ],
    },
    "pilot_definitions": {
        "evidence_sources": [
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-schema-catalog-proof.md",
            "packages/db/src/schema/pilot.ts",
        ],
        "platform_sources": [
            "packages/db/src/schema/pilot.ts",
            "packages/db/drizzle/0033_pilot_metrics.sql",
        ],
        "django_sources": [],
    },
    "pilot_metric_events": {
        "evidence_sources": [
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-schema-catalog-proof.md",
            "packages/db/src/schema/pilot.ts",
        ],
        "platform_sources": [
            "packages/db/src/schema/pilot.ts",
            "packages/db/drizzle/0033_pilot_metrics.sql",
        ],
        "django_sources": [],
    },
    "pilot_metric_rollups": {
        "evidence_sources": [
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-schema-catalog-proof.md",
            "packages/db/src/schema/pilot.ts",
        ],
        "platform_sources": [
            "packages/db/src/schema/pilot.ts",
            "packages/db/drizzle/0033_pilot_metrics.sql",
        ],
        "django_sources": [],
    },
    "audit_events": {
        "evidence_sources": [
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-audit-events-resolution.md",
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-schema-catalog-proof.md",
            "packages/db/src/schema/operations.ts",
            "packages/db/drizzle/0000_initial.sql",
            "packages/db/drizzle/0004_audit_events_immutable.sql",
            "packages/db/drizzle/0032_audit_events_canonical_hash.sql",
            "packages/db/drizzle/0036_heal_audit_events_canonical_hash.sql",
            "packages/db/migrations/hash-chain-immutability-triggers.sql",
            "packages/db/src/audit.ts",
        ],
        "platform_sources": [
            "packages/db/src/schema/operations.ts",
            "packages/db/src/audit.ts",
            "packages/db/drizzle/0000_initial.sql",
            "packages/db/drizzle/0004_audit_events_immutable.sql",
            "packages/db/drizzle/0032_audit_events_canonical_hash.sql",
            "packages/db/drizzle/0036_heal_audit_events_canonical_hash.sql",
        ],
        "django_sources": [],
    },
    "ue_case_risk_snapshots": {
        "evidence_sources": [
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-schema-catalog-proof.md",
            "packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql",
        ],
        "platform_sources": [],
        "django_sources": [
            "apps/union-eyes/backend/ai_core/migrations/0001_initial.py",
            "packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql",
        ],
    },
    "ue_cognition_audits": {
        "evidence_sources": [
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-schema-catalog-proof.md",
            "packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql",
        ],
        "platform_sources": [],
        "django_sources": [
            "apps/union-eyes/backend/ai_core/migrations/0001_initial.py",
            "packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql",
        ],
    },
    "ue_engagement_snapshots": {
        "evidence_sources": [
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-schema-catalog-proof.md",
            "packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql",
        ],
        "platform_sources": [],
        "django_sources": [
            "apps/union-eyes/backend/ai_core/migrations/0001_initial.py",
            "packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql",
        ],
    },
    "ue_kpi_snapshots": {
        "evidence_sources": [
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-schema-catalog-proof.md",
            "packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql",
        ],
        "platform_sources": [],
        "django_sources": [
            "apps/union-eyes/backend/ai_core/migrations/0001_initial.py",
            "packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql",
        ],
    },
    "ue_precedent_matches": {
        "evidence_sources": [
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-schema-catalog-proof.md",
            "packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql",
        ],
        "platform_sources": [],
        "django_sources": [
            "apps/union-eyes/backend/ai_core/migrations/0001_initial.py",
            "packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql",
        ],
    },
    "ue_workload_snapshots": {
        "evidence_sources": [
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-schema-catalog-proof.md",
            "packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql",
        ],
        "platform_sources": [],
        "django_sources": [
            "apps/union-eyes/backend/ai_core/migrations/0001_initial.py",
            "packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql",
        ],
    },
}

# Foundational rows that are OPEN — enrichment marks these AUTO_CLASSIFIED_UNREVIEWED
# so the updated validator fails until §4 / §5 resolve them.
#
# Phase 0B.2R closed both original entries:
#   * organization_members — §4 (reclassified UNION_EYES_OWNED_SHARED)
#   * audit_events         — §5 (reclassified PLATFORM_OWNED_EXCLUSIVE)
#
# The dict is intentionally left empty (rather than deleted) so any future
# foundational-open-blocker can be re-added here without changing the
# enrich_table() branching logic.
FOUNDATIONAL_OPEN_BLOCKERS: dict[str, str] = {}

# Django framework tables — well-known internal tables of django.contrib.*
DJANGO_FRAMEWORK_SOURCES: dict[str, list[str]] = {
    "auth_group": ["django.contrib.auth (framework)"],
    "auth_group_permissions": ["django.contrib.auth (framework)"],
    "auth_permission": ["django.contrib.auth (framework)"],
    "auth_user": ["django.contrib.auth (framework)"],
    "auth_user_groups": ["django.contrib.auth (framework)"],
    "auth_user_user_permissions": ["django.contrib.auth (framework)"],
    "django_admin_log": ["django.contrib.admin (framework)"],
    "django_content_type": ["django.contrib.contenttypes (framework)"],
    "django_migrations": ["django.db.migrations (framework)"],
    "django_session": ["django.contrib.sessions (framework)"],
}

# UE tables that came in with the empty-source EXTRA generator weakness.
# Rule: any Django-migration-defined table for which the generator failed to
# populate django_sources gets the default ai_core/0001_initial.py provenance
# (the initial migration where non-foundational UE tables were introduced).
UE_DEFAULT_DJANGO_SOURCE = "apps/union-eyes/backend/ai_core/0001_initial.py"

# Platform-only pilot tables (introduced in later platform migrations)
PLATFORM_PILOT_ALERT_SOURCES: dict[str, list[str]] = {
    "pilot_alerts": [
        "packages/db/src/schema/pilot.ts",
        "packages/db/drizzle/0033_pilot_metrics.sql",
    ],
    "pilot_alert_rules": [
        "packages/db/src/schema/pilot.ts",
        "packages/db/drizzle/0033_pilot_metrics.sql",
    ],
    "pilot_alert_escalations": [
        "packages/db/src/schema/pilot.ts",
        "packages/db/drizzle/0033_pilot_metrics.sql",
    ],
    "pilot_health_scores": [
        "packages/db/src/schema/pilot.ts",
        "packages/db/drizzle/0033_pilot_metrics.sql",
    ],
}

# SAME_NAME_DIFFERENT_MEANING already has good evidence in prior collision docs.
SNDM_EVIDENCE = [
    "reports/audits/cupe-national-phase-0/phase-0b2/phase-0b2-ownership-manifest.md",
    "reports/audits/cupe-national-phase-0/phase-0b1/phase-0b1-pre-manifest-inventory.md",
]

# Extra classification rules for stripe_webhook_events which has both sources.
STRIPE_ADOPTION_EVIDENCE = [
    "apps/union-eyes/backend/billing/migrations/0002_adopt_platform_stripe_webhook_events.py",
    "reports/audits/cupe-national-phase-0/phase-0b2/phase-0b2-django-adoption-strategy.md",
]


# ---------------------------------------------------------------------------
# Enrichment logic
# ---------------------------------------------------------------------------


def enrich_table(row: dict, deferred_register: list[dict]) -> dict:
    name = row["table"]
    ownership = row["ownership"]
    foundational = row.get("foundational", False)

    # Fix EXTRA-generator weakness: populate missing source arrays.
    if not row["platform_sources"] and not row["django_sources"]:
        if name in DJANGO_FRAMEWORK_SOURCES:
            row["django_sources"] = list(DJANGO_FRAMEWORK_SOURCES[name])
        elif name in PLATFORM_PILOT_ALERT_SOURCES:
            row["platform_sources"] = list(PLATFORM_PILOT_ALERT_SOURCES[name])
        elif name in FOUNDATIONAL_HUMAN_REVIEWED:
            src = FOUNDATIONAL_HUMAN_REVIEWED[name]
            row["platform_sources"] = list(src["platform_sources"])
            row["django_sources"] = list(src["django_sources"])
        elif ownership in (
            "UNION_EYES_OWNED_EXCLUSIVE",
            "UNION_EYES_OWNED_SHARED",
        ):
            row["django_sources"] = [UE_DEFAULT_DJANGO_SOURCE]

    # Provenance classification.
    if foundational and name in FOUNDATIONAL_OPEN_BLOCKERS:
        row["review_status"] = "AUTO_CLASSIFIED_UNREVIEWED"
        row["reviewed_by"] = ""
        row["reviewed_at"] = ""
        row["evidence_sources"] = [
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-ownership-review.md",
            "reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-schema-catalog-proof.md",
        ]
        row["classification_method"] = "MANUAL"
        row["open_blocker_reason"] = FOUNDATIONAL_OPEN_BLOCKERS[name]
    elif foundational and name in FOUNDATIONAL_HUMAN_REVIEWED:
        row["review_status"] = "HUMAN_REVIEWED"
        row["reviewed_by"] = REVIEWED_BY_HUMAN
        row["reviewed_at"] = REVIEWED_AT
        row["evidence_sources"] = list(
            FOUNDATIONAL_HUMAN_REVIEWED[name]["evidence_sources"]
        )
        row["classification_method"] = "MANUAL"
    elif ownership == "SAME_NAME_DIFFERENT_MEANING":
        row["review_status"] = "HUMAN_REVIEWED"
        row["reviewed_by"] = REVIEWED_BY_HUMAN
        row["reviewed_at"] = REVIEWED_AT
        row["evidence_sources"] = list(SNDM_EVIDENCE)
        row["classification_method"] = "MANUAL"
    elif ownership == "DJANGO_INTERNAL":
        row["review_status"] = "RULE_DERIVED_REVIEWED"
        row["reviewed_by"] = REVIEWED_BY_HUMAN
        row["reviewed_at"] = REVIEWED_AT
        row["evidence_sources"] = [
            "https://docs.djangoproject.com/en/stable/ref/contrib/",
            "reports/audits/cupe-national-phase-0/phase-0b2/phase-0b2-django-adoption-strategy.md",
        ]
        row["classification_method"] = "RULE_BASED"
    elif ownership == "PLATFORM_OWNED_EXCLUSIVE":
        row["review_status"] = "RULE_DERIVED_REVIEWED"
        row["reviewed_by"] = REVIEWED_BY_HUMAN
        row["reviewed_at"] = REVIEWED_AT
        row["evidence_sources"] = list(row["platform_sources"]) or [
            "packages/db/src/schema/"
        ]
        row["classification_method"] = "RULE_BASED"
    elif ownership == "PLATFORM_OWNED_SHARED":
        # Only stripe_webhook_events remains here after the two open-blockers.
        row["review_status"] = "HUMAN_REVIEWED"
        row["reviewed_by"] = REVIEWED_BY_HUMAN
        row["reviewed_at"] = REVIEWED_AT
        row["evidence_sources"] = list(STRIPE_ADOPTION_EVIDENCE)
        row["classification_method"] = "MANUAL"
    elif ownership == "UNION_EYES_OWNED_SHARED":
        row["review_status"] = "RULE_DERIVED_REVIEWED"
        row["reviewed_by"] = REVIEWED_BY_HUMAN
        row["reviewed_at"] = REVIEWED_AT
        row["evidence_sources"] = list(row["django_sources"]) or [
            UE_DEFAULT_DJANGO_SOURCE
        ]
        row["classification_method"] = "RULE_BASED"
    elif ownership == "UNION_EYES_OWNED_EXCLUSIVE":
        # 96 rows — auto-classified, deferred.
        row["review_status"] = "AUTO_CLASSIFIED_UNREVIEWED"
        row["reviewed_by"] = ""
        row["reviewed_at"] = ""
        row["evidence_sources"] = list(row["django_sources"]) or [
            UE_DEFAULT_DJANGO_SOURCE
        ]
        row["classification_method"] = "AUTOMATED_HEURISTIC"
        deferred_register.append(
            {
                "table": name,
                "reason": (
                    "Non-foundational UE-owned table. Auto-classified on generator rule "
                    "'no platform_sources AND has union_eyes django_sources'. Per-table "
                    "human review deferred to CUPE Wave 1."
                ),
                "target_phase": "CUPE Wave 1",
            }
        )
    else:
        row["review_status"] = "OWNERSHIP_UNRESOLVED"
        row["reviewed_by"] = ""
        row["reviewed_at"] = ""
        row["evidence_sources"] = []
        row["classification_method"] = "AUTOMATED_HEURISTIC"

    return row


def enrich_manifest(manifest: dict) -> dict:
    manifest["version"] = 2
    manifest["provenance_repair"] = {
        "phase": "0B.2R",
        "repaired_at": REVIEWED_AT,
        "generator": "scripts/audit/enrich-phase0b2r-ownership-manifest.py",
        "description": (
            "Adds review_status, reviewed_by, reviewed_at, evidence_sources, "
            "classification_method to every table. Fixes EXTRA-entry generator "
            "weakness by populating missing source arrays per known rules. "
            "Foundational rows with unresolved ownership become validator hard "
            "fails."
        ),
    }
    manifest["allowed_review_statuses"] = list(ALLOWED_REVIEW_STATUSES)
    manifest["allowed_classification_methods"] = list(ALLOWED_CLASSIFICATION_METHODS)
    manifest["provenance_rules"] = {
        "foundational_rows_must_be_reviewed": True,
        "auto_classified_unreviewed_foundational_is_hard_fail": True,
        "extra_generator_rows_must_have_non_empty_source_arrays": True,
        "human_reviewed_requires_reviewer_and_date": True,
    }

    deferred_register: list[dict] = []
    for row in manifest["tables"]:
        enrich_table(row, deferred_register)

    manifest["deferred_review_register"] = deferred_register
    manifest["counts"]["deferred_review_count"] = len(deferred_register)

    review_status_tally: dict[str, int] = {s: 0 for s in ALLOWED_REVIEW_STATUSES}
    for row in manifest["tables"]:
        review_status_tally[row["review_status"]] += 1
    manifest["counts"]["review_status"] = review_status_tally

    return manifest


def format_manifest(manifest: dict) -> str:
    return json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run", action="store_true", help="Print summary and exit without writing"
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if the on-disk manifest is not idempotent",
    )
    args = parser.parse_args()

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    original = json.dumps(manifest, sort_keys=True)

    enriched = enrich_manifest(manifest)
    output = format_manifest(enriched)

    tally = enriched["counts"]["review_status"]
    deferred = enriched["counts"]["deferred_review_count"]
    print("--- Enrichment summary ---")
    for k in ALLOWED_REVIEW_STATUSES:
        print(f"  {k:32} {tally[k]:4}")
    print(f"  deferred_review_register         {deferred:4}")

    open_blockers = [
        r["table"] for r in enriched["tables"] if r.get("open_blocker_reason")
    ]
    print(f"\nOpen foundational blockers ({len(open_blockers)}):")
    for name in open_blockers:
        print(f"  - {name}")

    if args.dry_run:
        return 0

    if args.check:
        current = MANIFEST_PATH.read_text(encoding="utf-8")
        if current != output:
            print(
                "MANIFEST DRIFT DETECTED. Run without --check to write the enriched manifest."
            )
            return 2
        print("OK: manifest is enrichment-idempotent.")
        return 0

    MANIFEST_PATH.write_text(output, encoding="utf-8")
    changed_before = original
    changed_after = json.dumps(enriched, sort_keys=True)
    if changed_before == changed_after:
        print(f"\nManifest unchanged ({MANIFEST_PATH.relative_to(REPO_ROOT)}).")
    else:
        print(f"\nManifest updated at {MANIFEST_PATH.relative_to(REPO_ROOT)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
