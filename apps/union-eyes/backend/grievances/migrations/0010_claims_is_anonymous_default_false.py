"""claims.is_anonymous becomes an opt-in (default false).

Anonymous filing is now a real feature: the member chooses it on the intake form, and every claim read gates the member's
identity on it (apps/union-eyes/lib/cases/claim-identity.ts). Its default therefore has to be "not anonymous": a writer that
omits the flag must not silently hide who filed.

Database step: the physical column default (installed by the historical SQL lineage as ``DEFAULT true``) is set to
``false`` when the table and column exist. Guarded and idempotent; a Django-first database without the column is left
alone (Django supplies the value in Python either way).

Existing rows are NOT rewritten. Rows stored with ``true`` keep it, and the read gate treats them as anonymous, which
only hides identity, never exposes it. Whether historical rows (created while no screen offered the choice) should be
reset to ``false`` is an owner decision with its own change record, not part of this migration.

Reverse restores ``DEFAULT true``.
"""
from django.db import migrations, models

SET_DEFAULT = """
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'claims' AND column_name = 'is_anonymous'
  ) THEN
    EXECUTE 'ALTER TABLE claims ALTER COLUMN is_anonymous SET DEFAULT %s';
  END IF;
END
$$;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('grievances', '0009_ingestion_traceability'),
    ]

    operations = [
        migrations.AlterField(
            model_name='claims',
            name='is_anonymous',
            field=models.BooleanField(default=False),
        ),
        migrations.RunSQL(sql=SET_DEFAULT % 'false', reverse_sql=SET_DEFAULT % 'true'),
    ]
