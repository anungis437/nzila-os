"""
Management command: measure every Django model against the physical PostgreSQL schema.

Usage:
    python manage.py ue_physical_parity [--json] [--strict] [--apps a,b] [--kinds K1,K2] [--write FILE]

The database is the one Django `migrate` plus the approved platform bootstrap builds. Django models are
the ORM contract of every live Django ViewSet, so what matters is whether an ORM read or write through a
model succeeds against the physical table. Two kinds of finding:

STRICT   - an ORM operation through the model fails or corrupts data on the physical table.
ADVISORY - the model and the table disagree, but no ORM operation fails because of it.

Strict kinds
    TABLE_ABSENT            the model's table does not exist
    COLUMN_ABSENT           a model field has no physical column (every SELECT of the model fails)
    TYPE_MISMATCH           the field's type and the column's type are not interchangeable
    NARROWER_PHYSICAL       the column is narrower than the field (varchar length, numeric precision, integer width)
    NULL_CONTRACT_MISMATCH  the model may send NULL (null=True) for a column that is NOT NULL
    REQUIRED_COLUMN_UNKNOWN a NOT NULL column without a default that the model does not know (every INSERT fails)
    ENUM_MEMBER_ABSENT      a choice value the model can write is not a member of the column's enum type
    FK_TARGET_MISMATCH      a foreign key on the column points at a different column than the model's own foreign key (a valid
                            Django write then violates that constraint, or names the wrong row); a column that carries
                            two keys is judged by both
    DEFAULT_DIVERGES        the model's constant default and the column's constant default differ, or the model has no
                            default for a column that has one, or the model has a default for a column that has none: a
                            Django INSERT writes its own value (or NULL, or '', or nothing the column would have stored)
                            over what every other writer gets, so one logical row differs by writer
    CHECK_REFUSES_CHOICE    a value the field's choices allow is refused by a CHECK constraint that lists the column's values

Advisory kinds
    TYPE_LOOSE              the field is more permissive than the column, or the column returns a different Python type
    TIMESTAMP_NAIVE         a DateTimeField over `timestamp without time zone`
    NOT_NULL_ABSENT         the model requires a value, the column accepts NULL
    UNIQUE_ABSENT           a model unique key is not enforced by the table
    FK_ABSENT               a model foreign key (db_constraint) is not enforced by the table
    CHECK_ABSENT            a model check constraint is not enforced by the table
    PK_ABSENT               a model primary key is not the table's primary key
    COLUMN_UNKNOWN          a nullable or defaulted column the model does not know (except a column of OPTIONAL_EXTENSION_COLUMNS)
    FK_DELETE_RULE_MISMATCH the model's on_delete (applied by Django, in Python) is not the database's delete rule on the key, so a DELETE
                            that does not go through the ORM behaves differently: `risk` says whether the database destroys what the
                            ORM protects (PROTECT/RESTRICT/DO_NOTHING over CASCADE, SET NULL or SET DEFAULT) or blocks what the ORM cascades

Exit status 1 with --strict when any strict finding exists.
"""
import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from django.apps import apps
from django.core.management.base import BaseCommand
from django.db import connection, models
from django.db.models import NOT_PROVIDED

from core.pg_literals import check_list_values, constant_default

STRICT_KINDS = (
    "TABLE_ABSENT",
    "COLUMN_ABSENT",
    "TYPE_MISMATCH",
    "NARROWER_PHYSICAL",
    "NULL_CONTRACT_MISMATCH",
    "REQUIRED_COLUMN_UNKNOWN",
    "ENUM_MEMBER_ABSENT",
    "FK_TARGET_MISMATCH",
    "DEFAULT_DIVERGES",
    "CHECK_REFUSES_CHOICE",
)
ADVISORY_KINDS = (
    "TYPE_LOOSE",
    "TIMESTAMP_NAIVE",
    "NOT_NULL_ABSENT",
    "UNIQUE_ABSENT",
    "FK_ABSENT",
    "CHECK_ABSENT",
    "PK_ABSENT",
    "COLUMN_UNKNOWN",
    "FK_DELETE_RULE_MISMATCH",
)

