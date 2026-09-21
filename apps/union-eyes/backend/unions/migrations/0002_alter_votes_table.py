"""Reconcile the ``votes`` table name to ``ue_votes``.

The model declares ``db_table = "ue_votes"`` but historical source-native
builds materialized the table as ``votes``. Aligns the two deterministically
and *fail-closed* against ambiguous schemas (see content.0004 for the full
rationale):

  - old present, new absent   -> rename ``votes`` -> ``ue_votes``
  - new present, old absent    -> already aligned, no-op
  - both present               -> ambiguous, raise (never guess)
  - neither present            -> unknown state, raise (never guess)
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
    _conditional_rename_table(schema_editor, "votes", "ue_votes")


def _backward(apps, schema_editor):
    _conditional_rename_table(schema_editor, "ue_votes", "votes")


class Migration(migrations.Migration):

    dependencies = [
        ("unions", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterModelTable(
                    name="votes",
                    table="ue_votes",
                ),
            ],
            database_operations=[
                migrations.RunPython(_forward, _backward),
            ],
        ),
    ]
