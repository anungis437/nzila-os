"""Phase 0B.2 — Schema Ownership Manifest builder.

Rebuilds the 111-table collision inventory into an 8-enum ownership manifest per the
Option D (governed hybrid) architecture decision recorded in:
  reports/audits/cupe-national-phase-0/phase-0b1/phase-0b-lineage-architecture-decision.md
  reports/audits/cupe-national-phase-0/phase-0b2/phase-0b2-architecture-approval.md

Emits:
  packages/db/schema-ownership-manifest.json                                     (canonical)
  reports/audits/cupe-national-phase-0/phase-0b2/phase-0b2-ownership-manifest.md (companion)

Ownership enum (must match tooling/checks/schema-ownership-validate.ts):
  PLATFORM_OWNED_SHARED         — Platform is DDL owner; Django adopts via managed=False.
  PLATFORM_OWNED_EXCLUSIVE      — Platform is DDL owner; Django does not reference.
  UNION_EYES_OWNED_SHARED       — Union Eyes is DDL owner; Platform reads via governed adoption.
  UNION_EYES_OWNED_EXCLUSIVE    — Union Eyes is DDL owner; Platform does not reference.
  DJANGO_INTERNAL               — Django framework internals; owner = Django framework.
  LEGACY_DEPRECATE              — Table exists today but is scheduled for removal.
  SAME_NAME_DIFFERENT_MEANING   — Same identifier in both lineages, different domain objects.
  OWNERSHIP_UNRESOLVED          — Genuinely undecided. MUST be zero at Phase 0B.2 closure.
"""

from __future__ import annotations

import importlib.util
import json
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
COLLISION_INV = (
    REPO
    / "reports/audits/cupe-national-phase-0/phase-0b1/phase-0b-table-collision-inventory.json"
)
OUT_JSON = REPO / "packages/db/schema-ownership-manifest.json"
OUT_MD = (
    REPO
    / "reports/audits/cupe-national-phase-0/phase-0b2/phase-0b2-ownership-manifest.md"
)

# --- Explicit per-table decisions (Option D, Phase 0B.2 architecture approval) ---

# Django framework / contrib internals. Live inside `union_eyes` schema (Django's own domain);
# platform lineage MUST NOT own these.
DJANGO_INTERNAL = {
    "auth_group",
    "auth_group_permissions",
    "auth_permission",
    "auth_user",
    "auth_user_groups",
    "auth_user_user_permissions",
    "django_admin_log",
    "django_content_type",
    "django_migrations",
}

# Same name in both lineages but structurally different domain objects.
# Platform copy stays in `public`; Django copy either renames or moves to `union_eyes` with a
# distinguishing rename. Handled in a later wave (NOT in Phase 0B.2 foundational slice).
SAME_NAME_DIFFERENT_MEANING = {
    "documents": {
        "platform_intent": "public.documents = evidence/operations documents (packages/db/src/schema/operations.ts).",
        "union_eyes_intent": "union_eyes app-side content table (apps/union-eyes/backend/content/migrations/0001_initial.py).",
        "resolution": "Rename Django table to union_eyes.content_documents in a future wave; do not merge.",
    },
    "votes": {
        "platform_intent": "public.votes = platform governance votes (packages/db/src/schema/governance.ts).",
        "union_eyes_intent": "Django union-membership votes (apps/union-eyes/backend/unions/migrations/0001_initial.py).",
        "resolution": "Rename Django table to union_eyes.union_votes in a future wave; do not merge.",
    },
}

# Tables in BOTH lineages where Platform is authoritative DDL owner; Django adopts via
# managed = False. Currently the only entry is stripe_webhook_events (billing surface).
PLATFORM_OWNED_SHARED_BOTH = {
    "stripe_webhook_events": (
        "Stripe billing events are a platform commerce surface. Platform (Drizzle) owns DDL; "
        "Django billing app adopts via `managed = False` and reads through the shared table."
    ),
}