# A column that exists only where an optional PostgreSQL extension is offered. Platform 0063 creates knowledge_base.embedding inside a block that is skipped on
# a server without pgvector, so no model can declare it (a field would ask every server for a column most do not have), and a server that has it must not read
# as an incomplete model. It is read and written only through lib/ai/knowledge-base-embeddings.ts, after lib/ai/vector-readiness.ts has found the column. The match is
# exact (schema, table, column and type): a column that changes shape is an unknown column again.
OPTIONAL_EXTENSION_COLUMNS = {
    ("public", "knowledge_base", "embedding"): "vector(1536)",
}

# The database delete rule (pg_constraint.confdeltype) that enforces what each Django on_delete does in Python.
DELETE_RULES_FOR_ON_DELETE = {
    "CASCADE": ("c",),
    "PROTECT": ("a", "r"),
    "RESTRICT": ("a", "r"),
    "SET_NULL": ("n",),
    "SET_DEFAULT": ("d",),
    "DO_NOTHING": ("a", "r"),
    "set_on_delete": ("a", "r"),
}
DELETE_RULE_NAMES = {"a": "NO ACTION", "r": "RESTRICT", "c": "CASCADE", "n": "SET NULL", "d": "SET DEFAULT"}

# Longest prefix first, so `timestamp with time zone` is not read as `timestamp`.
FAMILY_PREFIXES = (
    ("timestamp with time zone", "timestamptz"),
    ("timestamp without time zone", "timestamp"),
    ("time with time zone", "timetz"),
    ("time without time zone", "time"),
    ("character varying", "text"),
    ("double precision", "float"),
    ("timestamptz", "timestamptz"),
    ("bigserial", "int"),
    ("smallserial", "int"),
    ("timestamp", "timestamp"),
    ("character", "text"),
    ("interval", "interval"),
    ("smallint", "int"),
    ("varchar", "text"),
    ("boolean", "bool"),
    ("integer", "int"),
    ("numeric", "numeric"),
    ("decimal", "numeric"),
    ("citext", "text"),
    ("bigint", "int"),
    ("serial", "int"),
    ("bpchar", "text"),
    ("float", "float"),
    ("bytea", "bytea"),
    ("jsonb", "json"),
    ("uuid", "uuid"),
    ("text", "text"),
    ("real", "float"),
    ("json", "json"),
    ("date", "date"),
    ("time", "time"),
    ("inet", "inet"),
    ("cidr", "inet"),
    ("name", "text"),
    ("char", "text"),
    ("bool", "bool"),
    ("int", "int"),
)
INT_WIDTH = {"smallint": 16, "smallserial": 16, "integer": 32, "serial": 32, "int": 32, "bigint": 64, "bigserial": 64}

# What a model field of one family can be backed by. Anything not listed is a TYPE_MISMATCH.
INTERCHANGEABLE = {
    "text": {"text", "enum"},
    "uuid": {"uuid"},
    "int": {"int"},
    "numeric": {"numeric"},
    "float": {"float"},
    "bool": {"bool"},
    "timestamptz": {"timestamptz"},
    "timestamp": {"timestamp"},
    "date": {"date"},
    "time": {"time"},
    "json": {"json"},
    "inet": {"inet"},
    "bytea": {"bytea"},
    "interval": {"interval"},
    "array": {"array"},
}
# The ORM works, but the Python value read back is another type, or the model accepts values the column refuses.
LOOSE = {
    "text": {"uuid", "inet"},
    "int": {"numeric", "float"},
    "numeric": {"int", "float"},
    "float": {"numeric", "int"},
    "json": {"text"},
}


def family(type_text):
    t = type_text.lower().strip()
    if t.endswith("[]") or t.startswith("array"):
        return "array"
    for prefix, name in FAMILY_PREFIXES:
        if t == prefix or t.startswith(prefix + "(") or t.startswith(prefix + " "):
            return name
    return t


