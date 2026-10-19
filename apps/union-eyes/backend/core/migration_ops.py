"""Guarded schema operations for databases whose columns pre-date the Django migration state.

Context (Phase 3A release qualification): a database restored from the historical SQL lineage can already contain
columns that a later Django ``AddField`` creates (for example ``documents`` and ``claims``). A plain ``AddField`` then
aborts with ``DuplicateColumn`` after earlier migrations in the same run have already committed.

``AddFieldIfNotExists`` keeps the Django *state* change exactly as ``AddField`` (so migration state stays authoritative
and a fresh Django-first database is built identically), but its database step:

* adds the column normally when it is absent;
* does nothing when a compatible column is already present;
* FAILS CLOSED (raises) when the existing column has an incompatible type family, or when the field is declared unique
  and no single-column unique index exists, instead of hiding the drift;
* logs nullability differences (they do not break reads or writes, and are reported by the R1 read-only check).

It never drops a column on reverse: the pre-existing column may be owned by another lineage and hold data.
PostgreSQL only.
"""
from __future__ import annotations

import logging

from django.db import migrations

logger = logging.getLogger(__name__)

# information_schema.columns.data_type  ->  coarse family used for compatibility
_PG_FAMILY = {
    "character varying": "text",
    "character": "text",
    "text": "text",
    "citext": "text",
    "boolean": "bool",
    "smallint": "int",
    "integer": "int",
    "bigint": "int",
    "numeric": "numeric",
    "double precision": "numeric",
    "real": "numeric",
    "uuid": "uuid",
    "jsonb": "json",
    "json": "json",
    "date": "date",
    "timestamp with time zone": "timestamp",
    "timestamp without time zone": "timestamp",
    "time without time zone": "time",
    "ARRAY": "array",
    "inet": "inet",
    "bytea": "bytes",
}

# Django db_type() prefix -> same family vocabulary
_DJANGO_FAMILY = (
    ("varchar", "text"),
    ("char", "text"),
    ("text", "text"),
    ("citext", "text"),
    ("boolean", "bool"),
    ("smallint", "int"),
    ("integer", "int"),
    ("bigint", "int"),
    ("serial", "int"),
    ("bigserial", "int"),
    ("numeric", "numeric"),
    ("double precision", "numeric"),
    ("real", "numeric"),
    ("uuid", "uuid"),
    ("jsonb", "json"),
    ("json", "json"),
    ("date", "date"),
    ("timestamp", "timestamp"),
    ("time", "time"),
    ("inet", "inet"),
    ("bytea", "bytes"),
)

# integers widen safely into each other; text and varchar are interchangeable for reads and writes
_COMPATIBLE = {("int", "numeric")}


def django_family(db_type: str | None) -> str | None:
    if not db_type:
        return None
    t = db_type.strip().lower()
    if t.endswith("[]") or " array" in t:
        return "array"
    for prefix, fam in _DJANGO_FAMILY:
        if t.startswith(prefix):
            return fam
    return None


def pg_family(data_type: str | None) -> str | None:
    return _PG_FAMILY.get(data_type) if data_type else None


def families_compatible(existing: str | None, wanted: str | None) -> bool:
    if existing is None or wanted is None:
        return True  # unknown on either side: do not block, the R1 check reports it
    return existing == wanted or (existing, wanted) in _COMPATIBLE


def _existing_column(connection, table: str, column: str):
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT data_type, is_nullable FROM information_schema.columns "
            "WHERE table_schema = current_schema() AND table_name = %s AND column_name = %s",
            [table, column],
        )
        return cursor.fetchone()


def _has_single_column_unique_index(connection, table: str, column: str) -> bool:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT 1 FROM pg_index i "
            "JOIN pg_class c ON c.oid = i.indrelid "
            "JOIN pg_namespace n ON n.oid = c.relnamespace "
            "JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0] "
            "WHERE n.nspname = current_schema() AND c.relname = %s AND i.indisunique "
            "AND i.indnatts = 1 AND i.indexprs IS NULL AND a.attname = %s LIMIT 1",
            [table, column],
        )
        return cursor.fetchone() is not None


class AddFieldIfNotExists(migrations.AddField):
    """``AddField`` whose database step tolerates a compatible pre-existing column. See module docstring."""

    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        to_model = to_state.apps.get_model(app_label, self.model_name)
        if not self.allow_migrate_model(schema_editor.connection.alias, to_model):
            return
        field = to_model._meta.get_field(self.name)
        table, column = to_model._meta.db_table, field.column
        existing = _existing_column(schema_editor.connection, table, column)
        if existing is None:
            return super().database_forwards(app_label, schema_editor, from_state, to_state)

        data_type, is_nullable = existing
        wanted = django_family(field.db_type(schema_editor.connection))
        if not families_compatible(pg_family(data_type), wanted):
            raise RuntimeError(
                f"{app_label}.{self.model_name}.{self.name}: column {table}.{column} already exists as "
                f"'{data_type}' but the migration state requires a '{wanted}' column. Refusing to continue; "
                "reconcile the schema authority before migrating."
            )
        if field.unique and not _has_single_column_unique_index(schema_editor.connection, table, column):
            raise RuntimeError(
                f"{app_label}.{self.model_name}.{self.name}: column {table}.{column} already exists but has no "
                "single-column unique index, which the migration state requires. Refusing to continue."
            )
        if field.null != (is_nullable == "YES"):
            logger.warning(
                "%s.%s.%s: existing column %s.%s nullability (%s) differs from the migration state (null=%s); "
                "left unchanged.", app_label, self.model_name, self.name, table, column, is_nullable, field.null,
            )
        logger.info("%s.%s.%s: compatible column already present; database step skipped.", app_label, self.model_name, self.name)

    def database_backwards(self, app_label, schema_editor, from_state, to_state):
        # Never drop: the column may belong to another lineage and hold data.
        return

    def describe(self):
        return f"Add field {self.name} to {self.model_name} (skipped if a compatible column already exists)"