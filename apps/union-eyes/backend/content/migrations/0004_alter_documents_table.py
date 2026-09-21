"""Reconcile the ``documents`` table name to ``ue_documents``.

The model declares ``db_table = "ue_documents"`` but historical source-native
builds materialized the table as ``documents``. This migration aligns the two
deterministically and *fail-closed* against ambiguous schemas:

  - old present, new absent   -> rename ``documents`` -> ``ue_documents``
  - new present, old absent    -> already aligned, no-op
  - both present               -> ambiguous, raise (never guess)
  - neither present            -> unknown state, raise (never guess)

State is updated via ``AlterModelTable`` while the physical rename is performed
conditionally, so the migration is safe to apply to an already-aligned DB.
"""

from django.db import migrations


def _conditional_rename_table(schema_editor, old_name, new_name):
    conn = schema_editor.connection
    with conn.cursor() as cur:
        cur.execute(
            "SELECT to_regclass(%s) IS NOT NULL, to_regclass(%s) IS NOT NULL",
            [f"public.{old_name}", f"public.{new_name}"],
        )
        old_exists, new_exists = cur.fetchone()

    quote = conn.ops.quote_name
    if old_exists and not new_exists:
        schema_editor.execute(
            f"ALTER TABLE {quote(old_name)} RENAME TO {quote(new_name)}"
        )
    elif new_exists and not old_exists:
        return  # already aligned
    elif old_exists and new_exists:
        raise RuntimeError(
            f"Ambiguous schema: both '{old_name}' and '{new_name}' exist; "
            "refusing to guess (fail-closed)."
        )
    else:
        raise RuntimeError(
            f"Neither '{old_name}' nor '{new_name}' exists; schema is not in a "
            "known state (fail-closed)."
        )


def _forward(apps, schema_editor):
    _conditional_rename_table(schema_editor, "documents", "ue_documents")


def _backward(apps, schema_editor):
    _conditional_rename_table(schema_editor, "ue_documents", "documents")


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0003_pilotapplications_commercial_terms"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterModelTable(
                    name="documents",
                    table="ue_documents",
                ),
            ],
            database_operations=[
                migrations.RunPython(_forward, _backward),
            ],
        ),
    ]
