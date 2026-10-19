"""Guarded schema operations for databases whose columns pre-date the Django migration state.

Context (Phase 3A release qualification): a database restored from the historical SQL lineage can already contain
columns that a later Django ``AddField`` creates (for example ``documents`` and ``claims``). A plain ``AddField`` then
aborts with ``DuplicateColumn`` after earlier migrations in the same run have already committed.

``AddFieldIfNotExists`` keeps the Django *state* change exactly as ``AddField`` (so migration state stays authoritative
and a fresh Django-first database is built identically), but its database step:

* adds the column normally when it is absent;
* does nothing when the existing column is demonstrably equivalent to what the migration state requires;
* FAILS CLOSED (raises, listing every problem) when it cannot prove equivalence. Equivalence is decided from the
  PostgreSQL catalog, not from a coarse type family, and anything the helper does not understand is *unresolved* and
  therefore rejected, never accepted:

  - type: the catalog type (``format_type``) must map to a known type and be at least as permissive as the Django type
    (same base type; varchar/char length and numeric precision/scale; timestamp with/without time zone, json/jsonb and
    integer widths are never interchanged; arrays compare their element type). Unknown, domain and extension types are
    rejected. Two verified exceptions, both lossless: a bounded ``varchar(n)`` under a longer ``varchar``/``text`` field is
    WIDENED in place (metadata-only in PostgreSQL, logged); and an existing ENUM under a ``varchar``/``text`` field is
    accepted only if every label fits the field's length and the field's default (when it has one) is one of the labels (the
    enum is stricter than the field, so out-of-set values are rejected loudly by the database and are never stored);
  - nullability: a nullable column for a NOT NULL field is accepted only if it currently holds no NULLs (and is reported);
    a NOT NULL column for a nullable field is rejected because Django writes NULL explicitly;
  - defaults: a ``db_default`` field requires an equal literal database default; non-literal ``db_default`` expressions,
    generated and identity columns are rejected;
  - uniqueness: a unique field requires a valid, ready, single-key, non-expression unique index that is either
    unconditional or partial only on ``<column> IS NOT NULL`` (equivalent for uniqueness); any other predicate fails;
  - foreign keys and fields with a database CHECK are rejected because their constraints are not verified here.

It never drops a column on reverse: the pre-existing column may be owned by another lineage and hold data.
PostgreSQL only.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Callable, Optional

from django.db import migrations
from django.db.models import NOT_PROVIDED

logger = logging.getLogger(__name__)

_BASE_ALIASES = {
    "varchar": "character varying",
    "character varying": "character varying",
    "char": "character",
    "bpchar": "character",
    "character": "character",
    "text": "text",
    "boolean": "boolean",
    "bool": "boolean",
    "smallint": "smallint",
    "int2": "smallint",
    "integer": "integer",
    "int": "integer",
    "int4": "integer",
    "bigint": "bigint",
    "int8": "bigint",
    "numeric": "numeric",
    "decimal": "numeric",
    "double precision": "double precision",
    "float8": "double precision",
    "real": "real",
    "float4": "real",
    "uuid": "uuid",
    "jsonb": "jsonb",
    "json": "json",
    "date": "date",
    "inet": "inet",
    "bytea": "bytea",
    "timestamp with time zone": "timestamp with time zone",
    "timestamptz": "timestamp with time zone",
    "timestamp without time zone": "timestamp without time zone",
    "timestamp": "timestamp without time zone",
    "time without time zone": "time without time zone",
    "time": "time without time zone",
    "time with time zone": "time with time zone",
    "timetz": "time with time zone",
}
_INTEGER_RANK = {"smallint": 1, "integer": 2, "bigint": 3}
_TEXT_BASES = {"character varying", "character", "text"}


@dataclass(frozen=True)
class PgType:
    base: str
    length: Optional[int] = None
    precision: Optional[int] = None
    scale: Optional[int] = None
    array: bool = False


def parse_type(text: Optional[str]) -> Optional[PgType]:
    """Parse a PostgreSQL / Django type string. Returns None for anything not understood (unresolved)."""
    if not text:
        return None
    t = " ".join(text.strip().lower().split())
    array = False
    while t.endswith("[]"):
        array = True
        t = t[:-2].strip()
    t = re.sub(r"^(timestamp|time)\(\d+\)", r"\1", t)  # fractional-second precision is irrelevant here
    match = re.fullmatch(r"([a-z][a-z0-9 ]*?)\s*(?:\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\))?", t)
    if not match:
        return None
    base = _BASE_ALIASES.get(match.group(1).strip())
    if base is None:
        return None
    first = int(match.group(2)) if match.group(2) else None
    second = int(match.group(3)) if match.group(3) else None
    if base in ("character varying", "character"):
        return PgType(base, length=first, array=array)
    if base == "numeric":
        return PgType(base, precision=first, scale=second if first is not None else None, array=array)
    return PgType(base, array=array)


def type_decision(existing: PgType, wanted: PgType) -> tuple[str, Optional[str]]:
    """('ok' | 'widen' | 'reject', reason). 'widen' is only returned for a lossless varchar/text lengthening."""
    reason = type_problem(existing, wanted)
    if reason is None:
        return "ok", None
    if (
        not existing.array
        and not wanted.array
        and existing.base == "character varying"
        and existing.length is not None
        and wanted.base in ("text", "character varying")
        and (wanted.base == "text" or wanted.length is None or wanted.length > existing.length)
    ):
        return "widen", reason
    return "reject", reason


def type_problem(existing: PgType, wanted: PgType) -> Optional[str]:
    """Why the existing column type cannot stand in for the wanted one, or None when it can."""
    if existing.array != wanted.array:
        return f"array-ness differs (existing array={existing.array}, wanted array={wanted.array})"
    if existing.base in _TEXT_BASES and wanted.base in _TEXT_BASES:
        if existing.base == "text" or (existing.base == "character varying" and existing.length is None):
            return None  # unbounded text holds anything the wanted type can
        if wanted.base == "text" or (wanted.base == "character varying" and wanted.length is None):
            return f"existing {existing.base}({existing.length}) is bounded but the wanted type is unbounded"
        if existing.base == "character" and wanted.base == "character varying":
            return "fixed-width character cannot stand in for character varying (padding semantics differ)"
        if existing.base == "character varying" and wanted.base == "character":
            return "character varying cannot stand in for fixed-width character"
        if existing.base == "character":
            return None if existing.length == wanted.length else f"character({existing.length}) vs character({wanted.length})"
        return None if (existing.length or 0) >= (wanted.length or 0) else (
            f"existing varchar({existing.length}) is shorter than the wanted varchar({wanted.length})"
        )
    if existing.base in _INTEGER_RANK and wanted.base in _INTEGER_RANK:
        return None if _INTEGER_RANK[existing.base] >= _INTEGER_RANK[wanted.base] else (
            f"existing {existing.base} is narrower than the wanted {wanted.base}"
        )
    if existing.base != wanted.base:
        return f"existing type '{existing.base}' is not the wanted '{wanted.base}'"
    if existing.base == "numeric":
        if existing.precision is None:
            return None
        if wanted.precision is None:
            return f"existing numeric({existing.precision},{existing.scale}) is bounded but the wanted numeric is not"
        if (existing.scale or 0) != (wanted.scale or 0):
            return f"numeric scale differs ({existing.scale} vs {wanted.scale})"
        if existing.precision < wanted.precision:
            return f"numeric precision {existing.precision} < {wanted.precision}"
    return None


@dataclass(frozen=True)
class ColumnFacts:
    fmt: str
    not_null: bool
    default_expr: Optional[str]
    generated: bool
    identity: bool
    type_kind: str = "b"  # pg_type.typtype: b base, e enum, d domain, c composite, r range
    enum_labels: tuple = ()


@dataclass(frozen=True)
class UniqueIndexFacts:
    key_columns: int
    valid: bool
    ready: bool
    has_expression: bool
    predicate: Optional[str]


@dataclass(frozen=True)
class WantedField:
    column: str
    db_type: Optional[str]
    null: bool
    unique: bool
    db_default: object
    has_remote: bool
    db_check: Optional[str]
    python_default: object = NOT_PROVIDED


_CAST = re.compile(r"::\s*[a-z][a-z ]*(\(\s*\d+(\s*,\s*\d+)?\s*\))?(\[\])?")


def _normalize_default(expr: str) -> str:
    e = expr.strip().lower()
    previous = None
    while previous != e:
        previous = e
        e = _CAST.sub("", e).strip()
        while e.startswith("(") and e.endswith(")"):
            e = e[1:-1].strip()
    return e.strip("'")


def _normalize_predicate(expr: str) -> str:
    return re.sub(r'[\s()"]', "", expr.lower())


def default_problem(wanted_default: object, existing_expr: Optional[str]) -> Optional[str]:
    if wanted_default is NOT_PROVIDED:
        return None
    if not isinstance(wanted_default, (str, int, float, bool, Decimal)):
        return "db_default is a database expression; equivalence with the existing default cannot be proven"
    if existing_expr is None:
        return f"the field has db_default={wanted_default!r} but the existing column has no database default"
    wanted = str(wanted_default).lower()
    if isinstance(wanted_default, bool):
        wanted = "true" if wanted_default else "false"
    if _normalize_default(existing_expr) != wanted:
        return f"existing database default {existing_expr!r} differs from db_default={wanted_default!r}"
    return None


def _enum_problems(column: ColumnFacts, wanted: WantedField, wanted_type: Optional[PgType]) -> list[str]:
    """An enum column may stand in for a varchar/text field only when every value Django can write is a label."""
    out: list[str] = []
    if wanted_type is None or wanted_type.array or wanted_type.base not in ("character varying", "text"):
        return [f"existing column is the enum {column.fmt!r} but the field is not a varchar/text field"]
    if not column.enum_labels:
        return [f"existing enum {column.fmt!r} has no labels"]
    if wanted_type.length is not None:
        too_long = [label for label in column.enum_labels if len(label) > wanted_type.length]
        if too_long:
            out.append(f"enum labels longer than the field's max_length {wanted_type.length}: {too_long}")
    default = wanted.python_default
    if default is not NOT_PROVIDED and default is not None and not callable(default):
        if str(default) not in column.enum_labels:
            out.append(f"the field default {default!r} is not a label of the enum {column.fmt!r}")
    elif callable(default):
        out.append("the field default is a callable; its values cannot be checked against the enum labels")
    if wanted.db_default is not NOT_PROVIDED and str(wanted.db_default) not in column.enum_labels:
        out.append(f"db_default {wanted.db_default!r} is not a label of the enum {column.fmt!r}")
    return out


def assess(
    wanted: WantedField,
    column: ColumnFacts,
    unique_indexes: list[UniqueIndexFacts],
    column_name: str,
    null_rows_exist: Callable[[], bool],
) -> tuple[list[str], list[str], list[str]]:
    """Pure compatibility decision. Returns (problems, warnings, actions).

    Any problem must stop the migration. ``actions`` is empty or ``["widen:<type>"]`` (a lossless varchar/text lengthening).
    """
    problems: list[str] = []
    warnings: list[str] = []
    actions: list[str] = []

    wanted_type = parse_type(wanted.db_type)
    existing_type = parse_type(column.fmt) if column.type_kind == "b" else None
    if wanted.has_remote:
        problems.append("foreign-key fields are not verified by this helper (constraint and index not checked)")
    if wanted.db_check:
        problems.append(f"the field carries a database CHECK ({wanted.db_check}) that this helper does not verify")
    if wanted_type is None:
        problems.append(f"unresolved wanted type {wanted.db_type!r}: not in the verified type map")
    if column.type_kind == "e":
        enum_problems = _enum_problems(column, wanted, wanted_type)
        problems.extend(enum_problems)
        if not enum_problems:
            warnings.append(
                f"existing column is the enum {column.fmt!r} ({len(column.enum_labels)} labels); it is stricter than the "
                "field, so values outside the labels are rejected by the database"
            )
    elif existing_type is None:
        problems.append(
            f"unresolved existing type {column.fmt!r} (kind {column.type_kind!r}): not in the verified type map "
            "(domains, composites and extension types are rejected)"
        )
    if wanted_type is not None and existing_type is not None:
        verdict, reason = type_decision(existing_type, wanted_type)
        if verdict == "reject":
            problems.append(f"incompatible type: {reason}")
        elif verdict == "widen":
            actions.append(f"widen:{wanted.db_type}")
            warnings.append(f"existing {column.fmt} will be widened to {wanted.db_type} (lossless): {reason}")

    if column.generated:
        problems.append("the existing column is a generated column; Django inserts would fail")
    if column.identity:
        problems.append("the existing column is an identity column; Django writes explicit values")

    if wanted.null and column.not_null:
        problems.append("the field is nullable (Django writes NULL explicitly) but the existing column is NOT NULL")
    elif not wanted.null and not column.not_null:
        if null_rows_exist():
            problems.append("the field is NOT NULL but the existing nullable column already holds NULL values")
        else:
            warnings.append("the field is NOT NULL but the existing column is nullable (no NULLs present; constraint not added)")

    reason = default_problem(wanted.db_default, column.default_expr)
    if reason:
        problems.append(f"default: {reason}")

    if wanted.unique:
        usable = [
            ix for ix in unique_indexes
            if ix.key_columns == 1 and ix.valid and ix.ready and not ix.has_expression
            and (ix.predicate is None or _normalize_predicate(ix.predicate) == f"{column_name.lower()}isnotnull")
        ]
        if not usable:
            detail = "; ".join(
                f"index(valid={ix.valid}, ready={ix.ready}, expression={ix.has_expression}, predicate={ix.predicate!r})"
                for ix in unique_indexes
            ) or "none found"
            problems.append(
                "the field is unique but no valid, ready, single-column, non-expression unique index with no predicate "
                f"(or only '<column> IS NOT NULL') exists: {detail}"
            )
    return problems, warnings, actions


_COLUMN_SQL = (
    "SELECT format_type(a.atttypid, a.atttypmod), a.attnotnull, pg_get_expr(d.adbin, d.adrelid), "
    "a.attgenerated <> '', a.attidentity <> '', t.typtype, "
    "COALESCE((SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = t.oid), ARRAY[]::text[]) "
    "FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace "
    "JOIN pg_type t ON t.oid = a.atttypid "
    "LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum "
    "WHERE n.nspname = current_schema() AND c.relname = %s AND a.attname = %s AND a.attnum > 0 "
    "AND NOT a.attisdropped AND c.relkind IN ('r', 'p')"
)
_UNIQUE_SQL = (
    "SELECT i.indnkeyatts, i.indisvalid, i.indisready, i.indexprs IS NOT NULL, pg_get_expr(i.indpred, i.indrelid) "
    "FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid JOIN pg_namespace n ON n.oid = c.relnamespace "
    "JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0] "
    "WHERE n.nspname = current_schema() AND c.relname = %s AND i.indisunique AND a.attname = %s"
)


def _column_facts(connection, table: str, column: str) -> Optional[ColumnFacts]:
    with connection.cursor() as cursor:
        cursor.execute(_COLUMN_SQL, [table, column])
        row = cursor.fetchone()
    if row is None:
        return None
    return ColumnFacts(
        fmt=row[0], not_null=bool(row[1]), default_expr=row[2], generated=bool(row[3]), identity=bool(row[4]),
        type_kind=row[5], enum_labels=tuple(row[6] or ()),
    )


def _unique_indexes(connection, table: str, column: str) -> list[UniqueIndexFacts]:
    with connection.cursor() as cursor:
        cursor.execute(_UNIQUE_SQL, [table, column])
        return [UniqueIndexFacts(r[0], bool(r[1]), bool(r[2]), bool(r[3]), r[4]) for r in cursor.fetchall()]


def _null_rows_exist(connection, table: str, column: str) -> bool:
    qn = connection.ops.quote_name
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT EXISTS (SELECT 1 FROM {qn(table)} WHERE {qn(column)} IS NULL)")
        return bool(cursor.fetchone()[0])


class AddFieldIfNotExists(migrations.AddField):
    """``AddField`` whose database step tolerates a proven-equivalent pre-existing column. See module docstring."""

    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        to_model = to_state.apps.get_model(app_label, self.model_name)
        if not self.allow_migrate_model(schema_editor.connection.alias, to_model):
            return
        field = to_model._meta.get_field(self.name)
        connection = schema_editor.connection
        table, column = to_model._meta.db_table, field.column
        facts = _column_facts(connection, table, column)
        if facts is None:
            return super().database_forwards(app_label, schema_editor, from_state, to_state)

        wanted = WantedField(
            column=column,
            db_type=field.db_type(connection),
            null=field.null,
            unique=bool(field.unique or field.primary_key),
            db_default=field.db_default,
            has_remote=field.remote_field is not None,
            db_check=field.db_check(connection),
            python_default=field.default,
        )
        problems, warnings, actions = assess(
            wanted,
            facts,
            _unique_indexes(connection, table, column) if wanted.unique else [],
            column,
            lambda: _null_rows_exist(connection, table, column),
        )
        label = f"{app_label}.{self.model_name}.{self.name}"
        if problems:
            raise RuntimeError(
                f"{label}: column {table}.{column} already exists but is not provably equivalent to the migration "
                f"state: {' | '.join(problems)}. Refusing to continue; reconcile the schema authority before migrating."
            )
        for warning in warnings:
            logger.warning("%s: %s", label, warning)
        for action in actions:  # only lossless varchar/text widening is ever planned
            qn = connection.ops.quote_name
            schema_editor.execute(f"ALTER TABLE {qn(table)} ALTER COLUMN {qn(column)} TYPE {action.split(':', 1)[1]}")
            logger.warning("%s: widened %s.%s (%s).", label, table, column, action)
        logger.info("%s: equivalent column already present; no column was added.", label)

    def database_backwards(self, app_label, schema_editor, from_state, to_state):
        # Never drop: the column may belong to another lineage and hold data.
        return

    def describe(self):
        return f"Add field {self.name} to {self.model_name} (skipped if a provably equivalent column already exists)"