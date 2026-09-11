from django.db import migrations, models


FORWARD_SQL = """
DO $$
DECLARE
    existing_data_type text;
    existing_max_length integer;
    existing_nullable text;
BEGIN
    IF to_regclass('public.automation_rules') IS NULL THEN
        RAISE EXCEPTION
            'public.automation_rules does not exist; apply the owning schema migration before core.0003';
    END IF;

    SELECT data_type, character_maximum_length, is_nullable
      INTO existing_data_type, existing_max_length, existing_nullable
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'automation_rules'
       AND column_name = 'organization_id';

    IF existing_data_type IS NULL THEN
        IF EXISTS (
            SELECT 1
              FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'automation_rules'
               AND column_name = 'org_id'
        ) THEN
            RAISE EXCEPTION
                'automation_rules has legacy org_id-only ownership geometry; refusing to create a competing organization_id column without a separately proven migration';
        END IF;

        IF EXISTS (SELECT 1 FROM public.automation_rules LIMIT 1) THEN
            RAISE EXCEPTION
                'automation_rules.organization_id correction requires an empty table or a separately reviewed deterministic backfill';
        END IF;

        ALTER TABLE public.automation_rules
            ADD COLUMN organization_id varchar(255) NOT NULL;
    ELSIF existing_data_type <> 'character varying'
       OR existing_max_length <> 255 THEN
        RAISE EXCEPTION
            'automation_rules.organization_id has unexpected type: % (%)',
            existing_data_type,
            existing_max_length;
    ELSIF existing_nullable = 'YES' THEN
        IF EXISTS (
            SELECT 1
              FROM public.automation_rules
             WHERE organization_id IS NULL
             LIMIT 1
        ) THEN
            RAISE EXCEPTION
                'automation_rules.organization_id contains NULL ownership; a separately reviewed deterministic backfill is required';
        END IF;

        ALTER TABLE public.automation_rules
            ALTER COLUMN organization_id SET NOT NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_automation_rules_org
    ON public.automation_rules (organization_id);
"""


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0002_audit_hash_chain"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(sql=FORWARD_SQL, reverse_sql=migrations.RunSQL.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="automationrules",
                    name="organization_id",
                    field=models.CharField(max_length=255),
                ),
            ],
        ),
    ]