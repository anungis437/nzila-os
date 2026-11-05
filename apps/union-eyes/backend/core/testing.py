"""Valid instances for tests: every required column gets a value its table accepts.

The generated model tests create rows with nothing but a foreign key. That only worked while the models allowed NULL in
every column and the tables enforced nothing; the real tables do. ``create_valid`` fills in what a row cannot do without,
from the model and from the table's own constraints, and leaves anything the caller passes untouched, so a test states only
what it is about:

* every required column gets a value of its type;
* a column the table constrains to a list of values gets the first of them;
* a column the table holds a foreign key on gets a parent row, if the value does not already name one. That covers a bare
  ``organization_id`` the model never made a ``ForeignKey`` of, and a random UUID a test passes for one.
"""
import datetime
import decimal
import itertools
import re
import uuid

from django.apps import apps
from django.contrib.postgres.fields import ArrayField
from django.db import connection, models
from django.utils import timezone

_counter = itertools.count(1)
MAX_DEPTH = 5

# CHECK ((col)::text = ANY ((ARRAY['a'::character varying, 'b'::character varying])::text[]))
_IN_LIST = re.compile(r"\((\w+)\)::text = ANY \(\(ARRAY\[(.*?)\]\)::text\[\]\)")
_foreign_keys = {}
_check_values = {}
_unique_columns = {}


def _is_auto(field):
    return field.get_internal_type() in ("AutoField", "BigAutoField", "SmallAutoField")


def _unique_text(field):
    text = f"{field.name}-{next(_counter)}"
    return text[-field.max_length :] if getattr(field, "max_length", None) else text


def _models_by_table():
    return {m._meta.db_table: m for m in apps.get_models() if not m._meta.proxy and not m._meta.abstract}


def database_foreign_keys(model):
    """{column: (referenced model, referenced field)} for the single-column foreign keys the table really has."""
    table = model._meta.db_table
    if table not in _foreign_keys:
        with connection.cursor() as cursor:
            relations = connection.introspection.get_relations(cursor, table)
        by_table = _models_by_table()
        found = {}
        for column, (target_column, target_table) in relations.items():
            target = by_table.get(target_table)
            if target is None:
                continue
            target_field = next((f for f in target._meta.concrete_fields if f.column == target_column), None)
            if target_field is not None:
                found[column] = (target, target_field)
        _foreign_keys[table] = found
    return _foreign_keys[table]


def database_check_values(model):
    """{column: first allowed value} for the columns the table constrains to a list of values."""
    table = model._meta.db_table
    if table not in _check_values:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT pg_get_constraintdef(oid) FROM pg_catalog.pg_constraint WHERE conrelid = %s::regclass AND contype = 'c'",
                [table],
            )
            definitions = [row[0] for row in cursor.fetchall()]
        found = {}
        for definition in definitions:
            for column, literals in _IN_LIST.findall(definition):
                values = re.findall(r"'([^']*)'", literals)
                if values:
                    found.setdefault(column, values[0])
        _check_values[table] = found
    return _check_values[table]


def database_unique_columns(model):
    """Columns the table holds a single-column unique constraint or index on (the model may not say so)."""
    table = model._meta.db_table
    if table not in _unique_columns:
        with connection.cursor() as cursor:
            constraints = connection.introspection.get_constraints(cursor, table)
        _unique_columns[table] = {
            details["columns"][0]
            for details in constraints.values()
            if details["unique"] and len(details["columns"]) == 1 and not details.get("foreign_key")
        }
    return _unique_columns[table]


def value_for(field, unique=False):
    """A value of the right type for the field. Keys and unique columns get a fresh value each call."""
    if field.choices:
        return field.flatchoices[0][0]
    kind = field.get_internal_type()
    unique = unique or field.unique or field.primary_key
    if kind in ("CharField", "TextField", "SlugField"):
        return _unique_text(field) if unique else "x"[: getattr(field, "max_length", None) or 1]
    if kind == "EmailField":
        return f"user{next(_counter)}@example.com"
    if kind == "URLField":
        return "https://example.com/"
    if kind in ("IntegerField", "SmallIntegerField", "BigIntegerField", "PositiveIntegerField", "PositiveSmallIntegerField"):
        return next(_counter) if unique else 1
    if kind == "FloatField":
        return 1.0
    if kind == "DecimalField":
        return decimal.Decimal("1")
    if kind == "BooleanField":
        return False
    if kind == "DateField":
        return datetime.date.today()
    if kind == "DateTimeField":
        return timezone.now()
    if kind == "TimeField":
        return datetime.time(12, 0)
    if kind == "DurationField":
        return datetime.timedelta(days=1)
    if kind == "UUIDField":
        return uuid.uuid4()
    if kind == "JSONField":
        return {}
    if kind == "BinaryField":
        return b""
    if kind == "GenericIPAddressField":
        return "127.0.0.1"
    if isinstance(field, ArrayField):
        return []
    raise ValueError(f"no test value for {field.model.__name__}.{field.name} ({kind})")


def _ensure_parent(target, target_field, value, depth):
    if value is None or target.objects.filter(**{target_field.attname: value}).exists():
        return
    if depth >= MAX_DEPTH:
        raise RecursionError(f"{target.__name__}: required parents nest deeper than {MAX_DEPTH}")
    create_valid(target, _depth=depth + 1, **{target_field.name: value})


def create_valid(model, _depth=0, **given):
    """Create ``model`` with ``given``; every other required column is filled in, and so is every parent a key points at."""
    check_values = database_check_values(model)
    values = {}
    named = set(given) | {f.attname for f in model._meta.concrete_fields if f.name in given}
    for field in model._meta.concrete_fields:
        if field.name in named or field.attname in named or _is_auto(field):
            continue
        if field.primary_key and field.has_default():
            continue
        if getattr(field, "db_default", models.NOT_PROVIDED) is not models.NOT_PROVIDED:
            continue
        if field.has_default() or field.null or getattr(field, "auto_now", False) or getattr(field, "auto_now_add", False):
            continue
        if field.is_relation:
            if _depth >= MAX_DEPTH:
                raise RecursionError(f"{model.__name__}.{field.name}: required parents nest deeper than {MAX_DEPTH}")
            values[field.name] = create_valid(field.related_model, _depth + 1)
        elif field.column in check_values:
            values[field.name] = check_values[field.column]
        else:
            values[field.name] = value_for(field, unique=field.column in database_unique_columns(model))

    row = {**given, **values}
    for field in model._meta.concrete_fields:
        target = database_foreign_keys(model).get(field.column)
        if target is None:
            continue
        value = row.get(field.name, row.get(field.attname))
        if isinstance(value, models.Model):
            continue
        _ensure_parent(target[0], target[1], value, _depth)
    return model.objects.create(**given, **values)
