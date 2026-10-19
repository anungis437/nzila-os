"""Emit the verified-field specification that R1 (read-only catalog check) uses to judge existing columns.

``migration_wanted_fields.json`` is generated from the real ``AddFieldIfNotExists`` operations (never hand-edited) so the
read-only R1 tool applies the same rules to the same field definitions as the migration itself. A unit test regenerates it
and fails when the committed file is stale.

Run from apps/union-eyes/backend:  python -m core.emit_wanted_fields [--write]
"""
from __future__ import annotations

import importlib
import json
import os
import sys
from decimal import Decimal
from pathlib import Path

MIGRATIONS = (
    ("content", "0004_documents_access_level_documents_blob_container_and_more"),
    ("grievances", "0005_claims_idempotency_hash"),
    ("grievances", "0007_grievance_deadlines_due_date_status"),
)
OUTPUT = Path(__file__).with_name("migration_wanted_fields.json")


def _literal(value):
    from django.db.models import NOT_PROVIDED

    if value is NOT_PROVIDED:
        return {"kind": "none"}
    if value is None:
        return {"kind": "null"}
    if callable(value):
        return {"kind": "callable"}
    if isinstance(value, (bool, int, float, str)):
        return {"kind": "literal", "value": value}
    if isinstance(value, Decimal):
        return {"kind": "literal", "value": str(value)}
    return {"kind": "expression"}


def build() -> dict:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    import django

    django.setup()
    from django.db import connection
    from django.db.migrations.loader import MigrationLoader

    from core.migration_ops import AddFieldIfNotExists

    loader = MigrationLoader(None, ignore_no_migrations=True)
    entries = []
    for app, name in MIGRATIONS:
        module = importlib.import_module(f"{app}.migrations.{name}")
        # state BEFORE this migration, plus the migration's own earlier operations, is enough for table names
        state = loader.project_state((app, name))
        for op in module.Migration.operations:
            if not isinstance(op, AddFieldIfNotExists):
                continue
            model = state.apps.get_model(app, op.model_name)
            field = model._meta.get_field(op.name)
            entries.append(
                {
                    "migration": f"{app}.{name.split('_')[0]}",
                    "table": model._meta.db_table,
                    "column": field.column,
                    "db_type": field.db_type(connection),
                    "null": bool(field.null),
                    "unique": bool(field.unique or field.primary_key),
                    "db_default": _literal(field.db_default),
                    "python_default": _literal(field.default),
                    "has_remote": field.remote_field is not None,
                    "db_check": field.db_check(connection),
                }
            )
    entries.sort(key=lambda e: (e["migration"], e["table"], e["column"]))
    return {"generatedBy": "core/emit_wanted_fields.py", "fields": entries}


def main(argv: list[str]) -> int:
    text = json.dumps(build(), indent=2, sort_keys=True) + "\n"
    if "--write" in argv:
        OUTPUT.write_text(text, encoding="utf-8", newline="\n")
        print(f"wrote {OUTPUT}")
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))