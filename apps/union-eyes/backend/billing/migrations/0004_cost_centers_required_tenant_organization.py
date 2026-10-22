"""Forward tenant-column prerequisites for scoped RLS 0016. No data inference."""
from django.db import migrations, models

TABLES = ('cost_centers',)


def enforce_required_organization(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor != "postgresql" or not connection.in_atomic_block:
        raise RuntimeError("Tenant prerequisite requires an atomic PostgreSQL migration")
    quote = schema_editor.quote_name
    fingerprint = """SELECT count(*), encode(sha256(convert_to(COALESCE(
        string_agg(encode(sha256(convert_to(to_jsonb(t)::text, 'UTF8')), 'hex'), '' ORDER BY id::text),
        ''), 'UTF8')), 'hex') FROM public.{table} t"""
    with connection.cursor() as cursor:
        cursor.execute("SET LOCAL lock_timeout = '5s'")
        cursor.execute("SET LOCAL statement_timeout = '120s'")
        # Fail if RLS would hide rows from preservation/null/orphan audits.
        cursor.execute("SET LOCAL row_security = off")
        cursor.execute("SELECT to_regclass('public.organizations')")
        if cursor.fetchone()[0] is None:
            raise RuntimeError("Tenant prerequisite requires public.organizations")
        cursor.execute("LOCK TABLE public.organizations IN SHARE MODE")
        for table in TABLES:
            cursor.execute("SELECT to_regclass(%s)", ["public." + table])
            if cursor.fetchone()[0] is None:
                raise RuntimeError("Tenant prerequisite missing table: " + table)
            cursor.execute("LOCK TABLE public." + quote(table) + " IN ACCESS EXCLUSIVE MODE")
        before = {}
        for table in TABLES:
            cursor.execute("""SELECT udt_name FROM information_schema.columns
                WHERE table_schema='public' AND table_name=%s AND column_name='organization_id'""", [table])
            column = cursor.fetchone()
            if column is None or column[0] != "uuid":
                raise RuntimeError("Tenant prerequisite requires UUID organization_id: " + table)
            cursor.execute("""SELECT count(*) FILTER (WHERE t.organization_id IS NULL),
                count(*) FILTER (WHERE t.organization_id IS NOT NULL AND NOT EXISTS
                    (SELECT 1 FROM public.organizations o WHERE o.id=t.organization_id))
                FROM public.""" + quote(table) + " t")
            nulls, orphans = cursor.fetchone()
            if nulls or orphans:
                raise RuntimeError("Tenant prerequisite refused NULL/orphan organization IDs: " + table)
            cursor.execute(fingerprint.format(table=quote(table)))
            before[table] = cursor.fetchone()
        for table in TABLES:
            cursor.execute("ALTER TABLE public." + quote(table) + " ALTER COLUMN organization_id SET NOT NULL")
        for table in TABLES:
            cursor.execute(fingerprint.format(table=quote(table)))
            if cursor.fetchone() != before[table]:
                raise RuntimeError("Tenant prerequisite changed row content/count: " + table)
            cursor.execute("""SELECT udt_name, is_nullable FROM information_schema.columns
                WHERE table_schema='public' AND table_name=%s AND column_name='organization_id'""", [table])
            if cursor.fetchone() != ("uuid", "NO"):
                raise RuntimeError("Tenant prerequisite constraint assertion failed: " + table)
            print("tenant prerequisite verified", table, "rows=" + str(before[table][0]), "sha256=" + before[table][1])


class Migration(migrations.Migration):
    atomic = True
    dependencies = [('billing', '0003_application_user_id_text')]
    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunPython(enforce_required_organization)],
            state_operations=[
                migrations.AlterField(model_name='costcenters', name="organization_id", field=models.UUIDField()),
            ],
        ),
    ]
