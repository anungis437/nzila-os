"""Collect current Django model DDL; never import settings, load secrets or replay migrations."""

import ast
import hashlib
import inspect
import json
import sys
import uuid
from pathlib import Path


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    root = Path(sys.argv[1]).resolve()
    backend = root / "apps" / "union-eyes" / "backend"
    lock = (backend / "requirements.lock").read_bytes()
    import django

    expected = next(
        line.split("==")[1].split()[0]
        for line in lock.decode().splitlines()
        if line.lower().startswith("django==")
    )
    if django.get_version() != expected:
        raise RuntimeError(
            f"UE_V2_DJANGO_LOCK_VERSION_REQUIRED:{expected}:actual={django.get_version()}"
        )
    tree = ast.parse((backend / "config/settings.py").read_text(encoding="utf-8"))
    installed = next(
        ast.literal_eval(node.value)
        for node in tree.body
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "INSTALLED_APPS" for target in node.targets)
    )
    sys.path.insert(0, str(backend))
    from django.conf import settings
    from django.db.backends.base.base import BaseDatabaseWrapper

    def deny_connection(*args, **kwargs):
        raise RuntimeError("UE_V2_COLLECTION_DATABASE_CONNECTION_FORBIDDEN")

    BaseDatabaseWrapper.connect = deny_connection

    settings.configure(
        INSTALLED_APPS=installed,
        DATABASES={
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": "ue_v2_collect_only",
                "HOST": "127.0.0.1",
                "PORT": "1",
            }
        },
        SECRET_KEY="offline-current-model-collection-not-an-application-secret",
        USE_TZ=True,
        DEFAULT_AUTO_FIELD="django.db.models.BigAutoField",
        MIDDLEWARE=[],
        TEMPLATES=[{
            "BACKEND": "django.template.backends.django.DjangoTemplates",
            "APP_DIRS": True,
            "OPTIONS": {"context_processors": [
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]},
        }],
    )
    django.setup()
    from django.apps import apps
    from django.core.checks import run_checks
    from django.db import connection
    from django.db.backends.postgresql.operations import DatabaseOperations

    def compose_offline(self, sql, params):
        # PostgreSQL's schema editor renders constant db_default values through a
        # live driver cursor. Collection forbids connections, so render the small
        # set of literal types models declare and refuse anything else.
        def literal(value):
            if value is None:
                return "NULL"
            if isinstance(value, bool):
                return "true" if value else "false"
            if isinstance(value, int):
                return str(value)
            if isinstance(value, str) and "\\" not in value and "\x00" not in value:
                return "'" + value.replace("'", "''") + "'"
            raise RuntimeError("UE_V2_COLLECTION_UNSUPPORTED_DDL_PARAMETER:" + type(value).__name__)

        if not isinstance(params, (tuple, list)):
            raise RuntimeError("UE_V2_COLLECTION_UNSUPPORTED_DDL_PARAMETERS:" + type(params).__name__)
        return sql % tuple(literal(value) for value in params)

    DatabaseOperations.compose_sql = compose_offline

    errors = [str(error) for error in run_checks(tags=["models"]) if error.is_serious()]
    if errors:
        raise RuntimeError("UE_V2_CURRENT_MODEL_CHECK_FAILED:" + ";".join(errors))
    sources = {}
    models = []
    emitted = set()
    ddl = []
    def record_model(model, editor):
            table = model._meta.db_table
            source = Path(inspect.getfile(model))
            label = source.relative_to(root).as_posix() if source.is_relative_to(root) else f"python:{model.__module__}"
            if label not in sources:
                sources[label] = digest(source.read_bytes())
            columns = []
            for field in model._meta.local_fields:
                columns.append({
                    "name": field.column,
                    "type": field.db_type(connection),
                    "notNull": not field.null,
                    "primaryKey": field.primary_key,
                    "unique": field.unique,
                    "index": field.db_index,
                    "hasClientDefault": field.has_default(),
                    "clientDefault": field.default if field.has_default() and not callable(field.default) else None,
                    "defaultKind": (
                        "UUID4" if field.default is uuid.uuid4
                        else "AUDIT_NOW" if getattr(field, "auto_now", False) or getattr(field, "auto_now_add", False)
                        else "CALLABLE" if field.has_default() and callable(field.default)
                        else "SCALAR" if field.has_default()
                        else "NONE"
                    ),
                    "choices": [value for value, _ in field.flatchoices],
                    "foreignKey": {
                        "table": field.target_field.model._meta.db_table,
                        "column": field.target_field.column,
                        "onDelete": field.remote_field.on_delete.__name__,
                        "databaseSemantics": "NO ACTION DEFERRABLE INITIALLY DEFERRED",
                    } if field.is_relation and (field.many_to_one or field.one_to_one) and field.db_constraint else None,
                })
            models.append({
                "table": table,
                "app": model._meta.app_label,
                "model": model.__name__,
                "source": label,
                "sourceDigest": sources[label],
                "columns": columns,
                "uniqueTogether": list(model._meta.unique_together),
                "constraints": [constraint.deconstruct()[1:] for constraint in model._meta.constraints],
                "databaseConstraints": [{
                    "name": constraint.name,
                    "kind": type(constraint).__name__,
                    "sql": str(constraint.constraint_sql(model, editor)),
                } for constraint in model._meta.constraints],
            })
    with connection.schema_editor(collect_sql=True, atomic=False) as editor:
        for model in sorted(apps.get_models(), key=lambda value: value._meta.db_table):
            if not model._meta.managed or model._meta.proxy:
                continue
            table = model._meta.db_table
            if table in emitted:
                raise RuntimeError("UE_V2_DUPLICATE_CURRENT_MODEL_TABLE:" + table)
            emitted.add(table)
            record_model(model, editor)
            start = len(editor.collected_sql)
            editor.create_model(model)
            statements = editor.collected_sql[start:]
            ddl.extend({"owner": table, "sql": sql} for sql in statements)
        deferred = list(editor.deferred_sql)
    for model in sorted(apps.get_models(include_auto_created=True), key=lambda value: value._meta.db_table):
        if model._meta.auto_created and model._meta.managed:
            record_model(model, editor)
    models.sort(key=lambda model: model["table"])
    ddl.extend({"owner": "current-model-deferred-constraints", "sql": str(sql) + ";"} for sql in deferred)
    print(json.dumps({
        "lineage": "PROSPECTIVE_UE_BOOTSTRAP_V2",
        "contractVersion": "2.0",
        "djangoVersion": django.get_version(),
        "lockDigest": digest(lock),
        "sourceDigests": sources,
        "models": models,
        "ddl": ddl,
        "sourceModelChecks": "PASS",
        "historicalMigrationReplay": False,
        "databaseConnectionsDuringCollection": 0,
    }, default=str))


if __name__ == "__main__":
    main()