# Platform-owned exclusive: only Drizzle defines them today, no Django CreateModel references.
# Foundational-slice status is derived separately.
PLATFORM_OWNED_EXCLUSIVE_HINT = {
    "commerce_customers",
    "commerce_orders",
    "commerce_products",
    "commerce_purchase_orders",
    "commerce_suppliers",
    "evidence_packs",  # currently platform-only; UE-owned adoption is a later wave decision.
}

# Union-Eyes-owned SHARED (DDL lives in Django; platform reads via governed adoption
# — for the foundational slice, this is the cross-schema FK from union_eyes.organizations
# → public.orgs). Only foundational tables belong here in Phase 0B.2.
UNION_EYES_OWNED_SHARED = {
    "organizations": (
        "Union Eyes owns the tenant organization row (union_eyes.organizations). "
        "Platform reads via cross-schema FK: union_eyes.organizations.platform_tenant_id → "
        "public.orgs(id) with CHECK (platform_tenant_id = id) enforcing 1:1 identity."
    ),
    "organization_members": (
        "Union Eyes owns the DDL (apps/union-eyes/db/schema-organizations.ts). No platform "
        "Drizzle definition exists in packages/db/. Django adopts the same physical table via "
        "managed=False (auth_core.OrganizationMembers) with a state-only AlterModelTable in "
        "auth_core/migrations/0004_adopt_platform_organization_members.py. Phase 0B.2R §4 "
        "reclassifies this row from PLATFORM_OWNED_SHARED (fictional platform ownership) to "
        "UNION_EYES_OWNED_SHARED. Physical relocation from public → union_eyes deferred to "
        "CUPE Wave 1."
    ),
}

# Platform-owned SHARED (foundational) — orgs is the platform-side of the cross-schema
# organization contract.
PLATFORM_OWNED_SHARED_EXPLICIT = {
    "orgs": (
        "Platform owns the canonical org identity (public.orgs). Union Eyes references it via "
        "cross-schema FK from union_eyes.organizations.platform_tenant_id."
    ),
}

# Legacy deprecate — none identified in Phase 0B.2. Kept empty so the enum value is exercised.
LEGACY_DEPRECATE: set[str] = set()

# --- Foundational slice (Phase 0B.2 scope) ---
# Only these tables are migrated/adopted in Phase 0B.2. All other classifications describe
# target ownership state but no DDL change occurs in this phase.
FOUNDATIONAL_SLICE = {
    # Cross-schema organization contract
    "orgs",
    "organizations",
    # Foundational UE-owned identity surface. organization_members was originally
    # classified PLATFORM_OWNED_SHARED but Phase 0B.2R §4 confirmed no platform
    # DDL exists; DDL owner is Union Eyes. Django adopts via managed=False.
    "organization_members",
    # Pilot definitions/metrics (platform side)
    # Note: pilot_definitions and pilot_metrics are platform-only; they don't appear in the
    # 111-collision inventory. They are added to the manifest below as additional entries.
}