def base_name(type_text):
    return re.split(r"[ (\[]", type_text.lower().strip(), maxsplit=1)[0]


def length_of(type_text):
    m = re.search(r"\((\d+)\)", type_text)
    return int(m.group(1)) if m else None


def precision_of(type_text):
    m = re.search(r"\((\d+)\s*,\s*(\d+)\)", type_text)
    return (int(m.group(1)), int(m.group(2))) if m else None


PHYSICAL_COLUMNS = """
SELECT n.nspname, c.relname, a.attname, format_type(a.atttypid, a.atttypmod), t.typtype, t.oid,
       a.attnotnull, a.attidentity <> '', a.attgenerated <> '', pg_get_expr(d.adbin, d.adrelid),
       et.typtype = 'e', et.oid, et.typname
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
LEFT JOIN pg_catalog.pg_type et ON et.oid = t.typelem AND t.typcategory = 'A'
LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'
ORDER BY n.nspname, c.relname, a.attnum
"""
ENUM_LABELS = """
SELECT e.enumtypid, e.enumlabel FROM pg_catalog.pg_enum e ORDER BY e.enumtypid, e.enumsortorder
"""
CONSTRAINTS = """
SELECT n.nspname, c.relname, k.conname, k.contype,
       ARRAY(SELECT a.attname FROM unnest(k.conkey) WITH ORDINALITY u(attnum, ord)
             JOIN pg_catalog.pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = u.attnum ORDER BY u.ord)
FROM pg_catalog.pg_constraint k
JOIN pg_catalog.pg_class c ON c.oid = k.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE k.contype IN ('p', 'u', 'f', 'c')
"""
UNIQUE_INDEXES = """
SELECT n.nspname, c.relname,
       ARRAY(SELECT a.attname FROM unnest(i.indkey::int2[]) WITH ORDINALITY u(attnum, ord)
             JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = u.attnum ORDER BY u.ord),
       i.indpred IS NOT NULL
FROM pg_catalog.pg_index i
JOIN pg_catalog.pg_class c ON c.oid = i.indrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE i.indisunique AND i.indexprs IS NULL AND i.indisvalid
"""
FOREIGN_KEY_TARGETS = """
SELECT n.nspname, c.relname, a.attname, rn.nspname, rc.relname, ra.attname, k.confdeltype
FROM pg_catalog.pg_constraint k
JOIN pg_catalog.pg_class c ON c.oid = k.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_class rc ON rc.oid = k.confrelid
JOIN pg_catalog.pg_namespace rn ON rn.oid = rc.relnamespace
JOIN pg_catalog.pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
JOIN pg_catalog.pg_attribute ra ON ra.attrelid = k.confrelid AND ra.attnum = k.confkey[1]
WHERE k.contype = 'f' AND cardinality(k.conkey) = 1
"""
CHECK_DEFINITIONS = """
SELECT n.nspname, c.relname, k.conname, pg_get_constraintdef(k.oid)
FROM pg_catalog.pg_constraint k
JOIN pg_catalog.pg_class c ON c.oid = k.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE k.contype = 'c'
"""


def split_table(db_table):
    # Django quotes `schema"."table` as one identifier, so a schema-qualified table is written that way.
    if '"."' in db_table:
        schema, table = db_table.split('"."', 1)
        return schema.strip('"'), table.strip('"')
    return "public", db_table


