"""Phase 0B.1 collision inventory builder.

Cross-references the 111 colliding public.<name> tables against:
- Platform lineage: packages/db/drizzle/*.sql (CREATE TABLE statements)
- Django lineage: apps/union-eyes/backend/*/migrations/*.py (CreateModel operations)

Emits:
- reports/audits/cupe-national-phase-0/phase-0b1/table-collision-inventory.json
- reports/audits/cupe-national-phase-0/phase-0b1/table-collision-inventory.md
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
COLLISION_LOG = REPO / "reports/audits/cupe-national-phase-0/logs/phase-0b-true-lineage-conflicts.log"
DRIZZLE_DIR = REPO / "packages/db/drizzle"
DRIZZLE_SCHEMA_DIR = REPO / "packages/db/src/schema"
DJANGO_APPS_ROOT = REPO / "apps/union-eyes/backend"
UE_COGNITION_SCHEMA_DIR = REPO / "packages/ue-cognition/src"

OUT_JSON = REPO / "reports/audits/cupe-national-phase-0/phase-0b1/phase-0b-table-collision-inventory.json"
OUT_MD = REPO / "reports/audits/cupe-national-phase-0/phase-0b1/phase-0b-table-collision-inventory.md"

# Django-internal tables never owned by platform
DJANGO_INTERNAL = {
    "auth_group", "auth_group_permissions", "auth_permission",
    "auth_user", "auth_user_groups", "auth_user_user_permissions",
    "django_admin_log", "django_content_type", "django_migrations",
}


def load_collisions() -> list[str]:
    return [
        line.strip()
        for line in COLLISION_LOG.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def scan_drizzle() -> dict[str, list[str]]:
    """Return {table_name: [source_file, ...]} for both SQL migrations and TS pgTable defs."""
    owner: dict[str, list[str]] = defaultdict(list)
    sql_pat = re.compile(
        r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?public"?\.)?"?([A-Za-z_][A-Za-z_0-9]*)"?',
        re.IGNORECASE,
    )
    for sql in sorted(DRIZZLE_DIR.glob("*.sql")):
        text = sql.read_text(encoding="utf-8", errors="ignore")
        for m in sql_pat.finditer(text):
            owner[m.group(1)].append(f"drizzle/{sql.name}")

    ts_pat = re.compile(r'pgTable\(\s*[\'"]([A-Za-z_][A-Za-z_0-9]*)[\'"]')
    for root in (DRIZZLE_SCHEMA_DIR, UE_COGNITION_SCHEMA_DIR):
        if not root.exists():
            continue
        for ts in root.rglob("*.ts"):
            try:
                text = ts.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            for m in ts_pat.finditer(text):
                owner[m.group(1)].append(str(ts.relative_to(REPO)).replace("\\", "/"))
    return owner


def scan_django() -> dict[str, list[str]]:
    """Return {table_name: [django_app, ...]} using CreateModel + Meta.db_table when present.

    Simplified heuristic:
    - default Django table name = <app_label>_<model_lowercase>
    - override via `db_table = "..."` in migration options.
    """
    owner: dict[str, list[str]] = defaultdict(list)
    if not DJANGO_APPS_ROOT.exists():
        return owner

    createmodel_pat = re.compile(r"migrations\.CreateModel\s*\(\s*name\s*=\s*['\"]([^'\"]+)['\"]")
    dbtable_pat = re.compile(r"['\"]db_table['\"]\s*:\s*['\"]([^'\"]+)['\"]")

    for py in DJANGO_APPS_ROOT.rglob("migrations/*.py"):
        # Skip venv
        if ".venv" in py.parts:
            continue
        # Django app label = parent directory of migrations/
        try:
            app_label = py.parent.parent.name
        except Exception:
            app_label = "unknown"

        try:
            text = py.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        # Find all CreateModel + adjacent options.db_table if present
        for cm in createmodel_pat.finditer(text):
            model_name = cm.group(1)
            # Look for db_table within 2000 chars after this CreateModel
            window = text[cm.start():cm.start() + 2000]
            dbt = dbtable_pat.search(window)
            table = dbt.group(1) if dbt else f"{app_label}_{model_name.lower()}"
            owner[table].append(f"{app_label}/{py.name}")

    return owner


def classify(name: str, platform_files: list[str], django_files: list[str]) -> tuple[str, str]:
    """Return (classification_code, rationale)."""
    if name in DJANGO_INTERNAL:
        if platform_files:
            return (
                "INCOMPATIBLE_DUPLICATE",
                "Django-framework-internal table; platform lineage MUST NOT own it.",
            )
        return (
            "DJANGO_INTERNAL",
            "Django framework or contrib internal table; owner = Django.",
        )
    if name in {"organizations", "orgs"}:
        return (
            "SHARED_INTENT",
            "Shared organization contract (Outcome C: platform_tenant_id = organizations.id = orgs.id).",
        )
    if name in {"users", "user_uuid_mapping", "user_sessions", "user_engagement_scores"}:
        return (
            "REQUIRES_DECISION",
            "User identity surface; ownership boundary must be declared explicitly.",
        )
    if name in {"stripe_webhook_events", "commerce_customers", "commerce_orders",
                "commerce_products", "commerce_purchase_orders", "commerce_suppliers"}:
        return (
            "REQUIRES_DECISION",
            "Commerce/billing surface; likely platform-owned but must be confirmed.",
        )
    if name in {"documents", "reports", "evidence_packs"}:
        return (
            "REQUIRES_DECISION",
            "Cross-cutting artifact table; requires explicit boundary declaration.",
        )
    return (
        "REQUIRES_DECISION",
        "Duplicate DDL in both lineages; material compatibility not automatically verifiable.",
    )


def main() -> None:
    collisions = load_collisions()
    platform = scan_drizzle()
    django = scan_django()

    inventory: list[dict] = []
    counts: dict[str, int] = defaultdict(int)
    for name in collisions:
        p_files = platform.get(name, [])
        d_files = django.get(name, [])
        cls, rationale = classify(name, p_files, d_files)
        counts[cls] += 1
        inventory.append({
            "table": name,
            "platform_files": p_files,
            "django_files": d_files,
            "classification": cls,
            "rationale": rationale,
        })

    result = {
        "total_collisions": len(collisions),
        "platform_source_root": str(DRIZZLE_DIR.relative_to(REPO)),
        "django_source_root": str(DJANGO_APPS_ROOT.relative_to(REPO)),
        "classification_counts": dict(counts),
        "inventory": inventory,
        "generated_from": {
            "collision_log": str(COLLISION_LOG.relative_to(REPO)),
            "platform_drizzle_files_scanned": len(list(DRIZZLE_DIR.glob("*.sql"))),
            "django_migration_files_scanned": len([
                p for p in DJANGO_APPS_ROOT.rglob("migrations/*.py") if ".venv" not in p.parts
            ]),
        },
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(result, indent=2, sort_keys=False), encoding="utf-8")

    # Markdown
    lines: list[str] = [
        "# Phase 0B.1 — Two-Lineage Table Collision Inventory",
        "",
        f"**Source of truth:** `{COLLISION_LOG.relative_to(REPO)}`  ",
        f"**Total colliding `public.<name>` tables:** {len(collisions)}  ",
        f"**Platform lineage:** `{DRIZZLE_DIR.relative_to(REPO)}` "
        f"({result['generated_from']['platform_drizzle_files_scanned']} SQL files)  ",
        f"**Django lineage:** `{DJANGO_APPS_ROOT.relative_to(REPO)}` "
        f"({result['generated_from']['django_migration_files_scanned']} migration files, excl. venv)  ",
        "",
        "## Classification summary",
        "",
        "| Classification | Count |",
        "| --- | --- |",
    ]
    for k, v in sorted(counts.items(), key=lambda x: -x[1]):
        lines.append(f"| {k} | {v} |")

    lines += [
        "",
        "**Classification codes.**",
        "- `SHARED_INTENT` — intentionally shared surface (Outcome C contract).",
        "- `DJANGO_INTERNAL` — Django framework/contrib table; owner = Django by definition.",
        "- `INCOMPATIBLE_DUPLICATE` — table exists in both lineages but semantic collision "
        "(e.g. platform lineage duplicates a Django-framework-internal table).",
        "- `REQUIRES_DECISION` — duplicate DDL in both lineages; Aubert must declare owner.",
        "",
        "## Full inventory",
        "",
        "| Table | Classification | Platform sources | Django sources | Notes |",
        "| --- | --- | --- | --- | --- |",
    ]
    for row in inventory:
        pf = ", ".join(row["platform_files"]) or "—"
        df = ", ".join(row["django_files"]) or "—"
        # trim if huge
        if len(pf) > 80:
            pf = pf[:77] + "..."
        if len(df) > 80:
            df = df[:77] + "..."
        lines.append(f"| `{row['table']}` | {row['classification']} | {pf} | {df} | {row['rationale']} |")

    lines += [
        "",
        "## Generation provenance",
        "",
        "```json",
        json.dumps(result["generated_from"], indent=2),
        "```",
        "",
        "> **Note.** The `REQUIRES_DECISION` rows are not automatically classifiable. Column-level "
        "material compatibility, foreign-key ownership, runtime reader/writer distribution, and "
        "business meaning must be evaluated by Aubert before an architecture decision is made "
        "(see `phase-0b-lineage-architecture-decision.md`).",
        "",
    ]

    OUT_MD.write_text("\n".join(lines), encoding="utf-8")

    print(f"[collision-inventory] wrote {OUT_JSON.relative_to(REPO)}")
    print(f"[collision-inventory] wrote {OUT_MD.relative_to(REPO)}")
    print(f"[collision-inventory] classification counts: {dict(counts)}")


if __name__ == "__main__":
    main()
