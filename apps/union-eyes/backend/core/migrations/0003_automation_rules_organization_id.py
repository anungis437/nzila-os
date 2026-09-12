from django.db import migrations, models


FORWARD_SQL = """
DO $$
DECLARE
    existing_data_type text;
    existing_max_length integer;
    existing_nullable text;
    legacy_data_type text;
    legacy_nullable text;
    legacy_column_exists boolean;
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

    SELECT EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'automation_rules'
           AND column_name = 'org_id'
    ) INTO legacy_column_exists;

    IF existing_data_type IS NOT NULL AND legacy_column_exists THEN
        RAISE EXCEPTION
            'automation_rules has ambiguous dual ownership geometry: both organization_id and org_id exist';
    END IF;

    IF existing_data_type IS NULL THEN
        IF legacy_column_exists THEN
                        SELECT data_type, is_nullable
                            INTO legacy_data_type, legacy_nullable
                            FROM information_schema.columns
                         WHERE table_schema = 'public'
                             AND table_name = 'automation_rules'
                             AND column_name = 'org_id';

                        IF legacy_data_type <> 'uuid' OR legacy_nullable <> 'NO' THEN
                                RAISE EXCEPTION
                                        'automation_rules.org_id has unexpected legacy geometry: % nullable=%',
                                        legacy_data_type,
                                        legacy_nullable;
                        END IF;

            IF EXISTS (SELECT 1 FROM public.automation_rules LIMIT 1) THEN
                RAISE EXCEPTION
                    'automation_rules has populated legacy org_id-only ownership geometry; a separately reviewed deterministic backfill is required';
            END IF;

            ALTER TABLE public.automation_rules
                DROP CONSTRAINT IF EXISTS automation_rules_org_id_organizations_id_fk;
            DROP INDEX IF EXISTS public.automation_rules_org_idx;
            ALTER TABLE public.automation_rules
                RENAME COLUMN org_id TO organization_id;
            ALTER TABLE public.automation_rules
                ALTER COLUMN organization_id TYPE varchar(255)
                USING organization_id::text;
            ALTER TABLE public.automation_rules
                ALTER COLUMN organization_id SET NOT NULL;
        ELSE
            IF EXISTS (SELECT 1 FROM public.automation_rules LIMIT 1) THEN
                RAISE EXCEPTION
                    'automation_rules.organization_id correction requires an empty table or a separately reviewed deterministic backfill';
            END IF;

            ALTER TABLE public.automation_rules
                ADD COLUMN organization_id varchar(255) NOT NULL;
        END IF;
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