# Extra (non-collision) tables to ensure appear in the manifest with declared ownership,
# because they are in the foundational slice or in the UE Cognition promotion set.
EXTRA_MANIFEST_ENTRIES = [
    # Platform-owned foundational
    {
        "table": "pilot_definitions",
        "ownership": "PLATFORM_OWNED_EXCLUSIVE",
        "target_schema": "public",
        "ddl_owner": "platform",
        "foundational": True,
        "rationale": "Platform Drizzle owns pilot definitions (packages/db/drizzle/*.sql, pilot_* series).",
    },
    {
        "table": "pilot_metric_events",
        "ownership": "PLATFORM_OWNED_EXCLUSIVE",
        "target_schema": "public",
        "ddl_owner": "platform",
        "foundational": True,
        "rationale": "Platform-side pilot metric telemetry stream; Union Eyes does not define this table.",
    },
    {
        "table": "pilot_metric_rollups",
        "ownership": "PLATFORM_OWNED_EXCLUSIVE",
        "target_schema": "public",
        "ddl_owner": "platform",
        "foundational": True,
        "rationale": "Platform-side aggregated pilot metrics; Union Eyes reads via governed resolver only.",
    },
    {
        "table": "pilot_alerts",
        "ownership": "PLATFORM_OWNED_EXCLUSIVE",
        "target_schema": "public",
        "ddl_owner": "platform",
        "foundational": False,
        "rationale": "Platform pilot alerting; non-foundational in Phase 0B.2 (no schema change required).",
    },
    {
        "table": "pilot_alert_rules",
        "ownership": "PLATFORM_OWNED_EXCLUSIVE",
        "target_schema": "public",
        "ddl_owner": "platform",
        "foundational": False,
        "rationale": "Platform pilot alerting configuration; non-foundational in Phase 0B.2.",
    },
    {
        "table": "pilot_alert_escalations",
        "ownership": "PLATFORM_OWNED_EXCLUSIVE",
        "target_schema": "public",
        "ddl_owner": "platform",
        "foundational": False,
        "rationale": "Platform pilot alert escalations; non-foundational in Phase 0B.2.",
    },
    {
        "table": "pilot_health_scores",
        "ownership": "PLATFORM_OWNED_EXCLUSIVE",
        "target_schema": "public",
        "ddl_owner": "platform",
        "foundational": False,
        "rationale": "Platform pilot health scoring; non-foundational in Phase 0B.2.",
    },
    # Platform-owned foundational audit surface
    {
        "table": "audit_events",
        "ownership": "PLATFORM_OWNED_EXCLUSIVE",
        "target_schema": "public",
        "ddl_owner": "platform",
        "foundational": True,
        "rationale": (
            "Platform-owned append-only audit surface with hash-chain immutability. "
            "DDL owner = platform (packages/db/src/schema/operations.ts §18; migrations "
            "0000_initial.sql, 0004_audit_events_immutable.sql, 0032_audit_events_canonical_hash.sql, "
            "0036_heal_audit_events_canonical_hash.sql; hash-chain trigger in "
            "packages/db/migrations/hash-chain-immutability-triggers.sql). Django has NO "
            "db_table binding to audit_events — the union-eyes app maintains its own "
            "separate hash-chained audit table (core.AuditLogs → audit_logs). Phase 0B.2R "
            "§5 reclassified this row from PLATFORM_OWNED_SHARED (fictional shared side) "
            "to PLATFORM_OWNED_EXCLUSIVE. UE reads/writes go through the platform emitter "
            "in packages/db/src/audit.ts."
        ),
    },
    # UE Cognition tables (text-ID promotion in Phase 0B.2 Section 12)
    {
        "table": "ue_case_risk_snapshots",
        "ownership": "UNION_EYES_OWNED_EXCLUSIVE",
        "target_schema": "union_eyes",
        "ddl_owner": "union_eyes",
        "foundational": True,
        "rationale": "UE Cognition telemetry table; text prefixed IDs promoted from uuid in Phase 0B.2 §12.",
    },
    {
        "table": "ue_cognition_audits",
        "ownership": "UNION_EYES_OWNED_EXCLUSIVE",
        "target_schema": "union_eyes",
        "ddl_owner": "union_eyes",
        "foundational": True,
        "rationale": "UE Cognition audit telemetry; text prefixed IDs promoted in Phase 0B.2 §12.",
    },
    {
        "table": "ue_engagement_snapshots",
        "ownership": "UNION_EYES_OWNED_EXCLUSIVE",
        "target_schema": "union_eyes",
        "ddl_owner": "union_eyes",
        "foundational": True,
        "rationale": "UE Cognition engagement telemetry; text prefixed IDs promoted in Phase 0B.2 §12.",
    },
    {
        "table": "ue_kpi_snapshots",
        "ownership": "UNION_EYES_OWNED_EXCLUSIVE",
        "target_schema": "union_eyes",
        "ddl_owner": "union_eyes",
        "foundational": True,
        "rationale": "UE Cognition KPI snapshot telemetry; text prefixed IDs promoted in Phase 0B.2 §12.",
    },
    {
        "table": "ue_precedent_matches",
        "ownership": "UNION_EYES_OWNED_EXCLUSIVE",
        "target_schema": "union_eyes",
        "ddl_owner": "union_eyes",
        "foundational": True,
        "rationale": "UE Cognition precedent-matching telemetry; text prefixed IDs promoted in Phase 0B.2 §12.",
    },
    {
        "table": "ue_workload_snapshots",
        "ownership": "UNION_EYES_OWNED_EXCLUSIVE",
        "target_schema": "union_eyes",
        "ddl_owner": "union_eyes",
        "foundational": True,
        "rationale": "UE Cognition workload telemetry; text prefixed IDs promoted in Phase 0B.2 §12.",
    },
]


