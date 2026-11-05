"""
Management command: record the current model state in Django's migration history without touching the database.

Usage:
    python manage.py ue_state_migrations [--apply] [--name NAME]

The platform migrations own the physical schema: they created the columns the models now describe, and their own guards
read the current type of those columns, so a Django migration that created or altered them would break a fresh build.
What Django's migration history still has to learn is that the models and the table agree. This command asks Django's own
autodetector what ``makemigrations`` would write, and wraps each migration's operations in ``SeparateDatabaseAndState``
with no database operations: the migration state changes, no DDL runs, on any database, in any order.

Without --apply it only reports. When there is nothing to record it writes nothing.
"""
from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import migrations
from django.db.migrations.autodetector import MigrationAutodetector
from django.db.migrations.loader import MigrationLoader
from django.db.migrations.questioner import MigrationQuestioner
from django.db.migrations.state import ProjectState
from django.db.migrations.writer import MigrationWriter

from core.migration_ops import RecordFieldState

NOTE = (
    "# State-only: the columns, types and nullability below already exist (the platform migrations created them); this\n"
    "# records them in Django's migration state and runs no SQL. See core/management/commands/ue_state_migrations.py.\n"
)


class StateOnlyQuestioner(MigrationQuestioner):
    """Answers every question: a default is only ever used to fill rows, and no row is filled."""

    def ask_not_null_addition(self, field_name, model_name):
        return None

    def ask_not_null_alteration(self, field_name, model_name):
        return None

    def ask_auto_now_add_addition(self, field_name, model_name):
        return None

    def ask_rename(self, model_name, old_name, new_name, field_instance):
        return False

    def ask_rename_model(self, old_model_state, new_model_state):
        return False

    def ask_initial(self, app_label):
        return False


class Command(BaseCommand):
    help = "Record the model state in Django's migration history without running any SQL."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Write the migration files.")
        parser.add_argument("--name", default="converge_models_to_physical_schema", help="Name of the migrations.")

    def handle(self, *args, **options):
        loader = MigrationLoader(None, ignore_no_migrations=True)
        conflicts = loader.detect_conflicts()
        if conflicts:
            raise CommandError(f"Conflicting migrations: {conflicts}")
        to_state = ProjectState.from_apps(apps)
        autodetector = MigrationAutodetector(loader.project_state(), to_state, StateOnlyQuestioner(dry_run=True))
        changes = autodetector.changes(graph=loader.graph, migration_name=options["name"])

        total = 0
        for app_label, app_migrations in sorted(changes.items()):
            for migration in app_migrations:
                bulk, rest = {}, []
                for operation in migration.operations:
                    if isinstance(operation, (migrations.AddField, migrations.AlterField)):
                        field = operation.field
                        if not operation.preserve_default:
                            # The autodetector put a throwaway default on the field; the model's own field has none.
                            field = to_state.models[(app_label, operation.model_name_lower)].fields[operation.name].clone()
                        if not field.is_relation and not field.primary_key:
                            bulk.setdefault(operation.model_name_lower, (operation.model_name, []))[1].append((operation.name, field))
                            continue
                        if not operation.preserve_default:
                            operation = type(operation)(operation.model_name, operation.name, field)
                    rest.append(operation)
                total += sum(len(fields) for _, fields in bulk.values()) + len(rest)
                self.stdout.write(
                    f"{app_label}: {migration.name}  {sum(len(f) for _, f in bulk.values())} fields on {len(bulk)} models, {len(rest)} other operations"
                )
                migration.operations = [RecordFieldState(name, fields) for name, fields in bulk.values()]
                if rest:
                    migration.operations.append(migrations.SeparateDatabaseAndState(state_operations=rest))
                if options["apply"]:
                    writer = MigrationWriter(migration)
                    text = writer.as_string().replace("class Migration(", NOTE + "\n\nclass Migration(", 1)
                    with open(writer.path, "w", encoding="utf-8", newline="\n") as handle:
                        handle.write(text)
        self.stdout.write(f"{total} state operations in {len(changes)} apps" + ("" if options["apply"] else " (dry run)"))
