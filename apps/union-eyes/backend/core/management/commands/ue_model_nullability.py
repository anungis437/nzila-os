"""
Management command: the columns a Django model may store NULL in.

Usage:
    python manage.py ue_model_nullability [--write] [--check]

The database is shared by the Next.js application (Drizzle) and the Django backend. A column the Drizzle declaration requires may only be made NOT NULL
where no Django writer can store a NULL in it: the database may not be stricter than the loosest legitimate writer. This command writes
``core/model_nullability.json``, ``{table: [columns]}`` for every column a model leaves ``null=True``, so the platform tooling (TypeScript) reads the
models' own answer instead of parsing Python source. ``--check`` exits 1 when the committed file is not what the models say; a Django test holds the
same.
"""
import json
from pathlib import Path

from django.apps import apps
from django.core.management.base import BaseCommand

from core.management.commands.ue_physical_parity import CONTRIB_APPS, model_permits_null

REGISTER = Path(__file__).resolve().parents[2] / "model_nullability.json"


def nullable_columns():
    tables = {}
    for model in apps.get_models():
        meta = model._meta
        if meta.proxy or meta.abstract or not meta.managed or meta.app_label in CONTRIB_APPS:
            continue
        columns = sorted(f.column for f in meta.local_concrete_fields if model_permits_null(f))
        if columns:
            tables.setdefault(meta.db_table, set()).update(columns)
    return {table: sorted(columns) for table, columns in sorted(tables.items())}


def render(tables):
    return json.dumps({"schemaVersion": 1, "tables": tables}, indent=1, sort_keys=True) + "\n"


class Command(BaseCommand):
    help = "Write or check core/model_nullability.json, the columns a Django model may store NULL in."

    def add_arguments(self, parser):
        parser.add_argument("--write", action="store_true", help="Write the register.")
        parser.add_argument("--check", action="store_true", help="Exit 1 when the register is not what the models say.")

    def handle(self, *args, **options):
        text = render(nullable_columns())
        if options["write"]:
            REGISTER.write_text(text, encoding="utf-8", newline="\n")
            self.stdout.write(f"wrote {REGISTER.name}: {sum(len(c) for c in json.loads(text)['tables'].values())} nullable columns")
            return
        current = REGISTER.read_text(encoding="utf-8").replace("\r\n", "\n") if REGISTER.exists() else ""
        if options["check"] and current != text:
            raise SystemExit(1)
        self.stdout.write(text if not options["check"] else "model_nullability.json is current")