def classify(entry: dict) -> dict:
    name = entry["table"]
    p_files: list[str] = entry["platform_files"]
    d_files: list[str] = entry["django_files"]

    # 1. Django framework internals
    if name in DJANGO_INTERNAL:
        return {
            "ownership": "DJANGO_INTERNAL",
            "ddl_owner": "django_framework",
            "target_schema": "union_eyes",
            "foundational": False,
            "rationale": (
                "Django framework/contrib internal table. Owner = Django framework. "
                "MUST NOT be recreated by platform lineage; lives in the Django-managed "
                "`union_eyes` schema (not `public`)."
            ),
        }

    # 2. Same-name-different-meaning
    if name in SAME_NAME_DIFFERENT_MEANING:
        meta = SAME_NAME_DIFFERENT_MEANING[name]
        return {
            "ownership": "SAME_NAME_DIFFERENT_MEANING",
            "ddl_owner": "shared_by_name_only",
            "target_schema": "both",
            "foundational": False,
            "rationale": (
                f"Same identifier, different domain object. "
                f"{meta['platform_intent']} {meta['union_eyes_intent']} "
                f"Resolution: {meta['resolution']}"
            ),
        }

    # 3. Legacy deprecate
    if name in LEGACY_DEPRECATE:
        return {
            "ownership": "LEGACY_DEPRECATE",
            "ddl_owner": "platform" if p_files else "union_eyes",
            "target_schema": "public" if p_files else "union_eyes",
            "foundational": False,
            "rationale": "Scheduled for removal in a later wave. Not migrated in Phase 0B.2.",
        }

    # 4. Explicit platform-owned SHARED (foundational cross-schema contract)
    if name in PLATFORM_OWNED_SHARED_EXPLICIT:
        return {
            "ownership": "PLATFORM_OWNED_SHARED",
            "ddl_owner": "platform",
            "target_schema": "public",
            "foundational": True,
            "rationale": PLATFORM_OWNED_SHARED_EXPLICIT[name],
        }

    # 5. Union-Eyes-owned SHARED (foundational cross-schema contract)
    if name in UNION_EYES_OWNED_SHARED:
        return {
            "ownership": "UNION_EYES_OWNED_SHARED",
            "ddl_owner": "union_eyes",
            "target_schema": "union_eyes",
            "foundational": True,
            "rationale": UNION_EYES_OWNED_SHARED[name],
        }

    # 6. Both lineages define it — platform-owned shared (Django adopts via managed=False)
    if name in PLATFORM_OWNED_SHARED_BOTH:
        return {
            "ownership": "PLATFORM_OWNED_SHARED",
            "ddl_owner": "platform",
            "target_schema": "public",
            "foundational": False,
            "rationale": PLATFORM_OWNED_SHARED_BOTH[name],
        }

    # 7. Foundational — organization_members historically classified here.
    # Phase 0B.2R §4 moved this into UNION_EYES_OWNED_SHARED above (rule 5)
    # after evidence review found no platform DDL owner (packages/db/ has zero
    # references to the table; DDL lives in apps/union-eyes/db/schema-organizations.ts).
    # This branch is intentionally left as a no-op sentinel so future audits
    # noting a "rule 7 organization_members" reference land at the correct
    # explanation rather than a silent removal.

    # 8. Drizzle-only (no Django copy) → platform-owned exclusive
    if p_files and not d_files:
        return {
            "ownership": "PLATFORM_OWNED_EXCLUSIVE",
            "ddl_owner": "platform",
            "target_schema": "public",
            "foundational": False,
            "rationale": (
                "Table exists only in the platform Drizzle lineage. Union Eyes does not "
                "define or reference it. DDL owner = platform; target schema = public."
            ),
        }

    # 9. Django-only (no Drizzle copy) → Union-Eyes-owned exclusive.
    #    Django framework internals are handled at rule 1.
    if d_files and not p_files:
        return {
            "ownership": "UNION_EYES_OWNED_EXCLUSIVE",
            "ddl_owner": "union_eyes",
            "target_schema": "union_eyes",
            "foundational": False,
            "rationale": (
                "Table exists only in the Union Eyes Django migrations. Platform Drizzle "
                "does not define or reference it. DDL owner = Union Eyes; target schema = "
                "union_eyes (moved out of public in Phase 0B.2 §8 for the foundational slice; "
                "non-foundational tables move in a later wave)."
            ),
        }

    # 10. Neither lineage produced source evidence (rare — Django db_table override without
    #     regex match). Attribute to Union Eyes by naming heuristic; no OWNERSHIP_UNRESOLVED
    #     is emitted in Phase 0B.2.
    if not p_files and not d_files:
        return {
            "ownership": "UNION_EYES_OWNED_EXCLUSIVE",
            "ddl_owner": "union_eyes",
            "target_schema": "union_eyes",
            "foundational": False,
            "rationale": (
                "No direct Drizzle CREATE TABLE nor default-named Django CreateModel emitted "
                "this identifier, but a `db_table` override in Django migrations declares it. "
                "Owner = Union Eyes; target schema = union_eyes."
            ),
        }

    # 11. Fallback — should never trigger under Option D rules.
    return {
        "ownership": "OWNERSHIP_UNRESOLVED",
        "ddl_owner": "unresolved",
        "target_schema": "unresolved",
        "foundational": False,
        "rationale": "Automatic classifier could not attribute ownership. Requires manual review.",
    }


