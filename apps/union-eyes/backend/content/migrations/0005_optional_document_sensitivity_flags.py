"""Preserve the tri-state optional flags owned by manual 070 / Drizzle.

NULL is unclassified, never a backfilled negative classification. Privacy labels,
contains_* flags and document authorization remain unchanged. The explicit DDL
also repairs databases which already applied the older NOT NULL Django state.
"""
from django.db import migrations, models

FLAGS = ('disciplinary_sensitive', 'medical_sensitive', 'member_pii')


def preserve_optional_flags(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor != 'postgresql' or not connection.in_atomic_block:
        raise RuntimeError('Document flag convergence requires atomic PostgreSQL')
    with connection.cursor() as cursor:
        cursor.execute("SET LOCAL lock_timeout = '5s'")
        cursor.execute("SET LOCAL statement_timeout = '120s'")
        cursor.execute('SET LOCAL row_security = off')
        cursor.execute('LOCK TABLE public.documents IN ACCESS EXCLUSIVE MODE')
        for flag in FLAGS:
            cursor.execute("""SELECT udt_name FROM information_schema.columns
                WHERE table_schema='public' AND table_name='documents' AND column_name=%s""", [flag])
            if cursor.fetchone() != ('bool',):
                raise RuntimeError('Document flag convergence requires boolean column: ' + flag)
        fingerprint = """SELECT count(*), encode(sha256(convert_to(COALESCE(
            string_agg(encode(sha256(convert_to(to_jsonb(t)::text, 'UTF8')), 'hex'), '' ORDER BY id::text),
            ''), 'UTF8')), 'hex') FROM public.documents t"""
        cursor.execute(fingerprint)
        before = cursor.fetchone()
        for flag in FLAGS:
            cursor.execute('ALTER TABLE public.documents ALTER COLUMN ' + schema_editor.quote_name(flag) + ' DROP NOT NULL')
        cursor.execute(fingerprint)
        if cursor.fetchone() != before:
            raise RuntimeError('Document flag convergence changed existing document values')
        print('document optional flags verified', 'rows=' + str(before[0]), 'sha256=' + before[1])


class Migration(migrations.Migration):
    atomic = True
    dependencies = [('content', '0004_documents_access_level_documents_blob_container_and_more')]
    operations = [migrations.SeparateDatabaseAndState(
        database_operations=[migrations.RunPython(preserve_optional_flags)],
        state_operations=[migrations.AlterField(
            model_name='documents', name=flag,
            field=models.BooleanField(default=False, null=True, blank=True),
        ) for flag in FLAGS],
    )]
