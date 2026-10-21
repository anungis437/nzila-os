"""``profiles.user_id`` is unique (convergence P0 fresh bootstrap).

The model and the canonical Drizzle schema both declare ``user_id`` unique, and platform migration
0008_django_stub_relation_evolution adds foreign keys to ``profiles(user_id)``, which PostgreSQL only accepts against a
unique key. A database built by Django alone had no such key because 0006 rewrote the column without it. Databases
restored from the canonical snapshot already have the key, so the database step only adds one when no single-column
unique key exists. No data is rewritten. Reversal leaves the key in place.
"""
from django.db import migrations, models

ENSURE_UNIQUE = """
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
    WHERE i.indrelid = 'public.profiles'::regclass
      AND i.indisunique
      AND i.indnatts = 1
      AND i.indpred IS NULL
      AND i.indexprs IS NULL
      AND a.attname = 'user_id'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;
"""


class Migration(migrations.Migration):

    dependencies = [
        ("auth_core", "0007_profiles_database_defaults"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(ENSURE_UNIQUE, reverse_sql=migrations.RunSQL.noop),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name="profiles",
                    name="user_id",
                    field=models.TextField(unique=True),
                ),
            ],
        ),
    ]