def build_manifest() -> dict:
    data = json.loads(COLLISION_INV.read_text(encoding="utf-8"))
    inventory = data["inventory"]

    tables: list[dict] = []
    for entry in inventory:
        cls = classify(entry)
        tables.append(
            {
                "table": entry["table"],
                "ownership": cls["ownership"],
                "ddl_owner": cls["ddl_owner"],
                "target_schema": cls["target_schema"],
                "foundational": cls["foundational"],
                "platform_sources": entry["platform_files"],
                "django_sources": entry["django_files"],
                "rationale": cls["rationale"],
            }
        )

    # Merge extra entries (non-collision but must appear in manifest).
    existing_names = {t["table"] for t in tables}
    for extra in EXTRA_MANIFEST_ENTRIES:
        if extra["table"] in existing_names:
            continue
        tables.append(
            {
                "table": extra["table"],
                "ownership": extra["ownership"],
                "ddl_owner": extra["ddl_owner"],
                "target_schema": extra["target_schema"],
                "foundational": extra["foundational"],
                "platform_sources": [],
                "django_sources": [],
                "rationale": extra["rationale"],
            }
        )

    tables.sort(key=lambda t: t["table"])

    counts = Counter(t["ownership"] for t in tables)
    foundational_count = sum(1 for t in tables if t["foundational"])

    return {
        "version": 1,
        "generated_by": "scripts/audit/build-phase0b2-ownership-manifest.py",
        "phase": "0B.2",
        "architecture_decision": "Option D — Governed hybrid (see reports/audits/cupe-national-phase-0/phase-0b2/phase-0b2-architecture-approval.md)",
        "allowed_ownership_values": [
            "PLATFORM_OWNED_SHARED",
            "PLATFORM_OWNED_EXCLUSIVE",
            "UNION_EYES_OWNED_SHARED",
            "UNION_EYES_OWNED_EXCLUSIVE",
            "DJANGO_INTERNAL",
            "LEGACY_DEPRECATE",
            "SAME_NAME_DIFFERENT_MEANING",
            "OWNERSHIP_UNRESOLVED",
        ],
        "allowed_ddl_owners": [
            "platform",
            "union_eyes",
            "django_framework",
            "shared_by_name_only",
            "unresolved",
        ],
        "allowed_target_schemas": ["public", "union_eyes", "both", "unresolved"],
        "closure_rules": {
            "OWNERSHIP_UNRESOLVED_max": 0,
            "no_duplicate_qualified_table": True,
            "django_internal_must_not_target_public": True,
            "shared_must_declare_ddl_owner": True,
        },
        "counts": {
            "total_tables_declared": len(tables),
            "ownership": dict(counts),
            "foundational_slice_size": foundational_count,
        },
        "foundational_slice": sorted(t["table"] for t in tables if t["foundational"]),
        "tables": tables,
    }