class Catalog:
    def __init__(self, cursor):
        self.columns = defaultdict(dict)
        cursor.execute(PHYSICAL_COLUMNS)
        for schema, rel, col, ftype, typtype, typoid, notnull, identity, generated, default, elem_enum, elem_oid, elem_name in cursor.fetchall():
            self.columns[(schema, rel)][col] = {
                "type": ftype,
                "enum": typtype == "e",
                "typoid": typoid,
                "elem_enum": bool(elem_enum),
                "elem_oid": elem_oid,
                "elem_name": elem_name,
                "notnull": notnull,
                "identity": identity,
                "generated": generated,
                "default": default,
            }
        self.enums = defaultdict(list)
        cursor.execute(ENUM_LABELS)
        for oid, label in cursor.fetchall():
            self.enums[oid].append(label)
        self.constraints = defaultdict(list)
        cursor.execute(CONSTRAINTS)
        for schema, rel, name, kind, cols in cursor.fetchall():
            self.constraints[(schema, rel)].append({"name": name, "kind": kind, "columns": list(cols)})
        self.unique_indexes = defaultdict(list)
        cursor.execute(UNIQUE_INDEXES)
        for schema, rel, cols, partial in cursor.fetchall():
            self.unique_indexes[(schema, rel)].append({"columns": list(cols), "partial": partial})
        self.foreign_key_targets = defaultdict(lambda: defaultdict(list))
        self.foreign_key_rules = defaultdict(lambda: defaultdict(list))
        cursor.execute(FOREIGN_KEY_TARGETS)
        for schema, rel, col, target_schema, target_rel, target_col, delete_rule in cursor.fetchall():
            self.foreign_key_targets[(schema, rel)][col].append(((target_schema, target_rel), target_col))
            self.foreign_key_rules[(schema, rel)][col].append(delete_rule)
        self.check_definitions = defaultdict(list)
        cursor.execute(CHECK_DEFINITIONS)
        for schema, rel, name, definition in cursor.fetchall():
            self.check_definitions[(schema, rel)].append((name, definition))

    def has_unique(self, key, columns):
        want = sorted(columns)
        for c in self.constraints[key]:
            if c["kind"] in ("p", "u") and sorted(c["columns"]) == want:
                return True
        return any(not i["partial"] and sorted(i["columns"]) == want for i in self.unique_indexes[key])

    def has_foreign_key(self, key, column):
        return any(c["kind"] == "f" and c["columns"] == [column] for c in self.constraints[key])

    def has_check(self, key, name):
        return any(c["kind"] == "c" and c["name"] == name for c in self.constraints[key])

    def primary_key(self, key):
        for c in self.constraints[key]:
            if c["kind"] == "p":
                return c["columns"]
        return []


def is_auto(field):
    return field.get_internal_type() in ("AutoField", "BigAutoField", "SmallAutoField")


def model_permits_null(field):
    """True when the model may send NULL for the field: ``null=True``, and the model does not always set a value itself."""
    if not field.null or is_auto(field):
        return False
    return not (getattr(field, "auto_now", False) or getattr(field, "auto_now_add", False))


# A default the measurement cannot evaluate (a callable that is not a plain container or a generated constant, an expression).
COMPUTED = object()


def model_default(field):
    """The model's constant default, NOT_PROVIDED when it has none, COMPUTED when it is evaluated at write time."""
    value = field.default
    if value is NOT_PROVIDED:
        database = getattr(field, "db_default", NOT_PROVIDED)
        if database is NOT_PROVIDED:
            return NOT_PROVIDED
        return COMPUTED if hasattr(database, "resolve_expression") else database
    if callable(value):
        if value in (dict, list) or getattr(value, "__module__", "") == "core.defaults":
            return value()
        return COMPUTED
    return value


def unbacked_default(field, column):
    """The default the model writes for a column that has none (NOT_PROVIDED when there is no such default).

    A Django INSERT that omits the field writes this value; a SQL script, a raw INSERT or any other writer leaves the column to NULL, or to an
    error when it is NOT NULL, so one logical row differs by writer. ``auto_now`` and ``auto_now_add`` stamp in Python and are not defaults.
    """
    if field.primary_key or is_auto(field) or column["identity"] or column["generated"]:
        return NOT_PROVIDED
    if getattr(field, "auto_now", False) or getattr(field, "auto_now_add", False):
        return NOT_PROVIDED
    if column["default"] is not None:
        return NOT_PROVIDED
    return model_default(field)


