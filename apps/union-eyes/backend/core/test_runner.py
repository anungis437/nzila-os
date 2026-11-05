"""The Django suite's test database: the schema production has, not the one Django's migrations alone describe.

Production is built in two steps: Django's migrations, then the platform migrations, which own the physical schema and
create the columns the models describe. A test database built from Django's migrations alone lacks those columns, so
every query on a model that has one fails. Two ways to get the real shape:

* ``UE_DJANGO_TEST_TEMPLATE=<database>``: clone that converged database (the one ``tooling/scripts/ue-runtime-up.mjs db``
  builds). This is the faithful mode, and what CI runs: constraints, defaults and types are the platform's own.
* otherwise Django's migrations run as usual, and the columns the models describe but the migrations never created are
  added, with the few types the platform retyped, a foreign key that points at another column than the model's is
  realigned, and a column gets the default its model declares (db_default). Fast, needs no setup, and more lenient than
  production: a column added this way is whatever the model says it is, not what the platform made it.
"""
import os

from django.apps import apps
from django.core.exceptions import ImproperlyConfigured
from django.test.runner import DiscoverRunner

from core.fields import EnumArrayField
from core.management.commands.ue_physical_parity import (
    CONTRIB_APPS,
    INTERCHANGEABLE,
    Catalog,
    family,
    split_table,
)

TEMPLATE_VARIABLE = "UE_DJANGO_TEST_TEMPLATE"


def converged_models():
    for model in apps.get_models():
        meta = model._meta
        if meta.proxy or meta.abstract or not meta.managed or meta.app_label in CONTRIB_APPS:
            continue
        yield model


def ensure_enum_type(editor, field):
    """An enum array column needs its enum type; the platform creates it, a migrations-only database does not."""
    if not isinstance(field, EnumArrayField):
        return
    labels = ", ".join(editor.quote_value(value) for value, _ in field.base_field.flatchoices)
    editor.execute(
        f"DO $$ BEGIN CREATE TYPE {editor.quote_name(field.enum_type)} AS ENUM ({labels}); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
    )


def add_platform_columns(connection):
    """Add the columns the models describe and the migrations never created; retype the ones the platform retyped."""
    with connection.cursor() as cursor:
        catalog = Catalog(cursor)
    added = retyped = 0
    with connection.schema_editor() as editor:
        for model in converged_models():
            meta = model._meta
            physical = catalog.columns.get(split_table(meta.db_table))
            if physical is None:
                continue
            for field in meta.local_concrete_fields:
                column = physical.get(field.column)
                if column is None:
                    ensure_enum_type(editor, field)
                    editor.add_field(model, field)
                    added += 1
                    continue
                want, have = family(field.db_type(connection) or ""), family(column["type"])
                if column["enum"]:
                    have = "enum"
                if have not in INTERCHANGEABLE.get(want, {want}) and want != "timestamptz":
                    table, name, new_type = editor.quote_name(meta.db_table), editor.quote_name(field.column), field.db_type(connection)
                    editor.execute(f"ALTER TABLE {table} ALTER COLUMN {name} TYPE {new_type} USING {name}::{new_type}")
                    retyped += 1
    return added, retyped


def align_foreign_keys(connection):
    """Point every model foreign key at the column the model names.

    Django's migrations created some keys against the primary key (``claims.id``) where the model's ``to_field`` names
    another column (``claims.claim_id``); the platform's migration 0070 removes those keys in production, so the same is
    done here instead of leaving a key no valid write can satisfy.
    """
    with connection.cursor() as cursor:
        catalog = Catalog(cursor)
    realigned = 0
    with connection.schema_editor() as editor:
        for model in converged_models():
            meta = model._meta
            key = split_table(meta.db_table)
            for field in meta.local_concrete_fields:
                if not (field.remote_field and field.db_constraint):
                    continue
                targets = catalog.foreign_key_targets[key].get(field.column) or []
                wanted = (split_table(field.target_field.model._meta.db_table), field.target_field.column)
                if all(target == wanted for target in targets):
                    continue
                for name in editor._constraint_names(model, [field.column], foreign_key=True):
                    editor.execute(editor._delete_fk_sql(model, name))
                editor.execute(editor._create_fk_sql(model, field, "_fk_%(to_table)s_%(to_column)s"))
                realigned += 1
    return realigned


def align_database_defaults(connection):
    """Give a column the default its model declares (``db_default``) where the migrations created it without one.

    The platform sets those defaults in production. A model that leaves such a field to the database writes the keyword
    DEFAULT, which needs the default to exist.
    """
    with connection.cursor() as cursor:
        catalog = Catalog(cursor)
    aligned = 0
    with connection.schema_editor() as editor:
        for model in converged_models():
            meta = model._meta
            physical = catalog.columns.get(split_table(meta.db_table))
            if physical is None:
                continue
            for field in meta.local_concrete_fields:
                column = physical.get(field.column)
                if column is None or column["default"] is not None or not field.has_db_default():
                    continue
                sql, params = editor.db_default_sql(field)
                editor.execute(
                    f"ALTER TABLE {editor.quote_name(meta.db_table)} ALTER COLUMN {editor.quote_name(field.column)} SET DEFAULT {sql}",
                    params,
                )
                aligned += 1
    return aligned


class ConvergedSchemaRunner(DiscoverRunner):
    def setup_databases(self, **kwargs):
        config = super().setup_databases(**kwargs)
        if not os.environ.get(TEMPLATE_VARIABLE):
            if self.parallel > 1:
                raise ImproperlyConfigured(
                    f"Parallel test databases are cloned before the platform's columns are added; set {TEMPLATE_VARIABLE} "
                    "to clone a converged database, or run without --parallel."
                )
            # Only a database this run created: when no test needs one, none is set up and the configured one is left alone.
            for connection, _name, created in config:
                if not created:
                    continue
                added, retyped = add_platform_columns(connection)
                realigned = align_foreign_keys(connection)
                defaulted = align_database_defaults(connection)
                if self.verbosity >= 1:
                    print(
                        f"Added {added} platform columns, retyped {retyped}, realigned {realigned} foreign keys and set "
                        f"{defaulted} database defaults on the {connection.alias} test database."
                    )
        return config