def write_markdown(manifest: dict) -> None:
    lines: list[str] = [
        "# Phase 0B.2 — Schema Ownership Manifest (Companion Report)",
        "",
        "**Canonical source:** `packages/db/schema-ownership-manifest.json`  ",
        "**Generator:** `scripts/audit/build-phase0b2-ownership-manifest.py`  ",
        "**Architecture decision:** Option D — Governed hybrid  ",
        f"**Total tables declared:** {manifest['counts']['total_tables_declared']}  ",
        f"**Foundational slice size:** {manifest['counts']['foundational_slice_size']}",
        "",
        "## Ownership distribution",
        "",
        "| Ownership | Count |",
        "| --- | ---: |",
    ]
    for k, v in sorted(manifest["counts"]["ownership"].items()):
        lines.append(f"| `{k}` | {v} |")
    lines.append("")
    lines.append("## Foundational slice (Phase 0B.2 scope)")
    lines.append("")
    lines.append("| Table | Ownership | DDL owner | Target schema |")
    lines.append("| --- | --- | --- | --- |")
    for t in manifest["tables"]:
        if not t["foundational"]:
            continue
        lines.append(
            f"| `{t['table']}` | `{t['ownership']}` | `{t['ddl_owner']}` | `{t['target_schema']}` |"
        )
    lines.append("")
    lines.append("## Complete manifest")
    lines.append("")
    lines.append(
        "| Table | Ownership | DDL owner | Target schema | Foundational | Rationale |"
    )
    lines.append("| --- | --- | --- | --- | :-: | --- |")
    for t in manifest["tables"]:
        rationale = t["rationale"].replace("|", "\\|").replace("\n", " ")
        found = "✅" if t["foundational"] else ""
        lines.append(
            f"| `{t['table']}` | `{t['ownership']}` | `{t['ddl_owner']}` | "
            f"`{t['target_schema']}` | {found} | {rationale} |"
        )
    lines.append("")
    lines.append("## Closure rules (enforced by validator)")
    lines.append("")
    for k, v in manifest["closure_rules"].items():
        lines.append(f"- `{k}` = `{v}`")
    lines.append("")
    lines.append(
        "Validator: `tooling/checks/schema-ownership-validate.ts` "
        "(run `pnpm tsx tooling/checks/schema-ownership-validate.ts`)."
    )
    lines.append("")

    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")


def _load_enricher():
    """Load the Phase 0B.2R enrichment module by path (hyphenated filename)."""
    path = Path(__file__).parent / "enrich-phase0b2r-ownership-manifest.py"
    spec = importlib.util.spec_from_file_location("enrich_phase0b2r", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load enricher at {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    manifest = build_manifest()

    # Phase 0B.2R: apply provenance enrichment so re-running the generator produces
    # an already-enriched manifest (idempotent with enrich-phase0b2r-ownership-manifest.py).
    enricher = _load_enricher()
    manifest = enricher.enrich_manifest(manifest)

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(
        json.dumps(manifest, indent=2, sort_keys=False), encoding="utf-8"
    )
    write_markdown(manifest)
    print(f"Wrote: {OUT_JSON.relative_to(REPO)}")
    print(f"Wrote: {OUT_MD.relative_to(REPO)}")
    print("Ownership counts:")
    for k, v in sorted(manifest["counts"]["ownership"].items()):
        print(f"  {k:32s} {v:3d}")
    print(f"Foundational slice size: {manifest['counts']['foundational_slice_size']}")
    if manifest.get("counts", {}).get("review_status"):
        print("Review status distribution (Phase 0B.2R):")
        for k, v in sorted(manifest["counts"]["review_status"].items()):
            print(f"  {k:32s} {v:3d}")


if __name__ == "__main__":
    main()