def defaults_agree(model_value, physical_value):
    """True when what the ORM writes for an omitted field is what the column's own default would have stored."""
    model_value = getattr(model_value, "value", model_value)
    if isinstance(physical_value, bool) or isinstance(model_value, bool):
        return model_value is physical_value
    if isinstance(physical_value, Decimal):
        try:
            return Decimal(str(model_value)) == physical_value
        except InvalidOperation:
            return False
    if isinstance(physical_value, (list, dict)):
        return list(model_value) == physical_value if isinstance(model_value, (list, tuple)) else model_value == physical_value
    if isinstance(model_value, (date, datetime)):
        return model_value.isoformat() == physical_value
    return str(model_value) == str(physical_value)


def check_refused_choices(field, definitions):
    """``(constraint, refused)`` for each CHECK that lists the column's values and leaves out a value the field's choices allow."""
    allowed = {str(getattr(c, "value", c)) for c, _ in field.flatchoices}
    refused = []
    for name, definition in definitions:
        permitted = check_list_values(definition, field.column)
        if permitted is not None and allowed - permitted:
            refused.append((name, sorted(allowed - permitted)))
    return refused


def measure(app_labels, include_contrib):
    findings = []
    with connection.cursor() as cursor:
        catalog = Catalog(cursor)
    measured = 0
    for model in apps.get_models(include_auto_created=True):
        meta = model._meta
        if meta.proxy or meta.abstract or not meta.managed:
            continue
        if app_labels and meta.app_label not in app_labels:
            continue
        if not include_contrib and meta.app_label in CONTRIB_APPS:
            continue
        measured += 1
        schema, table = split_table(meta.db_table)
        key = (schema, table)
        ident = {"app": meta.app_label, "model": model.__name__, "table": meta.db_table}

        def add(kind, column=None, **detail):
            findings.append({"kind": kind, **ident, "column": column, "detail": detail})

        physical = catalog.columns.get(key)
        if physical is None:
            add("TABLE_ABSENT")
            continue

        known = set()
        for field in meta.local_concrete_fields:
            known.add(field.column)
            column = physical.get(field.column)
            if column is None:
                add("COLUMN_ABSENT", field.column, field=field.name, expected=field.db_type(connection))
                continue
            expected = field.db_type(connection) or ""
            want, have = family(expected), family(column["type"])
            if column["enum"]:
                have = "enum"
            if have not in INTERCHANGEABLE.get(want, {want}):
                if want == "timestamptz" and have == "timestamp":
                    add("TIMESTAMP_NAIVE", field.column, field=field.name, physical=column["type"])
                elif have in LOOSE.get(want, set()):
                    add("TYPE_LOOSE", field.column, field=field.name, expected=expected, physical=column["type"])
                else:
                    add("TYPE_MISMATCH", field.column, field=field.name, expected=expected, physical=column["type"])
            elif want == "array" and have == "array":
                want_element = family(field.base_field.db_type(connection) or "")
                have_element = "enum" if column["elem_enum"] else family(column["type"][:-2])
                if have_element not in INTERCHANGEABLE.get(want_element, {want_element}):
                    add("TYPE_MISMATCH", field.column, field=field.name, expected=expected, physical=column["type"])

            if want == "text" and have == "text":
                n_model, n_phys = length_of(expected), length_of(column["type"])
                if n_phys is not None and (n_model is None or n_phys < n_model):
                    add("NARROWER_PHYSICAL", field.column, field=field.name, expected=expected, physical=column["type"])
            elif want == "int" and have == "int":
                if INT_WIDTH.get(base_name(column["type"]), 64) < INT_WIDTH.get(base_name(expected), 32):
                    add("NARROWER_PHYSICAL", field.column, field=field.name, expected=expected, physical=column["type"])
            elif want == "numeric" and have == "numeric":
                p_model, p_phys = precision_of(expected), precision_of(column["type"])
                if p_phys is not None and (
                    p_model is None or p_phys[1] < p_model[1] or p_phys[0] - p_phys[1] < p_model[0] - p_model[1]
                ):
                    add("NARROWER_PHYSICAL", field.column, field=field.name, expected=expected, physical=column["type"])

            if column["enum"] and field.choices:
                members = catalog.enums[column["typoid"]]
                absent = sorted(str(c) for c, _ in field.flatchoices if str(c) not in members)
                if absent:
                    add("ENUM_MEMBER_ABSENT", field.column, field=field.name, absent=absent)
            elif column["elem_enum"] and getattr(field, "base_field", None) is not None and field.base_field.choices:
                members = catalog.enums[column["elem_oid"]]
                absent = sorted(str(c) for c, _ in field.base_field.flatchoices if str(c) not in members)
                if absent:
                    add("ENUM_MEMBER_ABSENT", field.column, field=field.name, absent=absent)

            if not field.primary_key and not is_auto(field) and not column["identity"] and not column["generated"]:
                is_constant, physical_value = constant_default(column["default"])
                if is_constant:
                    written = model_default(field)
                    if written is NOT_PROVIDED:
                        if not (getattr(field, "auto_now", False) or getattr(field, "auto_now_add", False)):
                            add("DEFAULT_DIVERGES", field.column, field=field.name, django=None, database=column["default"])
                    elif written is not COMPUTED and not defaults_agree(written, physical_value):
                        add("DEFAULT_DIVERGES", field.column, field=field.name, django=repr(written), database=column["default"])
            unbacked = unbacked_default(field, column)
            if unbacked is not NOT_PROVIDED:
                add("DEFAULT_DIVERGES", field.column, field=field.name, django="computed" if unbacked is COMPUTED else repr(unbacked), database=None)

            if field.choices and not field.remote_field:
                for constraint_name, refused in check_refused_choices(field, catalog.check_definitions.get(key, [])):
                    add("CHECK_REFUSES_CHOICE", field.column, field=field.name, constraint=constraint_name, refused=refused)

            required = column["notnull"] and not column["identity"] and not column["generated"]
            if required and model_permits_null(field):
                add("NULL_CONTRACT_MISMATCH", field.column, field=field.name, default=column["default"])
            elif not column["notnull"] and not field.null and not field.primary_key and not is_auto(field):
                add("NOT_NULL_ABSENT", field.column, field=field.name)

        for name, column in physical.items():
            if name in known or OPTIONAL_EXTENSION_COLUMNS.get((*key, name)) == column["type"]:
                continue
            if column["notnull"] and column["default"] is None and not column["identity"] and not column["generated"]:
                add("REQUIRED_COLUMN_UNKNOWN", name, physical=column["type"])
            else:
                add("COLUMN_UNKNOWN", name, physical=column["type"], required=column["notnull"])

        pk = [f.column for f in meta.local_concrete_fields if f.primary_key]
        if pk and catalog.primary_key(key) != pk and not catalog.has_unique(key, pk):
            add("PK_ABSENT", ",".join(pk), physical=catalog.primary_key(key))
        for field in meta.local_concrete_fields:
            if field.unique and not field.primary_key and not catalog.has_unique(key, [field.column]):
                add("UNIQUE_ABSENT", field.column, field=field.name)
            if field.remote_field and getattr(field, "db_constraint", False) and field.column in physical:
                targets = catalog.foreign_key_targets[key].get(field.column)
                if not targets and not catalog.has_foreign_key(key, field.column):
                    add("FK_ABSENT", field.column, field=field.name, target=field.remote_field.model._meta.db_table)
                elif targets:
                    wanted = (split_table(field.target_field.model._meta.db_table), field.target_field.column)
                    # Every key on the column must point where the model does: a column can carry two, and one that disagrees refuses every write.
                    wrong = [t for t in targets if t != wanted]
                    if wrong:
                        add(
                            "FK_TARGET_MISMATCH",
                            field.column,
                            field=field.name,
                            django=f"{wanted[0][1]}.{wanted[1]}",
                            database=", ".join(f"{t[0][1]}.{t[1]}" for t in wrong),
                        )
                    # Django applies on_delete itself, in Python; a DELETE that does not go through the ORM (the Next.js application, SQL) gets the database's rule.
                    expected_rules = DELETE_RULES_FOR_ON_DELETE.get(getattr(field.remote_field.on_delete, "__name__", ""), ("a", "r"))
                    actual = sorted(set(catalog.foreign_key_rules[key].get(field.column, [])))
                    if actual and not set(actual) & set(expected_rules):
                        django_rule = getattr(field.remote_field.on_delete, "__name__", "?")
                        add(
                            "FK_DELETE_RULE_MISMATCH",
                            field.column,
                            field=field.name,
                            django=django_rule,
                            database="/".join(DELETE_RULE_NAMES.get(r, r) for r in actual),
                            risk="DB_DESTROYS_WHAT_ORM_PROTECTS"
                            if django_rule in ("PROTECT", "RESTRICT", "DO_NOTHING") and set(actual) & {"c", "n", "d"}
                            else "DB_BLOCKS_WHAT_ORM_CASCADES",
                        )
        for cols in meta.unique_together:
            columns = [meta.get_field(c).column for c in cols]
            if not catalog.has_unique(key, columns):
                add("UNIQUE_ABSENT", ",".join(columns), together=True)
        for constraint in meta.constraints:
            if isinstance(constraint, models.UniqueConstraint) and constraint.fields and not constraint.condition:
                columns = [meta.get_field(c).column for c in constraint.fields]
                if not catalog.has_unique(key, columns):
                    add("UNIQUE_ABSENT", ",".join(columns), constraint=constraint.name)
            elif isinstance(constraint, models.CheckConstraint) and not catalog.has_check(key, constraint.name):
                add("CHECK_ABSENT", None, constraint=constraint.name)
    return measured, findings


CONTRIB_APPS = {
    "admin",
    "auth",
    "contenttypes",
    "sessions",
    "messages",
    "staticfiles",
    "django_celery_beat",
    "django_celery_results",
}


class Command(BaseCommand):
    help = "Measure every Django model against the physical PostgreSQL schema (strict and advisory classes)."

    def add_arguments(self, parser):
        parser.add_argument("--json", action="store_true", help="Print PARITY_JSON=<report> as the last line.")
        parser.add_argument("--strict", action="store_true", help="Exit 1 when any strict finding exists.")
        parser.add_argument("--apps", default="", help="Comma-separated app labels to measure.")
        parser.add_argument("--kinds", default="", help="Comma-separated finding kinds to report.")
        parser.add_argument("--write", default="", help="Write the JSON report to this file.")
        parser.add_argument("--include-contrib", action="store_true", help="Also measure Django and Celery contrib apps.")

    def handle(self, *args, **options):
        labels = {a for a in options["apps"].split(",") if a}
        kinds = {k for k in options["kinds"].split(",") if k}
        measured, findings = measure(labels, options["include_contrib"])
        if kinds:
            findings = [f for f in findings if f["kind"] in kinds]
        summary = Counter(f["kind"] for f in findings)
        report = {
            "measured": measured,
            "strict": sum(summary[k] for k in STRICT_KINDS),
            "summary": dict(summary),
            "findings": findings,
        }
        if options["write"]:
            with open(options["write"], "w", encoding="utf-8") as handle:
                json.dump(report, handle, indent=1, default=str)
        if options["json"]:
            self.stdout.write("PARITY_JSON=" + json.dumps(report, default=str))
        else:
            self.stdout.write(f"{measured} Django models measured; {report['strict']} strict findings")
            for kind in STRICT_KINDS + ADVISORY_KINDS:
                if summary.get(kind):
                    label = "STRICT  " if kind in STRICT_KINDS else "advisory"
                    self.stdout.write(f"  {label}  {kind:<24} {summary[kind]}")
        if options["strict"] and report["strict"]:
            raise SystemExit(1)
